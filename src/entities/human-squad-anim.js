// -------- Human Squad animation: state machine + sprite strip frame advance --------
// States: idle, run, attack, heal (monk only). Non-loop states call onComplete when done.

import { HUMAN_SQUAD_SHEET_PATHS, HUMAN_SQUAD_ANIM_DEFAULTS } from "../data/human-squad-data.js";

const sheetCache = {};
let loadCallbacks = [];

function parseFrameCountFromPath(path) {
  const m = /_(\d+)x(\d+)\.png$/i.exec(String(path || ""));
  if (!m) return 0;
  const cols = Number(m[1]) || 0;
  const rows = Number(m[2]) || 0;
  if (cols <= 0 || rows <= 0) return 0;
  return cols * rows;
}

function inferFrameCount(img, frameW) {
  if (!img || !img.naturalWidth) return 0;
  const w = img.naturalWidth;
  const h = img.naturalHeight || frameW;
  if (h <= 0) return 0;
  const fw = frameW || h;
  return Math.max(1, Math.floor(w / fw));
}

export function loadHumanSquadSheets(callback) {
  const allPaths = new Set();
  Object.values(HUMAN_SQUAD_SHEET_PATHS).forEach((sheets) => {
    Object.values(sheets).forEach((p) => allPaths.add(p));
  });
  let remaining = allPaths.size;
  if (remaining === 0) {
    callback?.();
    return;
  }
  function onOneLoad() {
    remaining--;
    if (remaining <= 0) callback?.();
  }
  allPaths.forEach((path) => {
    if (sheetCache[path]) {
      onOneLoad();
      return;
    }
    const img = new Image();
    img.onload = () => {
      sheetCache[path] = img;
      onOneLoad();
    };
    img.onerror = () => {
      onOneLoad();
    };
    img.src = path;
  });
}

export function getSheet(path) {
  return sheetCache[path] || null;
}

export function getSheetFrameCount(path, frameW) {
  const img = sheetCache[path];
  if (!img) return 0;
  const parsedCount = parseFrameCountFromPath(path);
  if (parsedCount > 0) return parsedCount;
  const h = img.naturalHeight || 32;
  const fw = frameW || h;
  return inferFrameCount(img, fw);
}

/**
 * Create anim state for an enemy. Call updateHumanSquadAnim(enemy, dt) each frame and
 * read enemy.humanAnimState for drawing.
 */
export function createHumanSquadAnimState(enemyId) {
  const sheets = HUMAN_SQUAD_SHEET_PATHS[enemyId];
  if (!sheets) return null;
  const defaults = HUMAN_SQUAD_ANIM_DEFAULTS;
  return {
    state: "idle",
    frameIndex: 0,
    timer: 0,
    frameW: 0,
    frameH: 0,
    frameCount: 0,
    sheetKey: "idle",
    fps: defaults.idle.fps,
    loop: true,
    onComplete: null,
    _enemyId: enemyId,
    _defaults: defaults,
    _sheets: sheets,
  };
}

function getStateConfig(animState, stateKey) {
  const def = animState._defaults[stateKey];
  return def || { fps: 12, loop: true };
}

function resolveSheetPath(animState, sheetKey) {
  const path = animState._sheets[sheetKey];
  return path || null;
}

function measureSheet(animState, sheetKey) {
  const path = resolveSheetPath(animState, sheetKey);
  const img = path ? getSheet(path) : null;
  if (!img || !img.naturalWidth) return { frameW: 32, frameH: 32, frameCount: 1 };
  const frameH = img.naturalHeight || 32;
  const parsedCount = parseFrameCountFromPath(path);
  const frameCount = parsedCount > 0 ? parsedCount : inferFrameCount(img, frameH);
  const frameW = Math.max(1, Math.floor(img.naturalWidth / Math.max(1, frameCount)));
  return { frameW, frameH, frameCount };
}

/**
 * Set state (idle, run, attack, heal). For attack/heal, onComplete will be called when animation finishes.
 */
export function setHumanSquadAnimState(enemy, stateKey, onComplete = null) {
  const a = enemy.humanAnimState;
  if (!a || !a._sheets[stateKey]) return;
  a.state = stateKey;
  a.sheetKey = stateKey;
  a.frameIndex = 0;
  a.timer = 0;
  const cfg = getStateConfig(a, stateKey);
  a.fps = cfg.fps;
  a.loop = !!cfg.loop;
  a.onComplete = onComplete;
  const m = measureSheet(a, stateKey);
  a.frameW = m.frameW;
  a.frameH = m.frameH;
  a.frameCount = m.frameCount;
}

/**
 * Advance animation by dt. Call from Enemy.update when enemy has humanAnimState.
 */
export function updateHumanSquadAnim(enemy, dt) {
  const a = enemy.humanAnimState;
  if (!a) return;
  const path = resolveSheetPath(a, a.sheetKey);
  if (!path) return;
  const img = getSheet(path);
  if (!img) return;
  if (a.frameW <= 0 || a.frameH <= 0) {
    const m = measureSheet(a, a.sheetKey);
    a.frameW = m.frameW;
    a.frameH = m.frameH;
    a.frameCount = m.frameCount;
  }
  const frameDur = 1 / Math.max(1, a.fps);
  a.timer += dt;
  while (a.timer >= frameDur && a.frameCount > 0) {
    a.timer -= frameDur;
    a.frameIndex++;
    if (a.frameIndex >= a.frameCount) {
      if (a.loop) {
        a.frameIndex = 0;
      } else {
        a.frameIndex = a.frameCount - 1;
        if (a.onComplete) {
          a.onComplete();
          a.onComplete = null;
        }
        a.state = "idle";
        a.sheetKey = "idle";
        const idleCfg = getStateConfig(a, "idle");
        a.fps = idleCfg.fps;
        a.loop = true;
        const m = measureSheet(a, "idle");
        a.frameW = m.frameW;
        a.frameH = m.frameH;
        a.frameCount = m.frameCount;
        a.frameIndex = 0;
        break;
      }
    }
  }
}

/**
 * Get current frame info for drawing: { image, frameIndex, frameW, frameH, frameCount }.
 */
export function getHumanSquadAnimFrame(enemy) {
  const a = enemy.humanAnimState;
  if (!a) return null;
  const path = resolveSheetPath(a, a.sheetKey);
  const img = path ? getSheet(path) : null;
  if (!img) return null;
  return {
    image: img,
    frameIndex: Math.min(a.frameIndex, Math.max(0, a.frameCount - 1)),
    frameW: a.frameW || img.naturalHeight || 32,
    frameH: a.frameH || img.naturalHeight || 32,
    frameCount: a.frameCount || 1,
  };
}
