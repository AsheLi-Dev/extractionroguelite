import { assetUrl } from '../utils.js';

const DIRECTION_ORDER = ['right', 'right_down', 'down', 'left_down', 'left', 'left_up', 'up', 'right_up'];

/**
 * @param {number} dx world X toward target (e.g. player − enemy)
 * @param {number} dy world Y toward target
 */
export function getHeroPackDirectionIndexFromWorld(dx, dy) {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 2;
  const angle = Math.atan2(dy, dx);
  const TAU = Math.PI * 2;
  const angleNorm = ((angle % TAU) + TAU) % TAU;
  return Math.floor((angleNorm + Math.PI / 8) / (Math.PI / 4)) % 8;
}

/**
 * Match player directional spritesheet mirroring (see Player._shouldFlipDirection).
 * @param {number} directionIndex 0..7 matching DIRECTION_ORDER
 * @param {boolean} mirrorLeftFacing same semantics as hero spriteProfile + player constructor
 */
export function mirrorHeroPackDirectionForRow(directionIndex, mirrorLeftFacing) {
  if (!mirrorLeftFacing) return { rowIndex: directionIndex, flipH: false };
  const dir = DIRECTION_ORDER[directionIndex];
  const map = {
    left: 'right',
    left_down: 'right_down',
    left_up: 'right_up'
  };
  const alt = map[dir];
  if (alt) {
    return { rowIndex: DIRECTION_ORDER.indexOf(alt), flipH: true };
  }
  return { rowIndex: directionIndex, flipH: false };
}

export function getHeroPackLoopLength(spriteProfile, profileStateKey, sheetFrames) {
  const seq = spriteProfile?.loopSequence?.[profileStateKey];
  if (Array.isArray(seq) && seq.length > 0) return seq.length;
  const configured = Number(spriteProfile?.loopFrames?.[profileStateKey]);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(1, Math.min(sheetFrames, Math.floor(configured)));
  }
  return Math.max(1, sheetFrames);
}

export function mapHeroPackColumn(spriteProfile, profileStateKey, logicalFrame) {
  const seq = spriteProfile?.loopSequence?.[profileStateKey];
  if (Array.isArray(seq) && seq.length > 0) {
    const idx = ((logicalFrame % seq.length) + seq.length) % seq.length;
    return seq[idx];
  }
  return logicalFrame;
}

/**
 * Build enemy spriteSheets (idle / move / attack) from a hero directional_spritesheet profile.
 * @param {import('../data/playable-characters.js').DirectionalSpritesheetProfile} spriteProfile
 */
export function buildHeroPackEnemySpriteSheets(spriteProfile) {
  const base = (spriteProfile.basePath || '').replace(/\/$/, '');
  const states = spriteProfile.states || {};
  const framesMap = spriteProfile.frames || {};
  const rowCount = spriteProfile.rowCount || 8;
  const cache = new Map();

  const loadImage = (fullPath) => {
    let img = cache.get(fullPath);
    if (!img) {
      img = new Image();
      img.src = assetUrl(fullPath);
      cache.set(fullPath, img);
    }
    return img;
  };

  const add = (out, enemyAnimKey, profileKey, defaultFps, loopDefault = true) => {
    const fileStem = states[profileKey];
    if (!fileStem) return;
    const fc = Math.max(1, Number(framesMap[profileKey]) || Number(framesMap[enemyAnimKey]) || 15);
    const path = `${base}/${fileStem}.png`;
    out[enemyAnimKey] = {
      image: loadImage(path),
      frames: fc,
      row: 2,
      totalRows: rowCount,
      fps: defaultFps,
      loop: loopDefault,
      heroPackDirectional: true,
      profileStateKey: profileKey
    };
  };

  const out = {};
  add(out, 'idle', 'idle', 8);
  if (states.run) add(out, 'move', 'run', 12);
  else add(out, 'move', 'walk', 12);
  const multi = spriteProfile.enemyMultiAttackSheets;
  if (Array.isArray(multi) && multi.length > 0) {
    for (const entry of multi) {
      const animKey = entry?.animKey;
      const profileKey = entry?.profileKey;
      if (animKey && profileKey) {
        add(out, animKey, profileKey, Math.max(1, Number(entry.fps) || 14), false);
      }
    }
  } else {
    add(out, 'attack', 'attack', 14, false);
  }
  const extra = spriteProfile.enemySpecialSheets;
  if (Array.isArray(extra) && extra.length > 0) {
    for (const entry of extra) {
      const animKey = entry?.animKey;
      const profileKey = entry?.profileKey;
      if (animKey && profileKey) {
        add(out, animKey, profileKey, Math.max(1, Number(entry.fps) || 14), false);
      }
    }
  }
  return out;
}
