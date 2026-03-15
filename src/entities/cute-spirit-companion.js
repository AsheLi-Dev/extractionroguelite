/**
 * Cute Spirit Companion — passive floating entity summoned at 10 souls.
 * No collision, not targetable; follows the cursor with smooth movement.
 * Charged by Soul Siphon chain hits; at threshold performs assist actions.
 */

export const CUTE_SPIRIT_ID = '__spirit';

const FOLLOW_SPEED = 220;
/** How quickly velocity turns toward the target (1 = instant). Higher = snappier, lower = more drift. */
const TURN_RATE = 5;

export class CuteSpiritCompanion {
  constructor(playerX, playerY) {
    this.id = CUTE_SPIRIT_ID;
    this.position = { x: playerX, y: playerY };
    this.velocity = { x: 0, y: 0 };
    this.size = 24;
    this.charge = 0;
    this.stage = 1;
    this.chargePulseUntil = 0;
    this.wobblePhase = 0;
  }

  /**
   * Update position to follow the cursor with inertia; velocity blends toward target direction.
   */
  update(dt, game) {
    const cursor = game?.lastMouseWorld;
    const player = game?.player;
    let tx = this.position.x;
    let ty = this.position.y;
    if (cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
      tx = cursor.x;
      ty = cursor.y;
    } else if (player) {
      tx = player.position.x + player.size / 2;
      ty = player.position.y + player.size / 2;
    }
    const dx = tx - this.position.x;
    const dy = ty - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const desiredSpeed = dist > 0 ? Math.min(FOLLOW_SPEED, dist / dt) : 0;
    const desiredVx = (dx / dist) * desiredSpeed;
    const desiredVy = (dy / dist) * desiredSpeed;
    const blend = 1 - Math.exp(-TURN_RATE * dt);
    this.velocity.x += (desiredVx - this.velocity.x) * blend;
    this.velocity.y += (desiredVy - this.velocity.y) * blend;
    const vx = this.velocity.x * dt;
    const vy = this.velocity.y * dt;
    this.position.x += vx;
    this.position.y += vy;
    if (game && typeof game.onCuteSpiritMoved === "function") {
      const movedDist = Math.sqrt(vx * vx + vy * vy);
      if (movedDist > 0) game.onCuteSpiritMoved(movedDist);
    }
    this.wobblePhase += dt * 4;
  }

  /**
   * Draw as a soft glowing circle; stage increases visual intensity.
   */
  draw(ctx, camera, gameTime = 0) {
    const sx = this.position.x - camera.position.x;
    const sy = this.position.y - camera.position.y;
    const r = this.size / 2;
    const wobble = Math.sin(this.wobblePhase) * 2;
    const pulse = this.chargePulseUntil > gameTime ? 1.2 : 0.8 + Math.sin(gameTime * 6) * 0.15;
    const scale = (this.stage * 0.15 + 1) * pulse + wobble * 0.05;
    const radius = r * scale;
    const alpha = 0.5 + this.stage * 0.08;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 2);
    g.addColorStop(0, `rgba(200, 180, 255, ${alpha})`);
    g.addColorStop(0.5, `rgba(160, 140, 220, ${alpha * 0.6})`);
    g.addColorStop(1, 'rgba(120, 100, 180, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(220, 200, 255, ${0.6 + Math.sin(gameTime * 8) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
