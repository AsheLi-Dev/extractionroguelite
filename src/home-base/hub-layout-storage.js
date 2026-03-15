// src/home-base/hub-layout-storage.js
// Load/save hub layout (atlasProps + imageProps positions) so the editor can persist changes.

const STORAGE_KEY = "hub-layout-custom";

/**
 * Load saved layout from localStorage. Returns null if none.
 * @returns {{ atlasProps?: Array<{ id: string, x: number, y: number }>, imageProps?: Array<{ id: string, x: number, y: number }> } | null}
 */
export function loadHubLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save current atlasProps and imageProps (id, x, y, and full prop for add/remove) to localStorage.
 * @param {{ atlasProps: Array, imageProps: Array }} layout
 */
export function saveHubLayout(layout) {
  try {
    const data = {
      atlasProps: (layout.atlasProps || []).map((p) => ({
        id: p.id,
        x: Number(p.x),
        y: Number(p.y),
        w: p.w,
        h: p.h,
        atlas: p.atlas,
        row: p.row,
        col: p.col,
        layer: p.layer
      })),
      imageProps: (layout.imageProps || []).map((p) => ({
        id: p.id,
        x: Number(p.x),
        y: Number(p.y),
        w: p.w,
        h: p.h,
        aspectRatio: p.aspectRatio,
        layer: p.layer,
        src: p.src
      })),
      mainlevbuildProps: (layout.mainlevbuildProps || []).map((p) => ({
        id: p.id,
        region: p.region,
        x: Number(p.x),
        y: Number(p.y),
        w: p.w,
        h: p.h
      })),
      terrainGrid: layout.terrainGrid || null,
      collisionBoxes: (layout.collisionBoxes || []).map((b) => ({
        id: b.id,
        x: Number(b.x),
        y: Number(b.y),
        w: Number(b.w),
        h: Number(b.h)
      })),
      interactables: (layout.interactables || []).map((i) => ({
        id: i.id,
        x: Number(i.x),
        y: Number(i.y),
        w: Number(i.w),
        h: Number(i.h)
      }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply saved layout: replace atlasProps, imageProps, and mainlevbuildProps with saved
 * so that positions, sizes, and deletions all persist after Save layout.
 */
export function mergeHubLayoutInto(layout, saved) {
  if (!saved) return;
  if (saved.atlasProps && Array.isArray(saved.atlasProps)) {
    layout.atlasProps = saved.atlasProps.map((p) => ({
      id: p.id,
      x: Number(p.x),
      y: Number(p.y),
      w: p.w,
      h: p.h,
      atlas: p.atlas,
      row: p.row,
      col: p.col,
      layer: p.layer
    }));
  }
  if (saved.imageProps && Array.isArray(saved.imageProps)) {
    layout.imageProps = saved.imageProps.map((p) => ({
      id: p.id,
      x: Number(p.x),
      y: Number(p.y),
      w: p.w,
      h: p.h,
      aspectRatio: p.aspectRatio,
      layer: p.layer,
      src: p.src
    }));
  }
  if (saved.mainlevbuildProps && Array.isArray(saved.mainlevbuildProps)) {
    layout.mainlevbuildProps = saved.mainlevbuildProps.map((p) => ({
      id: p.id,
      region: p.region,
      x: Number(p.x),
      y: Number(p.y),
      w: Number.isFinite(p.w) ? p.w : 32,
      h: Number.isFinite(p.h) ? p.h : 32
    }));
  }
  if (saved.terrainGrid && Array.isArray(saved.terrainGrid)) {
    layout.terrainGrid = saved.terrainGrid.map((row) => (Array.isArray(row) ? row.slice() : []));
  }
  if (saved.collisionBoxes && Array.isArray(saved.collisionBoxes)) {
    layout.collisionBoxes = saved.collisionBoxes.map((b) => ({
      id: b.id || `box-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: Number(b.x),
      y: Number(b.y),
      w: Math.max(16, Number(b.w) || 32),
      h: Math.max(16, Number(b.h) || 32)
    }));
  }
  if (saved.interactables && Array.isArray(saved.interactables) && layout.interactables) {
    for (const s of saved.interactables) {
      const i = layout.interactables.find((x) => x.id === s.id);
      if (i) {
        i.x = Number(s.x);
        i.y = Number(s.y);
        i.w = Math.max(16, Number(s.w) || 96);
        i.h = Math.max(16, Number(s.h) || 64);
      }
    }
    for (const area of layout.areas || []) {
      const i = layout.interactables.find((x) => x.id === area.interactableId);
      if (i && area.padX != null && area.padY != null) {
        area.x = i.x - area.padX;
        area.y = i.y - area.padY;
        area.w = i.w + area.padX * 2;
        area.h = i.h + area.padY * 2;
      }
    }
  }
}
