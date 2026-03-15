// src/home-base/mainlevbuild-atlas-map.js
// Atlas: Forest Land mainlevbuild.png — 32×32 tile grid, 0-based (tx, ty).
// Regions use tile coords: { tx, ty } for single tile, { tx, ty, tw, th } for multi-tile.

export const MAINLEVBUILD_TILE_SIZE = 32;

export const MAINLEVBUILD_ATLAS = {
  image: 'assets/Environments/Forest Land/mainlevbuild.png',
  tileSize: MAINLEVBUILD_TILE_SIZE,
  cols: 50,
  rows: 40,

  regions: {
    // ------------------------------------------------------------------
    // LEFT COLUMN (tx 0–7): large raised structures, archway + block below
    // ------------------------------------------------------------------
    raisedPlatformTop: { tx: 0, ty: 0, tw: 8, th: 10 },
    raisedPlatformBottom: { tx: 0, ty: 10, tw: 8, th: 10 },

    // Small ledge to the right of top structure
    ledgeSmall: { tx: 8, ty: 0, tw: 2, th: 2 },

    // Cliff / modular pieces (corners, bridge)
    cliffInsetNW: { tx: 8, ty: 16, tw: 2, th: 2 },
    cliffInsetNE: { tx: 10, ty: 16, tw: 2, th: 2 },
    cliffBridgeVertical: { tx: 12, ty: 16, tw: 2, th: 3 },

    // ------------------------------------------------------------------
    // TOP BAND (ty 0–7): long grass strips — uniform fill for floor
    // ------------------------------------------------------------------
    grassFieldA: { tx: 11, ty: 0, tw: 14, th: 8 },
    grassFieldB: { tx: 25, ty: 0, tw: 14, th: 8 },

    // Right end of top band: soft rounded ground (no overlap with canopy)
    softGroundRoundedA: { tx: 39, ty: 0, tw: 4, th: 8 },
    softGroundRoundedB: { tx: 39, ty: 8, tw: 4, th: 8 },

    // ------------------------------------------------------------------
    // ROW ty 9: irregular dirt/grass patches (five–six patches)
    // ------------------------------------------------------------------
    dirtPadTanA: { tx: 11, ty: 9, tw: 6, th: 6 },
    dirtPadBrown: { tx: 17, ty: 9, tw: 6, th: 6 },
    dirtPadTanB: { tx: 23, ty: 9, tw: 6, th: 6 },
    grassPadLight: { tx: 29, ty: 9, tw: 6, th: 6 },
    grassPadDark: { tx: 35, ty: 9, tw: 6, th: 6 },
    grassPadPale: { tx: 41, ty: 9, tw: 6, th: 6 },

    // ------------------------------------------------------------------
    // ty 16–31: two square grass tiles then wide grass; below it darker wide grass
    // ------------------------------------------------------------------
    grassTwoSquares: { tx: 11, ty: 16, tw: 2, th: 2 },
    grassFillLargeA: { tx: 14, ty: 16, tw: 14, th: 8 },
    grassFillLargeB: { tx: 14, ty: 24, tw: 14, th: 8 },

    // ------------------------------------------------------------------
    // RIGHT SIDE (tx 33–39 and 43–49): 2×2 grid of circular bushes/canopy
    // ------------------------------------------------------------------
    canopyTopLeft: { tx: 33, ty: 16, tw: 7, th: 7 },
    canopyTopRight: { tx: 43, ty: 16, tw: 7, th: 7 },
    canopyBottomLeft: { tx: 33, ty: 24, tw: 7, th: 7 },
    canopyBottomRight: { tx: 43, ty: 24, tw: 7, th: 7 },

    // ------------------------------------------------------------------
    // BOTTOM LEFT: dark mask / cliff / holes
    // ------------------------------------------------------------------
    cliffMaskDarkA: { tx: 0, ty: 20, tw: 8, th: 12 },
    cliffMaskDarkB: { tx: 0, ty: 33, tw: 8, th: 7 },
    smallHole: { tx: 1, ty: 35, tw: 2, th: 2 },

    // ------------------------------------------------------------------
    // BOTTOM BAND (ty 33): rounded ground pads
    // ------------------------------------------------------------------
    mossPadRoundedA: { tx: 8, ty: 33, tw: 6, th: 4 },
    dirtPadRoundedA: { tx: 14, ty: 33, tw: 6, th: 4 },
    mossPadRoundedB: { tx: 20, ty: 33, tw: 6, th: 4 },
    dirtPadRoundedB: { tx: 26, ty: 33, tw: 6, th: 4 },
  },
};

export function getMainlevbuildRect(region) {
  const r =
    typeof region === 'string'
      ? MAINLEVBUILD_ATLAS.regions[region]
      : region;

  if (!r) {
    throw new Error(`Unknown mainlevbuild atlas region: ${region}`);
  }

  const { tx, ty, tw = 1, th = 1 } = r;
  const size = MAINLEVBUILD_TILE_SIZE;

  return {
    sx: tx * size,
    sy: ty * size,
    sw: tw * size,
    sh: th * size,
  };
}

/** First GID (1-based) for the top-left tile of a region. Used when terrain grid stores raw GIDs. */
export function getFirstGidForRegion(regionName) {
  const r = MAINLEVBUILD_ATLAS.regions[regionName];
  if (!r) return 1;
  const tx = r.tx ?? 0;
  const ty = r.ty ?? 0;
  return 1 + tx + ty * MAINLEVBUILD_ATLAS.cols;
}