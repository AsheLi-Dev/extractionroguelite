import { drawAnimatedSpriteFrame, getAnimatedSpriteFrameIndex, getAnimatedSpriteImage } from '../vfx/animated-sprite.js';

export const CUTE_SPIRIT_ID = '__spirit';

const FOLLOW_SPEED = 220;
const TURN_RATE = 5;
const SPIRIT_MOVE_SPEED_THRESHOLD = 14;
const SPIRIT_MOVE_ANIMATION_SPEED_THRESHOLD = 28;
const SPIRIT_MOVE_DISTANCE_THRESHOLD = 20;
const SPIRIT_DECELERATION_DISTANCE_THRESHOLD = 72;
const SPIRIT_DECELERATION_RATIO = 0.82;
const SPIRIT_BASE_DRAW_SIZE = 160;
const SPIRIT_IDLE_AFTERIMAGE_SEC = 0.2;
const SPIRIT_IDLE_AFTERIMAGE_ALPHA = 0.22;
const SPIRIT_IDLE_AFTERIMAGE_OFFSET_MAX = 10;
const SPIRIT_PLAYER_TELEPORT_DISTANCE = 280;
const SPIRIT_CHARGE_OVERLAY_ALPHA = 0.5;
const SPIRIT_CHARGE_OVERLAY_POSITION_VARIATION = 6;
const SPIRIT_SPRITES = {
  idle: {
    path: 'assets/images/Spirit Soul Siphon/Sprites/Idle.png',
    frameWidth: 160,
    frameHeight: 160,
    frameCount: 10,
    fps: 10,
    loop: true,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5
  },
  move: {
    path: 'assets/images/Spirit Soul Siphon/Sprites/Move.png',
    frameWidth: 160,
    frameHeight: 160,
    frameCount: 8,
    fps: 12,
    loop: true,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5
  },
  attackGroundSlam: {
    path: 'assets/images/Spirit Soul Siphon/Sprites/Attack1.png',
    frameWidth: 160,
    frameHeight: 160,
    frameCount: 10,
    fps: 14,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5
  },
  attackFireball: {
    path: 'assets/images/Spirit Soul Siphon/Sprites/Attack2.png',
    frameWidth: 160,
    frameHeight: 160,
    frameCount: 10,
    fps: 14,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5
  },
  chargeHit: {
    path: 'assets/images/Spirit Soul Siphon/Sprites/114.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 12,
    fps: 24,
    loop: false,
    rotateWithVelocity: false,
    anchorX: 0.5,
    anchorY: 0.5
  }
};

function getSpiritSpriteImage(state) {
  const sprite = SPIRIT_SPRITES[state];
  return sprite ? getAnimatedSpriteImage(sprite.path) : null;
}

function getSpiritAttackAnimationDuration(state) {
  const sprite = SPIRIT_SPRITES[state];
  if (!sprite) return 0;
  return sprite.frameCount / sprite.fps;
}

