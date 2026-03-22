import { WALL, mulberry32 } from '../map-gen-blockers.js';
import { assetUrl } from '../utils.js';

export const OPENWORLD_GROUND_TYPES = {
  grassA: {
    id: 'grassA',
    baseSheetSrc: 'assets/Environments/1. OpenWorld/1.First Layer/mainGround1280px.png',
    baseTileWidth: 640,
    baseTileHeight: 640,
    baseColumns: 2,
    baseRows: 2,
    seamBreakup: {
      layerId: 'grassA_1',
      alpha: 0.5,
      stampsPerVerticalSeam: 3,
      stampsPerHorizontalSeam: 3,
      edgePadding: 24,
      jitter: 48,
    },
    overlayLayers: [
      {
        id: 'grassA_1',
        patchSheetSrc: 'assets/Environments/1. OpenWorld/1.First Layer/grassA_1.png',
        patchDefsSrc: 'assets/Environments/1. OpenWorld/1.First Layer/grassA_1.json',
        targetCoverage: 0.7,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 20000,
      },
      {
        id: 'grassA_2',
        patchSheetSrc: 'assets/Environments/1. OpenWorld/2.Second Layer/grassA_2.png',
        patchDefsSrc: 'assets/Environments/1. OpenWorld/2.Second Layer/grassA_2.json',
        targetCoverage: 0.11,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 5000,
      },
      {
        id: 'rocksA',
        patchSheetSrc: 'assets/Environments/1. OpenWorld/2.Second Layer/groundrocksA.png',
        patchDefsSrc: 'assets/Environments/1. OpenWorld/2.Second Layer/rocksA.json',
        targetCoverage: 0.05,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 5000,
      },
    ],
    flowerLayer: {
      sheetSrc: 'assets/Environments/1. OpenWorld/3.Third Layer/fourFlowers.png',
      defsSrc: 'assets/Environments/1. OpenWorld/3.Third Layer/fourFlowers.json',
      minPerZone: 8,
      maxPerZone: 20,
      mixNeighborChance: 0.1,
    },
    shrubLayer: {
      sheetSrc: 'assets/Environments/1. OpenWorld/4.SingleObj/Shrubs/16 Shrubs.png',
      columns: 4,
      rows: 4,
      spriteWidth: 109,
      spriteHeight: 114,
      scale: 0.3,
      minCount: 8,
      maxCount: 28,
      gapTilePadding: 1,
      preferredGapRatio: 0.8,
    },
    boulderLayer: {
      sprites: [
        {
          id: 'boulder_large_1',
          src: 'assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_01.png',
          role: 'lead',
          weight: 4,
        },
        {
          id: 'boulder_flat_1',
          src: 'assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_09.png',
          role: 'support',
          weight: 3,
        },
        {
          id: 'boulder_crystal_1',
          src: 'assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockA_11.png',
          role: 'support',
          weight: 2,
        },
        {
          id: 'boulder_round_2',
          src: 'assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_08.png',
          role: 'lead',
          weight: 3,
        },
        {
          id: 'boulder_chip_1',
          src: 'assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockAA_14.png',
          role: 'chip',
          weight: 6,
        },
        {
          id: 'boulder_chip_crystal_1',
          src: 'assets/Environments/1. OpenWorld/4.SingleObj/Decorative/Rocks/rockA_15.png',
          role: 'chip',
          weight: 2,
        },
      ],
      minClusters: 14,
      maxClusters: 24,
      minClusterSize: 2,
      maxClusterSize: 5,
      minAnchorSpacing: 168,
      maxClusterRadius: 84,
      maxOverlapRatio: 0.1,
      gapTilePadding: 1,
      preferredGapRatio: 0.85,
    },
  },
};

const groundPatchDefsPromiseCache = new Map();

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePatchDef(entry, index) {
  const x = toFiniteNumber(entry?.x);
  const y = toFiniteNumber(entry?.y);
  const w = toFiniteNumber(entry?.w);
  const h = toFiniteNumber(entry?.h);
  if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) {
    throw new Error(`Invalid OpenWorld ground patch at index ${index}`);
  }
  const weight = toFiniteNumber(entry?.weight);
  return {
    id: String(entry?.id || `patch_${index + 1}`),
    x: Math.floor(x),
    y: Math.floor(y),
    w: Math.floor(w),
    h: Math.floor(h),
    weight: weight != null && weight > 0 ? weight : 1,
  };
}

function getFloorTileCount(world) {
  const grid = world?.tileGrid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) {
    const tileSize = Math.max(1, Number(world?.tileSize) || 32);
    const width = Math.max(1, Math.floor((Number(world?.width) || tileSize) / tileSize));
    const height = Math.max(1, Math.floor((Number(world?.height) || tileSize) / tileSize));
    return width * height;
  }
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== WALL) count += 1;
    }
  }
  return count;
}

function rectFitsWalkableFloor(world, rect) {
  const tileSize = Math.max(1, Number(world?.tileSize) || 32);
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > world.width || rect.y + rect.h > world.height) {
    return false;
  }
  const grid = world?.tileGrid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) {
    return true;
  }
  const gx0 = Math.floor(rect.x / tileSize);
  const gy0 = Math.floor(rect.y / tileSize);
  const gx1 = Math.ceil((rect.x + rect.w) / tileSize) - 1;
  const gy1 = Math.ceil((rect.y + rect.h) / tileSize) - 1;
  for (let gy = gy0; gy <= gy1; gy += 1) {
    if (gy < 0 || gy >= grid.length) return false;
    for (let gx = gx0; gx <= gx1; gx += 1) {
      if (gx < 0 || gx >= grid[gy].length || grid[gy][gx] === WALL) return false;
    }
  }
  return true;
}

