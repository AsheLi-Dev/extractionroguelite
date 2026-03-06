export const NINE_SLICE_PRESETS = {
  UI_TravelBook_Popup01a: { left: 4, right: 4, top: 4, bottom: 4 },
  ui_travelbook_banner: { left: 6, right: 6, top: 6, bottom: 6 },
  ui_travelbook_cover_frame: { left: 8, right: 8, top: 8, bottom: 8 },
  ui_travelbook_page: { left: 6, right: 6, top: 6, bottom: 6 },
};

export function setPixelArtSmoothing(ctx, enabled = false) {
  if (!ctx) return;
  ctx.imageSmoothingEnabled = !!enabled;
}

export function drawNineSlice(
  ctx,
  texture,
  x,
  y,
  width,
  height,
  left,
  right,
  top,
  bottom
) {
  if (!ctx || !texture) return;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const texW = texture.naturalWidth || texture.width || 0;
  const texH = texture.naturalHeight || texture.height || 0;
  if (texW <= 0 || texH <= 0) return;

  const l = Math.max(0, Math.min(left || 0, texW));
  const r = Math.max(0, Math.min(right || 0, texW - l));
  const t = Math.max(0, Math.min(top || 0, texH));
  const b = Math.max(0, Math.min(bottom || 0, texH - t));

  const centerSW = Math.max(0, texW - l - r);
  const centerSH = Math.max(0, texH - t - b);

  const dx0 = x;
  const dx1 = x + l;
  const dx2 = x + Math.max(l, width - r);
  const dy0 = y;
  const dy1 = y + t;
  const dy2 = y + Math.max(t, height - b);

  const centerDW = Math.max(0, width - l - r);
  const centerDH = Math.max(0, height - t - b);
  const rightDW = Math.max(0, width - (dx2 - x));
  const bottomDH = Math.max(0, height - (dy2 - y));

  const draw = (sx, sy, sw, sh, dx, dy, dw, dh) => {
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    ctx.drawImage(texture, sx, sy, sw, sh, dx, dy, dw, dh);
  };

  // TL, T, TR
  draw(0, 0, l, t, dx0, dy0, l, t);
  draw(l, 0, centerSW, t, dx1, dy0, centerDW, t);
  draw(texW - r, 0, r, t, dx2, dy0, rightDW, t);

  // L, C, R
  draw(0, t, l, centerSH, dx0, dy1, l, centerDH);
  draw(l, t, centerSW, centerSH, dx1, dy1, centerDW, centerDH);
  draw(texW - r, t, r, centerSH, dx2, dy1, rightDW, centerDH);

  // BL, B, BR
  draw(0, texH - b, l, b, dx0, dy2, l, bottomDH);
  draw(l, texH - b, centerSW, b, dx1, dy2, centerDW, bottomDH);
  draw(texW - r, texH - b, r, b, dx2, dy2, rightDW, bottomDH);
}