function drawFallbackSpirit(ctx, sx, sy, stage, wobblePhase, gameTime) {
  const r = 12;
  const wobble = Math.sin(wobblePhase) * 2;
  const pulse = 0.9 + Math.sin(gameTime * 6) * 0.08;
  const scale = (stage * 0.15 + 1) * pulse + wobble * 0.05;
  const radius = r * scale;
  const alpha = 0.5 + stage * 0.08;
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

export class CuteSpiritCompanion {
  constructor(playerX, playerY) {
    this.id = CUTE_SPIRIT_ID;
    this.position = { x: playerX, y: playerY };
    this.velocity = { x: 0, y: 0 };
    this.size = 24;
    this.charge = 0;
    this.stage = 1;
    this.wobblePhase = 0;
    this.isMoving = false;
    this.facingLeft = false;
    this.loopAnimationElapsed = 0;
    this.attackAnimationId = null;
    this.attackAnimationElapsed = 0;
    this.chargeAnimationActive = false;
    this.chargeAnimationElapsed = 0;
    this.chargeAnimationOffsetX = 0;
    this.chargeAnimationOffsetY = 0;
    this.idleAfterimage = null;
  }

  update(dt, game) {
    const cursor = game?.lastMouseWorld;
    const player = game?.player;
    const playerCenterX = player ? player.position.x + player.size / 2 : this.position.x;
    const playerCenterY = player ? player.position.y + player.size / 2 : this.position.y;
    if (player) {
      const playerDx = playerCenterX - this.position.x;
      const playerDy = playerCenterY - this.position.y;
      if (Math.hypot(playerDx, playerDy) >= SPIRIT_PLAYER_TELEPORT_DISTANCE) {
        this.position.x = playerCenterX;
        this.position.y = playerCenterY;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.idleAfterimage = null;
      }
    }
    let tx = this.position.x;
    let ty = this.position.y;
    if (cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
      tx = cursor.x;
      ty = cursor.y;
    } else if (player) {
      tx = playerCenterX;
      ty = playerCenterY;
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
    if (game && typeof game.onCuteSpiritMoved === 'function') {
      const movedDist = Math.sqrt(vx * vx + vy * vy);
      if (movedDist > 0) game.onCuteSpiritMoved(movedDist);
    }
    this.wobblePhase += dt * 4;
    this.loopAnimationElapsed += dt;
    const wasUsingMoveAnimation = this.isMoving;
    const velocityMag = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    const isDecelerating = velocityMag > SPIRIT_MOVE_ANIMATION_SPEED_THRESHOLD
      && (
        dist <= SPIRIT_DECELERATION_DISTANCE_THRESHOLD
        || desiredSpeed < velocityMag * SPIRIT_DECELERATION_RATIO
      );
    this.isMoving = !isDecelerating
      && (dist > SPIRIT_MOVE_DISTANCE_THRESHOLD || velocityMag > SPIRIT_MOVE_ANIMATION_SPEED_THRESHOLD);
    if (this.velocity.x <= -SPIRIT_MOVE_SPEED_THRESHOLD) this.facingLeft = true;
    else if (this.velocity.x >= SPIRIT_MOVE_SPEED_THRESHOLD) this.facingLeft = false;
    if (!this.attackAnimationId && wasUsingMoveAnimation && !this.isMoving) {
      this.idleAfterimage = {
        remaining: SPIRIT_IDLE_AFTERIMAGE_SEC,
        duration: SPIRIT_IDLE_AFTERIMAGE_SEC,
        frameIndex: getAnimatedSpriteFrameIndex(this.loopAnimationElapsed, SPIRIT_SPRITES.move),
        flipX: this.facingLeft,
        offsetX: Math.max(-SPIRIT_IDLE_AFTERIMAGE_OFFSET_MAX, Math.min(SPIRIT_IDLE_AFTERIMAGE_OFFSET_MAX, -this.velocity.x * 0.025)),
        offsetY: Math.max(-SPIRIT_IDLE_AFTERIMAGE_OFFSET_MAX, Math.min(SPIRIT_IDLE_AFTERIMAGE_OFFSET_MAX, -this.velocity.y * 0.025))
      };
    } else if (this.isMoving) {
      this.idleAfterimage = null;
    }
    if (this.idleAfterimage) {
      this.idleAfterimage.remaining = Math.max(0, this.idleAfterimage.remaining - dt);
      if (this.idleAfterimage.remaining <= 0) this.idleAfterimage = null;
    }
    if (this.attackAnimationId) {
      this.attackAnimationElapsed += dt;
      if (this.attackAnimationElapsed >= getSpiritAttackAnimationDuration(this.attackAnimationId)) {
        this.attackAnimationId = null;
        this.attackAnimationElapsed = 0;
      }
    }
    if (this.chargeAnimationActive) {
      this.chargeAnimationElapsed += dt;
      if (this.chargeAnimationElapsed >= getSpiritAttackAnimationDuration('chargeHit')) {
        this.chargeAnimationActive = false;
        this.chargeAnimationElapsed = 0;
        this.chargeAnimationOffsetX = 0;
        this.chargeAnimationOffsetY = 0;
      }
    }
  }

  playAttackAnimation(kind) {
    this.idleAfterimage = null;
    if (kind === 'ground_slam') {
      this.attackAnimationId = 'attackGroundSlam';
      this.attackAnimationElapsed = 0;
    } else if (kind === 'fireball') {
      this.attackAnimationId = 'attackFireball';
      this.attackAnimationElapsed = 0;
    }
  }

  playChargeAnimation() {
    this.chargeAnimationActive = true;
    this.chargeAnimationElapsed = 0;
    this.chargeAnimationOffsetX = (Math.random() * 2 - 1) * SPIRIT_CHARGE_OVERLAY_POSITION_VARIATION;
    this.chargeAnimationOffsetY = (Math.random() * 2 - 1) * SPIRIT_CHARGE_OVERLAY_POSITION_VARIATION;
  }

  draw(ctx, camera, gameTime = 0) {
    const sx = this.position.x - camera.position.x;
    const sy = this.position.y - camera.position.y;
    const wobble = Math.sin(this.wobblePhase) * 2;
    const drawSize = SPIRIT_BASE_DRAW_SIZE;
    const auraRadius = drawSize * (0.34 + this.stage * 0.015);
    const animationId = this.attackAnimationId || (this.isMoving ? 'move' : 'idle');
    const spriteBase = SPIRIT_SPRITES[animationId];
    const sprite = {
      ...spriteBase,
      drawWidth: drawSize,
      drawHeight: drawSize
    };
    const image = getSpiritSpriteImage(animationId);
    const centerY = sy + wobble * 0.5;

    const g = ctx.createRadialGradient(sx, centerY, 0, sx, centerY, auraRadius * 1.8);
    g.addColorStop(0, `rgba(200, 180, 255, ${0.34 + this.stage * 0.04})`);
    g.addColorStop(0.55, `rgba(160, 140, 220, ${0.18 + this.stage * 0.02})`);
    g.addColorStop(1, 'rgba(120, 100, 180, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, centerY, auraRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    if (!this.attackAnimationId && this.idleAfterimage) {
      const moveSprite = {
        ...SPIRIT_SPRITES.move,
        drawWidth: drawSize,
        drawHeight: drawSize
      };
      const moveImage = getSpiritSpriteImage('move');
      const afterimageAlpha = SPIRIT_IDLE_AFTERIMAGE_ALPHA
        * (this.idleAfterimage.remaining / this.idleAfterimage.duration);
      ctx.save();
      ctx.globalAlpha = afterimageAlpha;
      drawAnimatedSpriteFrame(ctx, {
        image: moveImage,
        sprite: moveSprite,
        centerX: sx + this.idleAfterimage.offsetX,
        centerY: centerY + this.idleAfterimage.offsetY,
        angle: 0,
        frameIndex: this.idleAfterimage.frameIndex,
        flipX: this.idleAfterimage.flipX
      });
      ctx.restore();
    }

    const drewSprite = drawAnimatedSpriteFrame(ctx, {
      image,
      sprite,
      centerX: sx,
      centerY,
      angle: 0,
      elapsed: this.attackAnimationId ? this.attackAnimationElapsed : this.loopAnimationElapsed,
      flipX: this.facingLeft
    });

    if (!drewSprite) {
      drawFallbackSpirit(ctx, sx, centerY, this.stage, this.wobblePhase, gameTime);
      return;
    }

    if (this.chargeAnimationActive) {
      const chargeSprite = {
        ...SPIRIT_SPRITES.chargeHit,
        drawWidth: Math.round(drawSize * 0.3),
        drawHeight: Math.round(drawSize * 0.3)
      };
      const chargeImage = getSpiritSpriteImage('chargeHit');
      ctx.save();
      ctx.globalAlpha = SPIRIT_CHARGE_OVERLAY_ALPHA;
      drawAnimatedSpriteFrame(ctx, {
        image: chargeImage,
        sprite: chargeSprite,
        centerX: sx + this.chargeAnimationOffsetX,
        centerY: centerY + this.chargeAnimationOffsetY,
        angle: 0,
        elapsed: this.chargeAnimationElapsed
      });
      ctx.restore();
    }
  }
}