function rectIntersectionArea(a, b) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  return (x1 - x0) * (y1 - y0);
}

function overlapsTooMuch(candidate, accepted, maxOverlapRatio) {
  const candidateArea = candidate.w * candidate.h;
  for (const existing of accepted) {
    const overlapArea = rectIntersectionArea(candidate, existing);
    if (!overlapArea) continue;
    const existingArea = existing.w * existing.h;
    const ratio = overlapArea / Math.min(candidateArea, existingArea);
    if (ratio > maxOverlapRatio) return true;
  }
  return false;
}

function pickWeightedPatchDef(patchDefs, totalWeight, rand) {
  let roll = rand() * totalWeight;
  for (const patchDef of patchDefs) {
    roll -= patchDef.weight;
    if (roll <= 0) return patchDef;
  }
  return patchDefs[patchDefs.length - 1] || null;
}

const groundImagePromiseCache = new Map();

function loadImage(src) {
  if (groundImagePromiseCache.has(src)) return groundImagePromiseCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load OpenWorld ground image: ${src}`));
    image.src = assetUrl(src);
  });
  groundImagePromiseCache.set(src, promise);
  return promise;
}

function createGroundCanvas(width, height) {
  if (typeof document === 'undefined' || !document?.createElement) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

function loadPatchDefs(src) {
  if (groundPatchDefsPromiseCache.has(src)) return groundPatchDefsPromiseCache.get(src);
  const promise = fetch(assetUrl(src))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load OpenWorld ground patch defs: ${src}`);
      }
      return response.json();
    })
    .then((json) => parseOpenWorldGroundPatchDefs(json));
  groundPatchDefsPromiseCache.set(src, promise);
  return promise;
}

export function getOpenWorldGroundType(groundTypeId) {
  const type = OPENWORLD_GROUND_TYPES[groundTypeId];
  if (!type) throw new Error(`Unknown OpenWorld ground type: ${groundTypeId}`);
  return type;
}

export function parseOpenWorldGroundPatchDefs(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  return objects.map((entry, index) => normalizePatchDef(entry, index));
}

export function parseOpenWorldFlowerFamilies(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const families = Array.isArray(data?.families) ? data.families : [];
  return families.map((family, familyIndex) => ({
    id: String(family?.id || `family_${familyIndex + 1}`),
    tiles: Array.isArray(family?.tiles)
      ? family.tiles.map((tile, tileIndex) => ({
        id: String(tile?.id || `${family?.id || `family_${familyIndex + 1}`}_${tileIndex + 1}`),
        x: Math.floor(toFiniteNumber(tile?.x) || 0),
        y: Math.floor(toFiniteNumber(tile?.y) || 0),
        w: Math.max(1, Math.floor(toFiniteNumber(tile?.w) || 32)),
        h: Math.max(1, Math.floor(toFiniteNumber(tile?.h) || 32)),
        weight: Math.max(1, Math.floor(toFiniteNumber(tile?.weight) || 1)),
      }))
      : [],
  })).filter((family) => family.tiles.length > 0);
}

export function buildOpenWorldGroundPlacements(world, patchDefs, seed, options = {}) {
  if (!Array.isArray(patchDefs) || patchDefs.length === 0) return [];

  const tileSize = Math.max(1, Number(world?.tileSize) || 32);
  const floorTileCount = getFloorTileCount(world);
  const targetCoverage = Math.max(0, Math.min(1, Number(options.targetCoverage) || 0.14));
  const targetArea = floorTileCount * tileSize * tileSize * targetCoverage;
  const maxOverlapRatio = Math.max(0, Math.min(1, Number(options.maxOverlapRatio) || 0.18));
  const maxPlacementAttempts = Math.max(100, Math.floor(Number(options.maxPlacementAttempts) || 5000));
  const totalWeight = patchDefs.reduce((sum, patchDef) => sum + Math.max(0, patchDef.weight), 0);
  if (totalWeight <= 0 || targetArea <= 0) return [];

  const placements = [];
  let coveredArea = 0;
  const rand = mulberry32((((Number(seed) || 0) ^ 0x41c64e6d) >>> 0));

  for (let attempt = 0; attempt < maxPlacementAttempts && coveredArea < targetArea; attempt += 1) {
    const patchDef = pickWeightedPatchDef(patchDefs, totalWeight, rand);
    if (!patchDef) break;
    const maxX = Math.max(0, world.width - patchDef.w);
    const maxY = Math.max(0, world.height - patchDef.h);
    const rect = {
      x: Math.floor(rand() * (maxX + 1)),
      y: Math.floor(rand() * (maxY + 1)),
      w: patchDef.w,
      h: patchDef.h,
    };
    if (!rectFitsWalkableFloor(world, rect)) continue;
    if (overlapsTooMuch(rect, placements, maxOverlapRatio)) continue;
    placements.push({
      patchId: patchDef.id,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      sx: patchDef.x,
      sy: patchDef.y,
      sw: patchDef.w,
      sh: patchDef.h,
      weight: patchDef.weight,
    });
    coveredArea += rect.w * rect.h;
  }

  return placements;
}

