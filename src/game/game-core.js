// -------- Game Core Methods Mixin --------
// Core game loop, canvas, pause, restart
// This module adds methods to Game.prototype when imported

import { refreshMainMenuLP } from '../ui/main-menu.js';
import { stopBgm } from '../audio.js';
const DESIGN_WIDTH = 640;
const DESIGN_HEIGHT = 360;
const PERF_SAMPLE_WINDOW = 120;
const TARGET_FRAME_MS = 1000 / 60;
const HITCH_FRAME_MS = 1000 / 30;

export function applyGameCoreMixin(Game) {
  Object.assign(Game.prototype, {
    updatePerfHud(dt) {
      const fpsEl = document.getElementById("game-fps-counter");
      if (!fpsEl) return;

      fpsEl.classList.remove("hidden");

      if (!Number.isFinite(dt) || dt <= 0 || dt >= 1) return;

      const frameMs = dt * 1000;
      this._perfSamples = this._perfSamples || [];
      this._perfSamples.push(frameMs);
      if (this._perfSamples.length > PERF_SAMPLE_WINDOW) {
        this._perfSamples.shift();
      }

      const instFps = 1 / dt;
      this._fpsSmooth = (this._fpsSmooth ?? instFps) * 0.92 + instFps * 0.08;

      const sampleCount = this._perfSamples.length || 1;
      const avgMs = this._perfSamples.reduce((sum, value) => sum + value, 0) / sampleCount;
      const slowFrames = this._perfSamples.filter((value) => value > TARGET_FRAME_MS).length;
      const hitchFrames = this._perfSamples.filter((value) => value > HITCH_FRAME_MS).length;
      const slowPct = Math.round((slowFrames / sampleCount) * 100);
      const dpr = typeof window !== "undefined" ? Number(window.devicePixelRatio) || 1 : 1;
      const mode = document.fullscreenElement ? "fs" : "wnd";
      const canvasInfo = `${Math.round(this.canvasScreenWidth || 0)}x${Math.round(this.canvasScreenHeight || 0)}`;

      fpsEl.textContent = [
        `${Math.round(this._fpsSmooth ?? 0)} FPS`,
        `${avgMs.toFixed(1)} ms avg | ${slowPct}% slow`,
        `${hitchFrames}/${sampleCount} >33ms`,
        `${mode} | dpr ${dpr.toFixed(2)} | ${canvasInfo}`
      ].join("\n");
    },

    clearMapTransitionLocks() {
      if (this.inventoryOverlayOpen && typeof this.closeInventoryOverlay === "function") {
        this.closeInventoryOverlay();
      } else {
        this.inventoryOverlayOpen = false;
        this.extractionSelectionMode = false;
        if (this.extractionSelectedIds) this.extractionSelectedIds.clear();
        document.getElementById("inventory-overlay")?.classList.add("hidden");
      }

      if (this.currentEvent && typeof this.closeEventOverlay === "function") {
        this.closeEventOverlay();
      } else {
        this.currentEvent = null;
        const eventOverlay = document.getElementById("event-overlay");
        const inventoryOverlay = document.getElementById("inventory-overlay");
        const merchantPick = document.getElementById("event-merchant-pick");
        const choicesEl = document.getElementById("event-choices");
        if (eventOverlay) eventOverlay.classList.add("hidden");
        if (eventOverlay) eventOverlay.classList.remove("rogue-split");
        if (inventoryOverlay) inventoryOverlay.classList.remove("rogue-split");
        if (merchantPick) merchantPick.classList.add("hidden");
        if (choicesEl) choicesEl.classList.remove("hidden");
      }

      const levelUpOverlay = document.getElementById("level-up-overlay");
      const levelUpRerollBtn = document.getElementById("level-up-reroll");
      if (levelUpOverlay) {
        levelUpOverlay.classList.remove("level-up-overlay-visible", "level-up-overlay-evolution");
        levelUpOverlay.classList.add("hidden");
      }
      if (levelUpRerollBtn) {
        levelUpRerollBtn.classList.add("hidden");
        levelUpRerollBtn.onclick = null;
      }
      this.levelUpChoices = null;
      this.levelUpChoiceContext = null;

      this.paused = false;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Pause";
        this.pauseToggleEl.classList.remove("paused");
      }

      this.victoryPortal = null;
      this.victoryPortalTimer = 0;
      this.nearVictoryPortal = false;
      this.nearInteractable = null;
      this.nearSearchableProp = null;
      this.searchingProp = null;
      this.nodeExitPortals = [];
      this.bossExtractionActive = false;
      this.bossExtractionTimeLeft = 0;

      this.updateVictoryPortalUI?.();
      this.updatePauseEnemyTestPanelVisibility?.();
    },

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
      this.canvasScale = scale;
      this.canvasScreenLeft = canvasLeft;
      this.canvasScreenTop = canvasTop;
      this.canvasScreenWidth = displayWidth;
      this.canvasScreenHeight = displayHeight;

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
        `[Resolution] preset=${presetId} dpr=${typeof window !== "undefined" ? window.devicePixelRatio : 1} fullscreen=${isFullscreen} container=${containerWidth}x${containerHeight} scale=${scale} canvas=${displayWidth}x${displayHeight}`
      );

      this.ctx.imageSmoothingEnabled = false;
    },

    loop(timestamp) {
      if (this._destroyed) return;
      const dt = (timestamp - this.lastTime) / 1000 || 0;
      this.lastTime = timestamp;
      this.updatePerfHud(dt);

      if (!this.paused) {
        if (typeof this.updateRiteRuntime === "function") {
          this.updateRiteRuntime(dt);
        }
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
      const onReturnToHomeBase = this.runConfig?.onReturnToHomeBase;
      if (typeof onReturnToHomeBase === "function") {
        this.destroy();
        stopBgm();
        this.gameOverEl?.classList.add("hidden");
        this.paused = false;
        if (this.pauseToggleEl) {
          this.pauseToggleEl.textContent = "Pause";
          this.pauseToggleEl.classList.remove("paused");
        }
        onReturnToHomeBase({ reason: "defeat" });
        return;
      }

      this.destroy();
      stopBgm();
      // Hide game elements
      document.getElementById("main-menu")?.classList.remove("hidden");
      document.querySelector(".game-root")?.classList.add("hidden");
      document.getElementById("pause-toggle")?.classList.add("hidden");
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
