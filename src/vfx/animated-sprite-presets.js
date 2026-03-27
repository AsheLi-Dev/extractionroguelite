import { normalizeAnimatedSpriteConfig } from './animated-sprite.js';

export const ANIMATED_SPRITE_PRESETS = {
  ghostOrb: {
    path: 'assets/Projectiles/sprGhostOrb.png',
    frameWidth: 18,
    frameHeight: 12,
    frameCount: 8,
    fps: 12,
    loop: true,
    rotateWithVelocity: true,
    baseAngleRad: 0,
    anchorX: 0.5,
    anchorY: 0.5
  },
  firebolt: {
    path: 'assets/Projectiles/sprFirebolt.png',
    frameWidth: 12,
    frameHeight: 5,
    frameCount: 5,
    fps: 14,
    loop: true,
    rotateWithVelocity: true,
    baseAngleRad: 0,
    anchorX: 0.5,
    anchorY: 0.5
  },
  acidProjectile: {
    path: 'assets/Projectiles/sprAcidProjectile.png',
    frameWidth: 20,
    frameHeight: 12,
    frameCount: 10,
    fps: 12,
    loop: true,
    rotateWithVelocity: true,
    baseAngleRad: 0,
    anchorX: 0.5,
    anchorY: 0.5
  },
  elementalFireShot: {
    path: 'assets/Projectiles/Fire Effect 1/Fire Effect 1/Firebolt SpriteSheet.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 4,
    columns: 11,
    fps: 12,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 28,
    drawHeight: 28
  },
  fireballSkill: {
    path: 'assets/Projectiles/Fire Effect 1/Fire Effect 1/Firebolt SpriteSheet.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 4,
    columns: 11,
    fps: 12,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 40,
    drawHeight: 40
  },
  iceShardSkill: {
    path: 'assets/Projectiles/Ice Effect 01/Ice Effect 01/Ice VFX 1/IceVFX 1 Repeatable.png',
    frameWidth: 48,
    frameHeight: 32,
    frameCount: 10,
    fps: 15,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 42,
    drawHeight: 28
  },
  windCrescent: {
    path: 'assets/Projectiles/Wind Effect 01/Wind Effect 01/Wind Projectile.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 6,
    columns: 3,
    fps: 12,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 42,
    drawHeight: 42
  },
  darkSlash: {
    path: 'assets/Projectiles/DarkSlash.png',
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 8,
    columns: 4,
    fps: 20,
    loop: false,
    rotateWithVelocity: true,
    baseAngleRad: Math.PI / 2,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 72,
    drawHeight: 72
  },
  heavyStrike: {
    path: 'assets/Projectiles/heavy strike.png',
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 9,
    columns: 9,
    fps: 18,
    loop: false,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 96,
    drawHeight: 96
  },
  doubleStrike: {
    path: 'assets/Projectiles/double strike.png',
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 9,
    columns: 9,
    fps: 18,
    loop: false,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 96,
    drawHeight: 96
  },
  downwardSlash: {
    path: 'assets/Projectiles/Downward Slash.png',
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 9,
    columns: 9,
    fps: 18,
    loop: false,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 96,
    drawHeight: 96
  },
  bladeBlastProjectile: {
    path: 'assets/Projectiles/Darkness Bolt.png',
    frameWidth: 16,
    frameHeight: 16,
    frameCount: 6,
    columns: 6,
    fps: 18,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 24,
    drawHeight: 24
  },
  darkOrb: {
    path: 'assets/Projectiles/Dark VFX 01 - 02/Dark VFX 1/Dark VFX 1 (40x32).png',
    frameWidth: 40,
    frameHeight: 32,
    frameCount: 10,
    columns: 10,
    fps: 12,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 28,
    drawHeight: 22
  },
  /** Large slow bolt: row 2 (down) of 8Necromancer directional strip, 128×128 × 15 frames. */
  necromancerDarkBoltLarge: {
    path: 'assets/Enemies/8Necromancer/Special2.png',
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 15,
    startFrame: 30,
    columns: 15,
    fps: 14,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 52,
    drawHeight: 52
  },
  volatileFireball: {
    path: 'assets/Projectiles/longFireBall.png',
    frameWidth: 256,
    frameHeight: 64,
    frameCount: 15,
    columns: 15,
    loopStartFrame: 5,
    loopFrameCount: 9,
    fps: 18,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 64,
    drawHeight: 16
  },
  smokeBurstRing: {
    path: 'assets/images/Free Smoke Fx  Pixel 05.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 8,
    startFrame: 0,
    columns: 11,
    fps: 18,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 56,
    drawHeight: 56
  },
  smokeBurstSoft: {
    path: 'assets/images/Free Smoke Fx  Pixel 05.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 8,
    startFrame: 77,
    columns: 11,
    fps: 18,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 56,
    drawHeight: 56
  },
  smokeBurstGround: {
    path: 'assets/images/Free Smoke Fx  Pixel 05.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 8,
    startFrame: 88,
    columns: 11,
    fps: 18,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 72,
    drawHeight: 40
  },
  soulSiphonSpiritFireball: {
    path: 'assets/Projectiles/Dark VFX 01 - 02/Dark VFX 1/Dark VFX 1 (40x32).png',
    frameWidth: 40,
    frameHeight: 32,
    frameCount: 10,
    startFrame: 0,
    columns: 10,
    fps: 14,
    loop: true,
    rotateWithVelocity: true,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 36,
    drawHeight: 29
  },
  soulSiphonSpiritFireballImpact: {
    path: 'assets/Projectiles/Dark VFX 01 - 02/Dark VFX 1/Dark VFX 1 (40x32).png',
    frameWidth: 40,
    frameHeight: 32,
    frameCount: 6,
    startFrame: 10,
    columns: 10,
    fps: 18,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 44,
    drawHeight: 35
  },
  soulSiphonSpiritGroundSlam: {
    path: 'assets/Projectiles/Dark VFX 01 - 02/Dark VFX 2/Dark VFX 2 (48x64).png',
    frameWidth: 48,
    frameHeight: 64,
    frameCount: 15,
    columns: 16,
    fps: 18,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5,
    drawWidth: 88,
    drawHeight: 118
  }
};