export function buildOpenWorldGroundBaseCanvas(world, baseSheetImage, seed, options = {}) {
  const canvas = createGroundCanvas(world?.width, world?.height);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  const tileWidth = Math.max(1, Math.floor(Number(options.baseTileWidth) || 512));
  const tileHeight = Math.max(1, Math.floor(Number(options.baseTileHeight) || 512));
  const columns = Math.max(1, Math.floor(Number(options.baseColumns) || 1));
  const rows = Math.max(1, Math.floor(Number(options.baseRows) || 1));
  const rand = mulberry32((((Number(seed) || 0) ^ 0x51f15e37) >>> 0));

  if (baseSheetImage?.complete) {
    for (let y = 0; y < canvas.height; y += tileHeight) {
      for (let x = 0; x < canvas.width; x += tileWidth) {
        const variantIndex = Math.floor(rand() * (columns * rows));
        const sx = (variantIndex % columns) * tileWidth;
        const sy = Math.floor(variantIndex / columns) * tileHeight;
        const dw = Math.min(tileWidth, canvas.width - x);
        const dh = Math.min(tileHeight, canvas.height - y);
        ctx.drawImage(
          baseSheetImage,
          sx,
          sy,
          dw,
          dh,
          x,
          y,
          dw,
          dh
        );
      }
    }
    return canvas;
  }

  ctx.fillStyle = options.baseColor || 'rgb(111, 106, 71)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function stampChunkSeamBreakup(ctx, canvas, seed, options = {}, seamBreakup = null) {
  if (!ctx || !canvas || !seamBreakup?.patchSheetImage?.complete || !Array.isArray(seamBreakup.patchDefs) || !seamBreakup.patchDefs.length) {
    return;
  }
  const tileWidth = Math.max(1, Math.floor(Number(options.baseTileWidth) || 512));
  const tileHeight = Math.max(1, Math.floor(Number(options.baseTileHeight) || 512));
  const verticalSeamXs = [];
  const horizontalSeamYs = [];
  for (let x = tileWidth; x < canvas.width; x += tileWidth) verticalSeamXs.push(x);
  for (let y = tileHeight; y < canvas.height; y += tileHeight) horizontalSeamYs.push(y);
  if (!verticalSeamXs.length && !horizontalSeamYs.length) return;

  const rand = mulberry32((((Number(seed) || 0) ^ 0x2f6e2b1d) >>> 0));
  const alpha = Math.max(0, Math.min(1, Number(seamBreakup.alpha) || 0.35));
  const edgePadding = Math.max(0, Math.floor(Number(seamBreakup.edgePadding) || 24));
  const jitter = Math.max(0, Math.floor(Number(seamBreakup.jitter) || 96));
  const totalWeight = seamBreakup.patchDefs.reduce((sum, patchDef) => sum + Math.max(0, patchDef.weight), 0);
  if (totalWeight <= 0) return;

  const drawStamp = (centerX, centerY) => {
    const patchDef = pickWeightedPatchDef(seamBreakup.patchDefs, totalWeight, rand);
    if (!patchDef) return;
    const x = Math.max(
      -patchDef.w + edgePadding,
      Math.min(canvas.width - edgePadding, Math.round(centerX - patchDef.w / 2))
    );
    const y = Math.max(
      -patchDef.h + edgePadding,
      Math.min(canvas.height - edgePadding, Math.round(centerY - patchDef.h / 2))
    );
    ctx.drawImage(
      seamBreakup.patchSheetImage,
      patchDef.x,
      patchDef.y,
      patchDef.w,
      patchDef.h,
      x,
      y,
      patchDef.w,
      patchDef.h
    );
  };

  ctx.save();
  ctx.globalAlpha = alpha;
  for (const seamX of verticalSeamXs) {
    const stampCount = Math.max(1, Math.floor(Number(seamBreakup.stampsPerVerticalSeam) || 2));
    for (let index = 0; index < stampCount; index += 1) {
      const centerY = Math.round(((index + 0.5) * canvas.height) / stampCount + (rand() * 2 - 1) * jitter);
      const centerX = Math.round(seamX + (rand() * 2 - 1) * Math.min(jitter, tileWidth / 3));
      drawStamp(centerX, centerY);
    }
  }
  for (const seamY of horizontalSeamYs) {
    const stampCount = Math.max(1, Math.floor(Number(seamBreakup.stampsPerHorizontalSeam) || 2));
    for (let index = 0; index < stampCount; index += 1) {
      const centerX = Math.round(((index + 0.5) * canvas.width) / stampCount + (rand() * 2 - 1) * jitter);
      const centerY = Math.round(seamY + (rand() * 2 - 1) * Math.min(jitter, tileHeight / 3));
      drawStamp(centerX, centerY);
    }
  }
  ctx.restore();
}

export function buildOpenWorldGroundDetailCanvas(world, groundLayer) {
  const canvas = createGroundCanvas(world?.width, world?.height);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  for (const overlayLayer of groundLayer?.overlayLayers || []) {
    if (!overlayLayer?.patchSheetImage?.complete || !Array.isArray(overlayLayer.placements)) continue;
    for (const placement of overlayLayer.placements) {
      ctx.drawImage(
        overlayLayer.patchSheetImage,
        placement.sx,
        placement.sy,
        placement.sw,
        placement.sh,
        placement.x,
        placement.y,
        placement.w,
        placement.h
      );
    }
  }

  const flowerLayer = groundLayer?.flowerLayer;
  if (flowerLayer?.sheetImage?.complete && Array.isArray(flowerLayer.placements)) {
    for (const placement of flowerLayer.placements) {
      ctx.drawImage(
        flowerLayer.sheetImage,
        placement.sx,
        placement.sy,
        placement.sw,
        placement.sh,
        placement.x,
        placement.y,
        placement.w,
        placement.h
      );
    }
  }

  return canvas;
}

