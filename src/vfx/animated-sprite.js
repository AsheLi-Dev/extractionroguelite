import { assetUrl } from "../utils.js";

const animatedSpriteImageCache = new Map();

export function getAnimatedSpriteImage(path) {
  const key = String(path || '').trim();
  if (!key) return null;
  if (!animatedSpriteImageCache.has(key)) {
    const img = new Image();
    img.src = assetUrl(key);
    animatedSpriteImageCache.set(key, img);
  }
  return animatedSpriteImageCache.get(key);
}

export function normalizeAnimatedSpriteConfig(animatedSprite, options = {}) {
  if (!animatedSprite?.path) return null;
  const defaultDrawWidth = Math.max(1, Number(options.defaultDrawWidth) || Number(options.defaultDrawSize) || 16);
  const defaultDrawHeight = Math.max(1, Number(options.defaultDrawHeight) || Number(options.defaultDrawSize) || defaultDrawWidth);
  return {
    path: String(animatedSprite.path),
    frameWidth: Math.max(1, Number(animatedSprite.frameWidth) || 0),
    frameHeight: Math.max(1, Number(animatedSprite.frameHeight) || 0),
    frameCount: Math.max(1, Math.floor(Number(animatedSprite.frameCount) || 1)),
    startFrame: Math.max(0, Math.floor(Number(animatedSprite.startFrame) || 0)),
    fps: Math.max(1, Number(animatedSprite.fps) || 12),
    loop: animatedSprite.loop !== false,
    rotateWithVelocity: animatedSprite.rotateWithVelocity !== false,
    baseAngleRad: Number(animatedSprite.baseAngleRad) || 0,
    anchorX: Number.isFinite(animatedSprite.anchorX) ? animatedSprite.anchorX : 0.5,
    anchorY: Number.isFinite(animatedSprite.anchorY) ? animatedSprite.anchorY : 0.5,
    drawWidth: Math.max(1, Number(animatedSprite.drawWidth) || defaultDrawWidth),
    drawHeight: Math.max(1, Number(animatedSprite.drawHeight) || defaultDrawHeight),
    offsetForward: Number(animatedSprite.offsetForward) || 0,
    offsetLateral: Number(animatedSprite.offsetLateral) || 0,
    columns: Math.max(0, Math.floor(Number(animatedSprite.columns) || 0))
  };
}

export function getAnimatedSpriteFrameIndex(elapsed, sprite) {
  const safeElapsed = Math.max(0, Number(elapsed) || 0);
  const fps = Math.max(1, Number(sprite?.fps) || 12);
  const frameCount = Math.max(1, Math.floor(Number(sprite?.frameCount) || 1));
  const rawFrame = Math.floor(safeElapsed * fps);
  return sprite?.loop === false
    ? Math.min(frameCount - 1, rawFrame)
    : rawFrame % frameCount;
}

function getAnimatedSpriteColumns(sprite, image) {
  const explicitColumns = Math.max(0, Math.floor(Number(sprite?.columns) || 0));
  if (explicitColumns > 0) return explicitColumns;
  const frameWidth = Math.max(1, Number(sprite?.frameWidth) || 0);
  const naturalWidth = Number(image?.naturalWidth || image?.width) || 0;
  if (naturalWidth > 0 && frameWidth > 0) {
    return Math.max(1, Math.floor(naturalWidth / frameWidth));
  }
  return Math.max(1, Math.floor(Number(sprite?.frameCount) || 1));
}

export function drawAnimatedSpriteFrame(ctx, options = {}) {
  const image = options.image;
  const sprite = options.sprite;
  if (!ctx || !image || !sprite) return false;
  if ((image.complete === false) || (image.naturalWidth != null && image.naturalWidth <= 0)) return false;

  const frameWidth = Math.max(1, Number(sprite.frameWidth) || 0);
  const frameHeight = Math.max(1, Number(sprite.frameHeight) || 0);
  const frameCount = Math.max(1, Math.floor(Number(sprite.frameCount) || 1));
  const columns = getAnimatedSpriteColumns(sprite, image);
  const frameIndex = Number.isFinite(options.frameIndex)
    ? Math.max(0, Math.min(frameCount - 1, Math.floor(options.frameIndex)))
    : getAnimatedSpriteFrameIndex(options.elapsed, sprite);
  const sourceFrameIndex = Math.max(0, Math.floor(Number(sprite.startFrame) || 0)) + frameIndex;
  const srcX = (sourceFrameIndex % columns) * frameWidth;
  const srcY = Math.floor(sourceFrameIndex / columns) * frameHeight;
  const naturalWidth = Number(image.naturalWidth || image.width) || 0;
  const naturalHeight = Number(image.naturalHeight || image.height) || 0;
  if (srcX + frameWidth > naturalWidth || srcY + frameHeight > naturalHeight) return false;

  const drawWidth = Math.max(1, Number(sprite.drawWidth) || frameWidth);
  const drawHeight = Math.max(1, Number(sprite.drawHeight) || frameHeight);
  const anchorX = Number.isFinite(sprite.anchorX) ? sprite.anchorX : 0.5;
  const anchorY = Number.isFinite(sprite.anchorY) ? sprite.anchorY : 0.5;
  const drawX = -drawWidth * anchorX;
  const drawY = -drawHeight * anchorY;
  const prevSmoothing = ctx.imageSmoothingEnabled;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Number(options.centerX) || 0, Number(options.centerY) || 0);
  ctx.rotate(Number(options.angle) || 0);
  if (options.flipX === true) ctx.scale(-1, 1);
  ctx.drawImage(
    image,
    srcX,
    srcY,
    frameWidth,
    frameHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  ctx.restore();

  ctx.imageSmoothingEnabled = prevSmoothing;
  return true;
}
