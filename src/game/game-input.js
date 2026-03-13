// -------- Game Input Methods Mixin --------
// Input handling, mouse, keyboard
// This module adds methods to Game.prototype when imported

import { getBgmMuted, setBgmMuted, startBgm } from "../audio.js";

export function applyGameInputMixin(Game) {
  Object.assign(Game.prototype, {
    getWorldPositionFromScreen(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const viewX = ((clientX - rect.left) / rect.width) * this.viewWidth;
      const viewY = ((clientY - rect.top) / rect.height) * this.viewHeight;
      return {
        x: this.camera.position.x + viewX,
        y: this.camera.position.y + viewY
      };
    },

    getWorldPositionFromClick(e) {
      return this.getWorldPositionFromScreen(e.clientX, e.clientY);
    },

    onCanvasMouseDown(e) {
      if (e.button !== 0 || this.gameOver || this.levelUpChoices) return;
      
      // Handle pause menu button clicks
      if (this.paused) {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * this.viewWidth;
        const y = ((e.clientY - rect.top) / rect.height) * this.viewHeight;
        
        if (this.pauseResumeButton) {
          if (x >= this.pauseResumeButton.x && x <= this.pauseResumeButton.x + this.pauseResumeButton.w &&
              y >= this.pauseResumeButton.y && y <= this.pauseResumeButton.y + this.pauseResumeButton.h) {
            this.togglePause();
            return;
          }
        }

        if (this.pauseUnstuckButton) {
          if (x >= this.pauseUnstuckButton.x && x <= this.pauseUnstuckButton.x + this.pauseUnstuckButton.w &&
              y >= this.pauseUnstuckButton.y && y <= this.pauseUnstuckButton.y + this.pauseUnstuckButton.h) {
            if (Date.now() >= this.unstuckCooldownUntil && this.player && this.world) {
              const tileSize = this.world.tileSize || 32;
              this.player.position.x -= 5 * tileSize;
              this.unstuckCooldownUntil = Date.now() + 20000;
            }
            return;
          }
        }
        
        if (this.pauseMainMenuButton) {
          if (x >= this.pauseMainMenuButton.x && x <= this.pauseMainMenuButton.x + this.pauseMainMenuButton.w &&
              y >= this.pauseMainMenuButton.y && y <= this.pauseMainMenuButton.y + this.pauseMainMenuButton.h) {
            this.returnToMainMenu();
            return;
          }
        }

        if (this.pauseBgmToggleButton) {
          if (x >= this.pauseBgmToggleButton.x && x <= this.pauseBgmToggleButton.x + this.pauseBgmToggleButton.w &&
              y >= this.pauseBgmToggleButton.y && y <= this.pauseBgmToggleButton.y + this.pauseBgmToggleButton.h) {
            const nextMuted = !getBgmMuted();
            setBgmMuted(nextMuted);
            if (!nextMuted) startBgm();
            return;
          }
        }
        
        return;
      }
      
      this.mouseHeld = true;
      this.lastMouseWorld = this.getWorldPositionFromClick(e);
      this.tryBasicAttack(this.lastMouseWorld.x, this.lastMouseWorld.y);
    }
  });
}