function rectsOverlapInclusive(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getWorldZoneBounds(world) {
  const grid = world?.archetypeGrid?.grid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) return [];
  const rows = grid.length;
  const cols = grid[0].length;
  const zoneWidth = world.width / cols;
  const zoneHeight = world.height / rows;
  const zones = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (grid[row][col] == null) continue;
      zones.push({
        id: `${row}_${col}`,
        x: col * zoneWidth,
        y: row * zoneHeight,
        w: zoneWidth,
        h: zoneHeight,
      });
    }
  }
  return zones;
}

function pickWeightedEntry(entries, rand) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.weight) || 0), 0);
  if (totalWeight <= 0) return entries[0] || null;
  let roll = rand() * totalWeight;
  for (const entry of entries) {
    roll -= Math.max(0, Number(entry?.weight) || 0);
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1] || null;
}

function getAllWalkableTileCandidates(world) {
  const grid = world?.tileGrid;
  const tileSize = Math.max(1, Number(world?.tileSize) || 32);
  const candidates = [];
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) return candidates;
  for (let gy = 0; gy < grid.length; gy += 1) {
    for (let gx = 0; gx < grid[gy].length; gx += 1) {
      if (grid[gy][gx] === WALL) continue;
      candidates.push({
        gx,
        gy,
        x: gx * tileSize,
        y: gy * tileSize,
      });
    }
  }
  return candidates;
}

function pickFlowerFamily(families, rand) {
  if (!families.length) return null;
  return families[Math.floor(rand() * families.length)] || families[0];
}

function pickNeighborFlowerFamily(families, primaryFamily, rand) {
  const index = families.findIndex((family) => family.id === primaryFamily?.id);
  if (index < 0) return primaryFamily;
  const neighborIndexes = [index - 1, index + 1].filter((candidate) => candidate >= 0 && candidate < families.length);
  if (!neighborIndexes.length) return primaryFamily;
  return families[neighborIndexes[Math.floor(rand() * neighborIndexes.length)]] || primaryFamily;
}

export function buildOpenWorldFlowerPlacements(world, families, seed, options = {}) {
  if (!Array.isArray(families) || !families.length) return [];
  const zones = getWorldZoneBounds(world);
  if (!zones.length) return [];
  const rand = mulberry32((((Number(seed) || 0) ^ 0x6d2b79f5) >>> 0));
  const minPerZone = Math.max(1, Math.floor(Number(options.minPerZone) || 8));
  const maxPerZone = Math.max(minPerZone, Math.floor(Number(options.maxPerZone) || 20));
  const mixNeighborChance = Math.max(0, Math.min(1, Number(options.mixNeighborChance) || 0.1));
  const placements = [];
  const tileSize = Math.max(1, Number(world?.tileSize) || 32);

  for (const zone of zones) {
    const primaryFamily = pickFlowerFamily(families, rand);
    if (!primaryFamily) continue;
    const count = minPerZone + Math.floor(rand() * (maxPerZone - minPerZone + 1));
    for (let index = 0; index < count; index += 1) {
      const useNeighborFamily = rand() < mixNeighborChance;
      const family = useNeighborFamily ? pickNeighborFlowerFamily(families, primaryFamily, rand) : primaryFamily;
      const tile = pickWeightedEntry(family.tiles, rand);
      if (!tile) continue;
      const maxX = Math.max(zone.x, zone.x + zone.w - tile.w);
      const maxY = Math.max(zone.y, zone.y + zone.h - tile.h);
      const x = Math.floor(zone.x + rand() * Math.max(1, maxX - zone.x + 1));
      const y = Math.floor(zone.y + rand() * Math.max(1, maxY - zone.y + 1));
      const rect = { x, y, w: tile.w, h: tile.h };
      if (!rectFitsWalkableFloor(world, rect)) continue;
      placements.push({
        familyId: family.id,
        tileId: tile.id,
        x,
        y,
        w: tile.w,
        h: tile.h,
        sx: tile.x,
        sy: tile.y,
        sw: tile.w,
        sh: tile.h,
        zoneId: zone.id,
        gx: Math.floor(x / tileSize),
        gy: Math.floor(y / tileSize),
      });
    }
  }

  return placements;
}

function buildShrubSprites(options = {}) {
  const columns = Math.max(1, Math.floor(Number(options.columns) || 4));
  const rows = Math.max(1, Math.floor(Number(options.rows) || 4));
  const spriteWidth = Math.max(1, Math.floor(Number(options.spriteWidth) || 109));
  const spriteHeight = Math.max(1, Math.floor(Number(options.spriteHeight) || 114));
  const scale = Math.max(0.05, Number(options.scale) || 0.3);
  const drawWidth = Math.max(1, Math.round(spriteWidth * scale));
  const drawHeight = Math.max(1, Math.round(spriteHeight * scale));
  const sprites = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      sprites.push({
        id: `shrub_${row * columns + col + 1}`,
        x: col * spriteWidth,
        y: row * spriteHeight,
        w: drawWidth,
        h: drawHeight,
        sw: spriteWidth,
        sh: spriteHeight,
        weight: 1,
      });
    }
  }
  return sprites;
}

