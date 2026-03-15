import { Vec2 } from './utils.js';

export const CAMERA_SMOOTH = 0.12;
export const CAMERA_DEADZONE = 8;

export class Camera {
  constructor(viewWidth, viewHeight) {
    this.position = new Vec2();
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this._initialized = false;
  }

  snapTo(target, worldWidth, worldHeight) {
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;
    const targetX = target.position.x + target.size / 2 - halfW;
    const targetY = target.position.y + target.size / 2 - halfH;
    const maxX = Math.max(0, worldWidth - this.viewWidth);
    const maxY = Math.max(0, worldHeight - this.viewHeight);
    this.position.set(
      Math.max(0, Math.min(targetX, maxX)),
      Math.max(0, Math.min(targetY, maxY))
    );
    this._initialized = true;
  }

  follow(target, worldWidth, worldHeight, dt = 1 / 60) {
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;

    const targetX = target.position.x + target.size / 2 - halfW;
    const targetY = target.position.y + target.size / 2 - halfH;

    const maxX = Math.max(0, worldWidth - this.viewWidth);
    const maxY = Math.max(0, worldHeight - this.viewHeight);

    if (!this._initialized) {
      this.snapTo(target, worldWidth, worldHeight);
      return;
    }

    const frameScale = Math.max(0, Number(dt) || 0) * 60;
    const lerp = Math.max(0, Math.min(1, CAMERA_SMOOTH * frameScale));

    const dx = targetX - this.position.x;
    const dy = targetY - this.position.y;
    const distance = Math.hypot(dx, dy);

    // Radial deadzone: move both axes together when outside deadzone (prevents diagonal jitter from per-axis stagger)
    if (distance > CAMERA_DEADZONE) {
      this.position.x += dx * lerp;
      this.position.y += dy * lerp;
    }

    this.position.x = Math.max(0, Math.min(this.position.x, maxX));
    this.position.y = Math.max(0, Math.min(this.position.y, maxY));

    // Round to integer pixels so drawing with Math.floor(world - camera) doesn't jitter by 1px
    this.position.x = Math.round(this.position.x);
    this.position.y = Math.round(this.position.y);
  }
}
