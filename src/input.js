import { Vec2 } from './utils.js';

export class Input {
  constructor(options = {}) {
    this.keys = new Set();
    this._signal = options.signal || null;
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onKeyUp = (e) => this.onKeyUp(e);
    const listenerOpts = this._signal ? { signal: this._signal } : undefined;
    window.addEventListener("keydown", this._onKeyDown, listenerOpts);
    window.addEventListener("keyup", this._onKeyUp, listenerOpts);
  }

  onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      e.preventDefault();
    }
    this.keys.add(key);
  }

  onKeyUp(e) {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
  }

  getAxis() {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;

    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }

    return new Vec2(x, y);
  }

  /** Held Ctrl — used for crouch / stealth in the main run. */
  isCrouchHeld() {
    return this.keys.has("control");
  }

  destroy() {
    if (this._signal) return;
    if (this._onKeyDown) window.removeEventListener("keydown", this._onKeyDown);
    if (this._onKeyUp) window.removeEventListener("keyup", this._onKeyUp);
  }
}