function getGapTileCandidates(world, exclusionPlacements, paddingTiles = 1) {
  const grid = world?.tileGrid;
  const tileSize = Math.max(1, Number(world?.tileSize) || 32);
  const candidates = [];
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) return candidates;
  const padding = Math.max(0, Math.floor(Number(paddingTiles) || 0)) * tileSize;

  for (let gy = 0; gy < grid.length; gy += 1) {
    for (let gx = 0; gx < grid[gy].length; gx += 1) {
      if (grid[gy][gx] === WALL) continue;
      const tileRect = {
        x: gx * tileSize - padding,
        y: gy * tileSize - padding,
        w: tileSize + padding * 2,
        h: tileSize + padding * 2,
      };
      const overlapsExcluded = exclusionPlacements.some((placement) => rectsOverlapInclusive(tileRect, placement));
      if (overlapsExcluded) continue;
      candidates.push({
        gx,
        gy,
        x: gx * tileSize,
        y: gy * tileSize,
      });
    }
  }
  return candidates;
}

export function buildOpenWorldShrubPlacements(world, seed, exclusionPlacements = [], options = {}) {
  const preferredCandidates = getGapTileCandidates(world, exclusionPlacements, options.gapTilePadding);
  const tileSize = Math.max(1, Number(world?.tileSize) || 32);
  const allCandidates = getAllWalkableTileCandidates(world);
  const candidates = allCandidates.length ? allCandidates : preferredCandidates;
  if (!candidates.length) return [];
  const sprites = buildShrubSprites(options);
  const rand = mulberry32((((Number(seed) || 0) ^ 0x13579bdf) >>> 0));
  const minCount = Math.max(0, Math.floor(Number(options.minCount) || 8));
  const maxCount = Math.max(minCount, Math.floor(Number(options.maxCount) || 28));
  const targetCount = Math.min(candidates.length, minCount + Math.floor(rand() * (maxCount - minCount + 1)));
  const preferredTargetCount = Math.min(
    preferredCandidates.length,
    Math.round(targetCount * Math.max(0, Math.min(1, Number(options.preferredGapRatio) || 0.8)))
  );
  const placements = [];
  const usedTiles = new Set();
  const clusterJitter = Math.max(0, Math.floor(Number(options.clusterJitter) || 4));
  const leadScale = Math.max(1, Number(options.clusterLeadScale) || 1.15);
  const clusterOffsets = [
    { dx: 0, dy: 0, slot: 'top' },
    { dx: -10, dy: 0, slot: 'left' },
    { dx: 10, dy: 0, slot: 'right' },
  ];

  const tryPlaceFromPool = (pool, desiredCount) => {
    for (let attempt = 0; attempt < pool.length * 4 && usedTiles.size < desiredCount; attempt += 1) {
      const candidate = pool[Math.floor(rand() * pool.length)];
      if (!candidate) break;
      const key = `${candidate.gx},${candidate.gy}`;
      if (usedTiles.has(key)) continue;
      const clusterPlacements = [];
      let validCluster = true;
      for (const offset of clusterOffsets) {
        const sprite = sprites[Math.floor(rand() * sprites.length)];
        if (!sprite) {
          validCluster = false;
          break;
        }
        const slotScale = offset.slot === 'top' ? leadScale : 1;
        const drawWidth = Math.max(1, Math.round(sprite.w * slotScale));
        const drawHeight = Math.max(1, Math.round(sprite.h * slotScale));
        const jitterX = clusterJitter ? Math.round((rand() * 2 - 1) * clusterJitter) : 0;
        const jitterY = clusterJitter ? Math.round((rand() * 2 - 1) * clusterJitter) : 0;
        const x = Math.round(candidate.x + (tileSize - drawWidth) / 2 + offset.dx + jitterX);
        const baselineY = candidate.y + (tileSize - 34) / 2 + 34;
        const y = Math.round(baselineY - drawHeight + offset.dy + jitterY);
        const rect = { x, y, w: drawWidth, h: drawHeight };
        if (!rectFitsWalkableFloor(world, rect)) {
          validCluster = false;
          break;
        }
        clusterPlacements.push({
          shrubId: sprite.id,
          clusterKey: key,
          clusterSlot: offset.slot,
          sortY: y + drawHeight + (offset.slot === 'top' ? 6 : -6),
          brightness: offset.slot === 'top' ? 1 : 0.88,
          x,
          y,
          w: drawWidth,
          h: drawHeight,
          sx: sprite.x,
          sy: sprite.y,
          sw: sprite.sw,
          sh: sprite.sh,
          gx: candidate.gx,
          gy: candidate.gy,
        });
      }
      if (!validCluster) continue;
      placements.push(...clusterPlacements);
      usedTiles.add(key);
    }
  };

  tryPlaceFromPool(preferredCandidates, preferredTargetCount);
  tryPlaceFromPool(candidates, targetCount);

  return placements;
}

function buildOpenWorldBoulderSprites(spriteConfigs = [], loadedImages = []) {
  return spriteConfigs.map((config, index) => {
    const image = loadedImages[index];
    const width = Math.max(1, Math.floor(Number(image?.naturalWidth || image?.width) || 1));
    const height = Math.max(1, Math.floor(Number(image?.naturalHeight || image?.height) || 1));
    return {
      id: config.id || `boulder_${index + 1}`,
      src: config.src,
      role: config.role || 'support',
      weight: Math.max(1, Number(config.weight) || 1),
      image,
      w: width,
      h: height,
      sx: 0,
      sy: 0,
      sw: width,
      sh: height,
    };
  }).filter((sprite) => sprite.image?.complete);
}