export function resolveAnimatedSpritePreset(animatedSprite) {
  if (typeof animatedSprite === 'string') {
    return ANIMATED_SPRITE_PRESETS[animatedSprite] || null;
  }
  const presetId = animatedSprite?.preset;
  if (!presetId) return animatedSprite || null;
  const preset = ANIMATED_SPRITE_PRESETS[presetId];
  return preset ? { ...preset, ...animatedSprite } : animatedSprite || null;
}

export function getResolvedAnimatedSpriteConfig(animatedSprite, options = {}) {
  const resolved = resolveAnimatedSpritePreset(animatedSprite);
  return normalizeAnimatedSpriteConfig(resolved, options);
}

export function getAnimatedSpritePreset(id, overrides = null) {
  const preset = ANIMATED_SPRITE_PRESETS[id];
  if (!preset) return null;
  return normalizeAnimatedSpriteConfig({ ...preset, ...(overrides || {}) });
}

export function getElementalShotAnimatedSprite(element, overrides = null) {
  if (element === 'fire') return getAnimatedSpritePreset('elementalFireShot', overrides);
  if (element === 'wind') return getAnimatedSpritePreset('windCrescent', overrides);
  return null;
}

export function getDarkSlashAnimatedSprite(overrides = null) {
  return getAnimatedSpritePreset('darkSlash', overrides);
}

export function getBladeBlastProjectileAnimatedSprite(overrides = null) {
  return getAnimatedSpritePreset('bladeBlastProjectile', overrides);
}

export function getSkillEffectAnimatedSprite(effectType, overrides = null) {
  if (effectType === 'fireball') return getAnimatedSpritePreset('fireballSkill', overrides);
  if (effectType === 'iceShard') return getAnimatedSpritePreset('iceShardSkill', overrides);
  return null;
}

export function getSoulSiphonSpiritFireballAnimatedSprite(overrides = null) {
  return getAnimatedSpritePreset('soulSiphonSpiritFireball', overrides);
}

export function getSoulSiphonSpiritFireballImpactAnimatedSprite(overrides = null) {
  return getAnimatedSpritePreset('soulSiphonSpiritFireballImpact', overrides);
}

export function getSoulSiphonSpiritGroundSlamAnimatedSprite(overrides = null) {
  return getAnimatedSpritePreset('soulSiphonSpiritGroundSlam', overrides);
}
