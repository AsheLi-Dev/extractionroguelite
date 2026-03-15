/**
 * Reusable floating orbit system for pillar monuments.
 * Each config defines a center, a list of sprites (items atlas row/col), and motion params.
 * Used to animate equipment/relic sprites slowly orbiting around a pillar.
 *
 * Tweaks:
 * - orbitSpeed: radians per second (e.g. 0.12 = slow)
 * - radius: world-space distance from center
 * - bobAmplitude / bobSpeed: vertical bobbing
 * - spriteSize: display size in world pixels
 */

const DEFAULT_ORBIT_SPEED = 0.12;
const DEFAULT_BOB_AMPLITUDE = 5;
const DEFAULT_BOB_SPEED = 1.0;
const DEFAULT_SPRITE_SIZE = 24;

/**
 * Compute current world position and rotation for one orbit sprite.
 * @param {Object} item - { radius, angleOffset, bobAmplitude, bobSpeed, rotationSpeed }
 * @param {number} centerX - world x
 * @param {number} centerY - world y
 * @param {number} time - seconds
 * @returns {{ x, y, rotation }}
 */
export function getOrbitSpriteTransform(item, centerX, centerY, time) {
  const radius = Number(item.radius) || 60;
  const angleOffset = Number(item.angleOffset) || 0;
  const orbitSpeed = Number(item.orbitSpeed) ?? DEFAULT_ORBIT_SPEED;
  const bobAmplitude = Number(item.bobAmplitude) ?? DEFAULT_BOB_AMPLITUDE;
  const bobSpeed = Number(item.bobSpeed) ?? DEFAULT_BOB_SPEED;
  const bobPhase = Number(item.bobPhase) || 0;

  const radiusY = Number(item.radiusY) ?? radius;
  const angle = time * orbitSpeed + angleOffset;
  const x = centerX + radius * Math.cos(angle);
  const bob = bobAmplitude * Math.sin(time * bobSpeed + bobPhase);
  const y = centerY + bob + radiusY * Math.sin(angle);

  const rotationSpeed = Number(item.rotationSpeed) || 0;
  const rotation = rotationSpeed * time + (item.rotationOffset || 0);

  return { x, y, rotation };
}

/**
 * Merge config-level defaults into each item (orbitSpeed, bobAmplitude, bobSpeed).
 */
function mergeItemWithConfig(item, config) {
  return {
    ...item,
    orbitSpeed: item.orbitSpeed ?? config.orbitSpeed ?? DEFAULT_ORBIT_SPEED,
    bobAmplitude: item.bobAmplitude ?? config.bobAmplitude ?? DEFAULT_BOB_AMPLITUDE,
    bobSpeed: item.bobSpeed ?? config.bobSpeed ?? DEFAULT_BOB_SPEED
  };
}

/**
 * Build draw list for an orbit group: array of { x, y, rotation, row, col, spriteSize }.
 * Sorted by y (back to front) for draw order.
 */
export function buildOrbitDrawList(orbitConfig, time) {
  if (orbitConfig?.centerX == null || orbitConfig?.centerY == null) return [];
  const centerX = orbitConfig.centerX;
  const centerY = orbitConfig.centerY;
  const items = orbitConfig.items || [];
  const list = [];
  for (const item of items) {
    const merged = mergeItemWithConfig(item, orbitConfig);
    const t = getOrbitSpriteTransform(merged, centerX, centerY, time);
    list.push({
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      row: item.row,
      col: item.col,
      spriteSize: Number(item.spriteSize) || Number(orbitConfig.spriteSize) || DEFAULT_SPRITE_SIZE
    });
  }
  list.sort((a, b) => a.y - b.y);
  return list;
}
