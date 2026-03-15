function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export class ScreenFade {
  constructor() {
    this.el = document.getElementById("screen-fade-overlay");
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.id = "screen-fade-overlay";
      this.el.className = "screen-fade-overlay hidden";
      document.body.appendChild(this.el);
    }
  }

  setOpacity(opacity) {
    if (!this.el) return;
    const alpha = clamp01(opacity);
    this.el.style.opacity = String(alpha);
    this.el.classList.toggle("hidden", alpha <= 0);
  }

  async fadeTo(targetOpacity, durationMs = 180) {
    if (!this.el) return;
    const to = clamp01(targetOpacity);
    const computed = window.getComputedStyle(this.el);
    const from = clamp01(Number.parseFloat(computed.opacity || "0"));
    if (Math.abs(to - from) < 0.001 || durationMs <= 0) {
      this.setOpacity(to);
      return;
    }

    this.el.classList.remove("hidden");
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start) / durationMs);
        const next = from + (to - from) * t;
        this.el.style.opacity = String(next);
        if (t >= 1) {
          if (to <= 0) this.el.classList.add("hidden");
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  fadeOut(durationMs = 140) {
    return this.fadeTo(1, durationMs);
  }

  fadeIn(durationMs = 180) {
    return this.fadeTo(0, durationMs);
  }

  async transition(task, options = {}) {
    const outDurationMs = Number(options.outDurationMs) || 140;
    const inDurationMs = Number(options.inDurationMs) || 180;
    await this.fadeOut(outDurationMs);
    try {
      await task?.();
    } finally {
      await this.fadeIn(inDurationMs);
    }
  }
}