function chooseBoulderAnchors(preferredCandidates, allCandidates, desiredCount, minAnchorSpacing, preferredGapRatio, rand, tileSize) {
  const anchors = [];
  const minDistanceSq = Math.max(0, minAnchorSpacing) * Math.max(0, minAnchorSpacing);
  const tryPool = (pool, targetCount) => {
    if (!pool.length) return;
    const shuffled = pool.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rand() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    for (const candidate of shuffled) {
      if (anchors.length >= targetCount) break;
      const centerX = candidate.x + tileSize / 2;
      const centerY = candidate.y + tileSize / 2;
      const tooClose = anchors.some((anchor) => {
        const dx = anchor.centerX - centerX;
        const dy = anchor.centerY - centerY;
        return dx * dx + dy * dy < minDistanceSq;
      });
      if (tooClose) continue;
      anchors.push({
        ...candidate,
        centerX,
        centerY,
      });
    }
  };

  const preferredTarget = Math.max(0, Math.min(desiredCount, Math.round(desiredCount * preferredGapRatio)));
  tryPool(preferredCandidates, preferredTarget);
  tryPool(allCandidates, desiredCount);
  return anchors.slice(0, desiredCount);
}

function pickBoulderSpriteByRole(sprites, rand, roles) {
  const roleSet = new Set(Array.isArray(roles) ? roles : [roles]);
  const candidates = sprites.filter((sprite) => roleSet.has(sprite.role));
  return pickWeightedEntry(candidates.length ? candidates : sprites, rand);
}

export function buildOpenWorldBoulderPlacements(world, sprites, seed, exclusionPlacements = [], options = {}) {
  if (!Array.isArray(sprites) || !sprites.length) return [];
  const tileSize = Math.max(1, Number(world?.tileSize) || 32);
  const rand = mulberry32((((Number(seed) || 0) ^ 0x4b1d3a77) >>> 0));
  const preferredCandidates = getGapTileCandidates(world, exclusionPlacements, options.gapTilePadding);
  const allCandidates = getAllWalkableTileCandidates(world);
  const candidates = allCandidates.length ? allCandidates : preferredCandidates;
  if (!candidates.length) return [];

  const minClusters = Math.max(1, Math.floor(Number(options.minClusters) || 14));
  const maxClusters = Math.max(minClusters, Math.floor(Number(options.maxClusters) || 24));
  const desiredClusterCount = Math.min(candidates.length, minClusters + Math.floor(rand() * (maxClusters - minClusters + 1)));
  const preferredGapRatio = Math.max(0, Math.min(1, Number(options.preferredGapRatio) || 0.85));
  const minAnchorSpacing = Math.max(tileSize, Math.floor(Number(options.minAnchorSpacing) || 168));
  const minClusterSize = Math.max(1, Math.floor(Number(options.minClusterSize) || 2));
  const maxClusterSize = Math.max(minClusterSize, Math.floor(Number(options.maxClusterSize) || 5));
  const maxClusterRadius = Math.max(tileSize, Math.floor(Number(options.maxClusterRadius) || 84));
  const maxOverlapRatio = Math.max(0, Math.min(1, Number(options.maxOverlapRatio) || 0.1));

  const anchors = chooseBoulderAnchors(
    preferredCandidates,
    candidates,
    desiredClusterCount,
    minAnchorSpacing,
    preferredGapRatio,
    rand,
    tileSize
  );
  const placements = [];

  for (let clusterIndex = 0; clusterIndex < anchors.length; clusterIndex += 1) {
    const anchor = anchors[clusterIndex];
    const clusterId = `boulder_cluster_${clusterIndex + 1}`;
    const desiredClusterSize = minClusterSize + Math.floor(rand() * (maxClusterSize - minClusterSize + 1));
    const clusterStartIndex = placements.length;
    const leadSprite = pickBoulderSpriteByRole(sprites, rand, ['lead', 'support', 'chip']);
    if (!leadSprite) continue;
    const leadRect = {
      x: Math.round(anchor.centerX - leadSprite.w / 2),
      y: Math.round(anchor.centerY - leadSprite.h / 2),
      w: leadSprite.w,
      h: leadSprite.h,
    };
    if (rectFitsWalkableFloor(world, leadRect) && !overlapsTooMuch(leadRect, placements, maxOverlapRatio)) {
      placements.push({
        clusterId,
        spriteId: leadSprite.id,
        image: leadSprite.image,
        x: leadRect.x,
        y: leadRect.y,
        w: leadRect.w,
        h: leadRect.h,
        sx: leadSprite.sx,
        sy: leadSprite.sy,
        sw: leadSprite.sw,
        sh: leadSprite.sh,
      });
    }

    const clusterAngle = rand() * Math.PI * 2;
    for (let memberIndex = 1; memberIndex < desiredClusterSize; memberIndex += 1) {
      let placed = false;
      for (let attempt = 0; attempt < 8 && !placed; attempt += 1) {
        const rolePool = memberIndex === 1
          ? ['support', 'chip', 'lead']
          : rand() < 0.65
            ? ['chip', 'support']
            : ['support', 'chip', 'lead'];
        const sprite = pickBoulderSpriteByRole(sprites, rand, rolePool);
        if (!sprite) break;
        const radius = 18 + rand() * maxClusterRadius;
        const angle = clusterAngle + (rand() * 1.4 - 0.7) + memberIndex * 0.9;
        const rect = {
          x: Math.round(anchor.centerX + Math.cos(angle) * radius - sprite.w / 2),
          y: Math.round(anchor.centerY + Math.sin(angle) * radius - sprite.h / 2),
          w: sprite.w,
          h: sprite.h,
        };
        if (!rectFitsWalkableFloor(world, rect)) continue;
        if (overlapsTooMuch(rect, placements, maxOverlapRatio)) continue;
        placements.push({
          clusterId,
          spriteId: sprite.id,
          image: sprite.image,
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          sx: sprite.sx,
          sy: sprite.sy,
          sw: sprite.sw,
          sh: sprite.sh,
        });
        placed = true;
      }
    }
    const clusterPlacementCount = placements.length - clusterStartIndex;
    if (clusterPlacementCount < 2) {
      placements.length = clusterStartIndex;
    }
  }

  return placements;
}

