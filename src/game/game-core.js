// -------- Game Core Methods Mixin --------
// Core game loop, canvas, pause, restart
// This module adds methods to Game.prototype when imported

import { refreshMainMenuLP } from '../ui/main-menu.js';
import { stopBgm } from '../audio.js';
const DESIGN_WIDTH = 640;
const DESIGN_HEIGHT = 360;

export function applyGameCoreMixin(Game) {
  Object.assign(Game.prototype, {
    resizeCanvas() {
      const cap = window.__gameResolutionCap || { width: 1920, height: 1080 };
      const presetId = window.__gameResolutionPresetId || "1080p";
      const isFullscreen = !!document.fullscreenElement;
      const containerWidth = isFullscreen
        ? window.innerWidth
        : Math.min(window.innerWidth, cap.width);
      const containerHeight = isFullscreen
        ? window.innerHeight
        : Math.min(window.innerHeight, cap.height);
      const containerLeft = Math.floor((window.innerWidth - containerWidth) / 2);
      const containerTop = Math.floor((window.innerHeight - containerHeight) / 2);
      const scale = Math.max(
        1,
        Math.floor(
          Math.min(
            containerWidth / DESIGN_WIDTH,
            containerHeight / DESIGN_HEIGHT
          )
        )
      );
      const displayWidth = DESIGN_WIDTH * scale;
      const displayHeight = DESIGN_HEIGHT * scale;
      const canvasLeft = containerLeft + Math.floor((containerWidth - displayWidth) / 2);
      const canvasTop = containerTop + Math.floor((containerHeight - displayHeight) / 2);

      this.canvas.width = DESIGN_WIDTH;
      this.canvas.height = DESIGN_HEIGHT;
      this.canvas.style.width = `${displayWidth}px`;
      this.canvas.style.height = `${displayHeight}px`;
      this.canvas.style.position = "absolute";
      this.canvas.style.left = `${canvasLeft}px`;
      this.canvas.style.top = `${canvasTop}px`;
      this.canvas.style.imageRendering = "pixelated";

      const gameRoot = document.querySelector(".game-root");
      if (gameRoot) {
        gameRoot.style.position = "fixed";
        gameRoot.style.inset = "0";
        gameRoot.style.display = "block";
        gameRoot.style.background = "#000";
        gameRoot.style.borderRadius = "0";
        gameRoot.style.overflow = "visible";
        gameRoot.style.boxShadow = "none";
      }

      const canvasWrapper = document.querySelector(".canvas-wrapper");
      if (canvasWrapper) {
        canvasWrapper.style.position = "static";
        canvasWrapper.style.width = "0";
        canvasWrapper.style.height = "0";
      }

      if (typeof this.layoutUiForDesignResolution === "function") {
        this.layoutUiForDesignResolution(scale, canvasLeft, canvasTop);
      }

      console.log(
        `[Resolution] preset=${presetId} container=${containerWidth}x${containerHeight} scale=${scale} canvas=${displayWidth}x${displayHeight}`
      );

      this.ctx.imageSmoothingEnabled = false;
    },

    loop(timestamp) {
      if (this._destroyed) return;
      const dt = (timestamp - this.lastTime) / 1000 || 0;
      this.lastTime = timestamp;

      if (!this.paused) {
        this.update(dt);
      }
      this.render();

      this._rafId = requestAnimationFrame((t) => this.loop(t));
    },

    togglePause() {
      if (this.gameOver) return;
      if (this.inventoryOverlayOpen) {
        this.closeInventoryOverlay();
        return;
      }
      this.paused = !this.paused;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = this.paused ? "Resume" : "Pause";
        this.pauseToggleEl.classList.toggle("paused", this.paused);
      }
    },

    restartGame() {
      window.location.reload();
    },

    returnToMainMenu() {
      this.destroy();
      stopBgm();
      // Hide game elements
      document.getElementById("main-menu").classList.remove("hidden");
      document.querySelector(".game-root").classList.add("hidden");
      document.getElementById("pause-toggle").classList.add("hidden");
      document.getElementById("dev-toggle")?.classList.add("hidden");
      document.getElementById("inventory-button")?.classList.add("hidden");
      
      // Unpause if paused
      this.paused = false;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Pause";
        this.pauseToggleEl.classList.remove("paused");
      }
      
      // Refresh main menu
      refreshMainMenuLP();
    }
  });
}