export async function buildOpenWorldCosmeticFloor(world, seed, groundTypeId = 'grassA') {
  const groundType = getOpenWorldGroundType(groundTypeId);
  const baseSheetImage = groundType.baseSheetSrc ? await loadImage(groundType.baseSheetSrc) : null;
  const overlayLayerConfigs = Array.isArray(groundType.overlayLayers) ? groundType.overlayLayers : [];
  const flowerLayerConfig = groundType.flowerLayer || null;
  const shrubLayerConfig = groundType.shrubLayer || null;
  const boulderLayerConfig = groundType.boulderLayer || null;
  const overlayAssets = await Promise.all(
    overlayLayerConfigs.map(async (layerConfig) => {
      const [patchSheetImage, patchDefs] = await Promise.all([
        loadImage(layerConfig.patchSheetSrc),
        loadPatchDefs(layerConfig.patchDefsSrc),
      ]);
      return { layerConfig, patchSheetImage, patchDefs };
    })
  );
  const flowerLayer = flowerLayerConfig
    ? await Promise.all([
        loadImage(flowerLayerConfig.sheetSrc),
        fetch(flowerLayerConfig.defsSrc)
          .then((response) => {
            if (!response.ok) throw new Error(`Failed to load OpenWorld flower defs: ${flowerLayerConfig.defsSrc}`);
            return response.json();
          })
          .then((json) => parseOpenWorldFlowerFamilies(json)),
      ]).then(([sheetImage, families]) => ({
        sheetImage,
        families,
        placements: buildOpenWorldFlowerPlacements(world, families, seed, flowerLayerConfig),
        sheetSrc: flowerLayerConfig.sheetSrc,
        defsSrc: flowerLayerConfig.defsSrc,
      }))
    : null;
  const overlayLayers = [];
  for (let index = 0; index < overlayAssets.length; index += 1) {
    const { layerConfig, patchSheetImage, patchDefs } = overlayAssets[index];
    const placements = buildOpenWorldGroundPlacements(
      world,
      patchDefs,
      (((Number(seed) || 0) + index * 0x9e37) >>> 0),
      layerConfig
    );
    overlayLayers.push({
      id: layerConfig.id || `overlay_${index + 1}`,
      patchSheetImage,
      patchDefs,
      placements,
      patchSheetSrc: layerConfig.patchSheetSrc,
      patchDefsSrc: layerConfig.patchDefsSrc,
    });
  }
  const seamBreakupConfig = groundType.seamBreakup || null;
  const seamBreakupLayer = seamBreakupConfig
    ? overlayLayers.find((layer) => layer.id === seamBreakupConfig.layerId)
    : null;
  const firstLayerPlacements = overlayLayers.find((layer) => layer.id === 'grassA_1')?.placements || [];
  const shrubLayer = shrubLayerConfig
    ? await loadImage(shrubLayerConfig.sheetSrc).then((sheetImage) => ({
        sheetImage,
        placements: buildOpenWorldShrubPlacements(world, seed, firstLayerPlacements, shrubLayerConfig),
        sheetSrc: shrubLayerConfig.sheetSrc,
      }))
    : null;
  const boulderLayer = boulderLayerConfig
    ? await Promise.all((boulderLayerConfig.sprites || []).map((sprite) => loadImage(sprite.src)))
      .then((loadedImages) => buildOpenWorldBoulderSprites(boulderLayerConfig.sprites, loadedImages))
      .then((sprites) => ({
        sprites,
        placements: buildOpenWorldBoulderPlacements(world, sprites, seed, firstLayerPlacements, boulderLayerConfig),
      }))
    : null;
  const groundLayer = {
    baseColor: groundType.baseColor || null,
    baseSheetSrc: groundType.baseSheetSrc || null,
    baseCanvas: buildOpenWorldGroundBaseCanvas(world, baseSheetImage, seed, groundType),
    overlayLayers,
    flowerLayer,
    shrubLayer,
    boulderLayer,
  };
  if (groundLayer.baseCanvas && seamBreakupLayer) {
    const baseCtx = groundLayer.baseCanvas.getContext?.('2d');
    if (baseCtx) {
      stampChunkSeamBreakup(baseCtx, groundLayer.baseCanvas, seed, groundType, {
        ...seamBreakupConfig,
        patchSheetImage: seamBreakupLayer.patchSheetImage,
        patchDefs: seamBreakupLayer.patchDefs,
      });
    }
  }
  groundLayer.detailCanvas = buildOpenWorldGroundDetailCanvas(world, groundLayer);
  return {
    groundTypeId: groundType.id,
    groundLayer,
  };
}

function drawGroundCanvasSlice(ctx, canvas, ox, oy, camera) {
  if (!canvas || !camera) return false;
  const sx = Math.max(0, Math.floor(camera.position.x));
  const sy = Math.max(0, Math.floor(camera.position.y));
  const sw = Math.min(Math.ceil(camera.viewWidth), canvas.width - sx);
  const sh = Math.min(Math.ceil(camera.viewHeight), canvas.height - sy);
  if (sw <= 0 || sh <= 0) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    canvas,
    sx,
    sy,
    sw,
    sh,
    Math.round(ox + sx),
    Math.round(oy + sy),
    sw,
    sh
  );
  ctx.restore();
  return true;
}

export function drawOpenWorldGroundBase(ctx, groundLayer, ox, oy, camera) {
  return drawGroundCanvasSlice(ctx, groundLayer?.baseCanvas, ox, oy, camera);
}

export function drawOpenWorldGroundDetails(ctx, groundLayer, ox, oy, camera) {
  return drawGroundCanvasSlice(ctx, groundLayer?.detailCanvas, ox, oy, camera);
}

export function drawOpenWorldGroundPatches(ctx, groundLayer, ox, oy, camera) {
  if (!camera || !Array.isArray(groundLayer?.overlayLayers)) return;
  const viewLeft = camera.position.x;
  const viewTop = camera.position.y;
  const viewRight = viewLeft + camera.viewWidth;
  const viewBottom = viewTop + camera.viewHeight;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const overlayLayer of groundLayer.overlayLayers) {
    if (!overlayLayer?.patchSheetImage?.complete || !Array.isArray(overlayLayer.placements)) continue;
    for (const placement of overlayLayer.placements) {
      if (placement.x + placement.w < viewLeft || placement.x > viewRight || placement.y + placement.h < viewTop || placement.y > viewBottom) {
        continue;
      }
      ctx.drawImage(
        overlayLayer.patchSheetImage,
        placement.sx,
        placement.sy,
        placement.sw,
        placement.sh,
        Math.round(ox + placement.x),
        Math.round(oy + placement.y),
        placement.w,
        placement.h
      );
    }
  }
  ctx.restore();
}

export function drawOpenWorldFlowerLayer(ctx, groundLayer, ox, oy, camera) {
  const flowerLayer = groundLayer?.flowerLayer;
  if (!camera || !flowerLayer?.sheetImage?.complete || !Array.isArray(flowerLayer.placements)) return;
  const viewLeft = camera.position.x;
  const viewTop = camera.position.y;
  const viewRight = viewLeft + camera.viewWidth;
  const viewBottom = viewTop + camera.viewHeight;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const placement of flowerLayer.placements) {
    if (placement.x + placement.w < viewLeft || placement.x > viewRight || placement.y + placement.h < viewTop || placement.y > viewBottom) {
      continue;
    }
    ctx.drawImage(
      flowerLayer.sheetImage,
      placement.sx,
      placement.sy,
      placement.sw,
      placement.sh,
      Math.round(ox + placement.x),
      Math.round(oy + placement.y),
      placement.w,
      placement.h
    );
  }
  ctx.restore();
}

export function getVisibleOpenWorldShrubPlacements(groundLayer, camera) {
  const shrubLayer = groundLayer?.shrubLayer;
  if (!camera || !shrubLayer?.sheetImage?.complete || !Array.isArray(shrubLayer.placements)) return [];
  const viewLeft = camera.position.x;
  const viewTop = camera.position.y;
  const viewRight = viewLeft + camera.viewWidth;
  const viewBottom = viewTop + camera.viewHeight;
  return shrubLayer.placements
    .filter((placement) => !(
      placement.x + placement.w < viewLeft ||
      placement.x > viewRight ||
      placement.y + placement.h < viewTop ||
      placement.y > viewBottom
    ))
    .slice()
    .sort((a, b) => (a.sortY ?? (a.y + a.h)) - (b.sortY ?? (b.y + b.h)));
}

export function getVisibleOpenWorldBoulderPlacements(groundLayer, camera) {
  const boulderLayer = groundLayer?.boulderLayer;
  if (!camera || !Array.isArray(boulderLayer?.placements)) return [];
  const viewLeft = camera.position.x;
  const viewTop = camera.position.y;
  const viewRight = viewLeft + camera.viewWidth;
  const viewBottom = viewTop + camera.viewHeight;
  return boulderLayer.placements
    .filter((placement) => !(
      placement.x + placement.w < viewLeft ||
      placement.x > viewRight ||
      placement.y + placement.h < viewTop ||
      placement.y > viewBottom
    ))
    .slice()
    .sort((a, b) => (a.y + a.h) - (b.y + b.h));
}

export function drawOpenWorldShrubLayer(ctx, groundLayer, ox, oy, camera) {
  const shrubLayer = groundLayer?.shrubLayer;
  const visiblePlacements = getVisibleOpenWorldShrubPlacements(groundLayer, camera);
  if (!visiblePlacements.length || !shrubLayer?.sheetImage?.complete) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const placement of visiblePlacements) {
    if (placement.brightness && placement.brightness !== 1) {
      ctx.filter = `brightness(${placement.brightness})`;
    } else {
      ctx.filter = 'none';
    }
    ctx.drawImage(
      shrubLayer.sheetImage,
      placement.sx,
      placement.sy,
      placement.sw,
      placement.sh,
      Math.round(ox + placement.x),
      Math.round(oy + placement.y),
      placement.w,
      placement.h
    );
  }
  ctx.filter = 'none';
  ctx.restore();
}
