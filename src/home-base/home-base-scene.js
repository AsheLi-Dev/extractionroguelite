import { Camera } from "../camera.js";
import { Input } from "../input.js";
import { Player } from "../player.js";
import { HomeBaseUIController } from "./home-base-ui.js";
import { createHomeBaseLayout } from "./home-base-layout.js";
import { PortalPrepFlowController } from "./portal-prep-flow.js";
import { getSelectedLures } from "./lure-state.js";
import { getTileAtlas, getTileCoords, isTileAtlasLoaded } from "../entities/tile-system.js";
import {
  MAINLEVBUILD_ATLAS,
  MAINLEVBUILD_TILE_SIZE,
  getMainlevbuildRect,
  getFirstGidForRegion
} from "./mainlevbuild-atlas-map.js";
import {
  loadHubLayout,
  saveHubLayout,
  mergeHubLayoutInto
} from "./hub-layout-storage.js";
import { HUB_BASE_IMAGES } from "./hub-base-image-list.js";
import { buildTerrainGridFromHubMap, getTilesetForGid, gidToTileCoords, resolveExternalTilesets, stripTiledFlipFlags } from "./hub-map-loader.js";
import {
  getHomeBaseIntroSteps,
  markHomeBaseIntroSeen,
  shouldShowHomeBaseIntro
} from "./home-base-intro.js";
import { buildOrbitDrawList, getOrbitSpriteTransform } from "./home-base-orbit.js";
import { drawMagicProjectile, getMagicProjectileDrawOptions } from "../vfx/magic-projectile-renderer.js";

const DESIGN_WIDTH = 640;
const DESIGN_HEIGHT = 360;
const ATLAS_TILE_SIZE = 32;
const ITEMS_ATLAS_TILE = 32;
const ITEMS_ATLAS_SRC = "assets/Environments/items.png";
const HUB_DASH_DISTANCE = 233; // 155 + 50%
const HUB_DASH_DURATION = 0.16;
const HUB_DASH_COOLDOWN = 0.55;

const BLOCKING_OVERLAY_IDS = [
  "pre-run-overlay",
  "skill-select-overlay",
  "pillar-overlay",
  "legacy-vault-overlay",
  "talent-tree-overlay",
  "skill-library-overlay",
  "friends-overlay",
  "main-menu"
];

const STRUCTURE_STYLE = {
  stone: { fill: "#334155", stroke: "#0f172a" },
  pillar: { fill: "#475569", stroke: "#111827" },
  wood: { fill: "#78350f", stroke: "#422006" },
  altar: { fill: "#4c1d95", stroke: "#2e1065" },
  crate: { fill: "#92400e", stroke: "#51270a" },
  rubble: { fill: "#6b7280", stroke: "#374151" },
  bench: { fill: "#854d0e", stroke: "#422006" },
  cloth: { fill: "#155e75", stroke: "#164e63" },
  metal: { fill: "#94a3b8", stroke: "#475569" },
  furnace: { fill: "#7f1d1d", stroke: "#450a0a" },
  rune: { fill: "#312e81", stroke: "#1e1b4b" },
  energy: { fill: "#0369a1", stroke: "#0c4a6e" },
  ember: { fill: "#ea580c", stroke: "#9a3412" },
  default: { fill: "#374151", stroke: "#0f172a" }
};

export class HomeBaseScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks;

    this.world = {
      width: 2048,
      height: 2048,
      wallThickness: 50
    };

    this.layout = createHomeBaseLayout(this.world);
    mergeHubLayoutInto(this.layout, loadHubLayout());
    this.interactables = this.layout.interactables;
    this.locationZones = this.layout.locationZones || [];
    this.collisionWalls = this.layout.collisionWalls;
    this.getEffectiveCollisionWalls = (options) => {
      const walls = this.layout.collisionWalls || [];
      if (options?.excludeBoxes) return [...walls];
      return [...walls, ...(this.layout.collisionBoxes || [])];
    };
    this.markerById = this.layout.markerById || {};
    this.ambientAnchors = this.layout.ambientAnchors || [];
    this.floorTileZones = this.layout.floorTileZones || [];
    this.atlasProps = this.layout.atlasProps || [];
    this.imageProps = this.layout.imageProps || [];
    this.mainlevbuildProps = this.layout.mainlevbuildProps || [];
    this.imagePropCache = new Map();
    this.peaceFloatingClouds = this.layout.peaceFloatingClouds || null;
    this.peaceCloudCache = new Map();
    this.orbitConfigs = this.layout.orbitConfigs || [];
    this.cascadeRainDrops = null;
    this.cascadeRainDropsDelayed = null;
    this.redPandaSheet = null;
    this.redPandaAnimations = null;
    this.redPanda = null;
    this.axolotlSheets = new Map();
    this.axolotl = null;
    this.blobfishSheet = null;
    this.blobfishAnimations = null;
    this.blobfish = null;
    this._loadImageProps();
    this._loadPeaceClouds();
    this._loadRedPandaRoam();
    this._loadAxolotlRoam();
    this._loadBlobfishRoam();
    this.ambientAnchorById = new Map(this.ambientAnchors.map((entry) => [entry.id, entry]));
    this.itemsAtlas = new Image();
    this.itemsAtlasLoaded = false;
    this.itemsAtlas.addEventListener("load", () => {
      this.itemsAtlasLoaded = true;
    });
    this.itemsAtlas.addEventListener("error", () => {
      this.itemsAtlasLoaded = false;
    });
    this.itemsAtlas.src = ITEMS_ATLAS_SRC;

    this.mainlevbuildImage = new Image();
    this.mainlevbuildLoaded = false;
    this.mainlevbuildImage.addEventListener("load", () => {
      this.mainlevbuildLoaded = true;
    });
    this.mainlevbuildImage.addEventListener("error", () => {
      this.mainlevbuildLoaded = false;
    });
    this.mainlevbuildImage.src = MAINLEVBUILD_ATLAS.image;

    const campfire = this.interactables.find((item) => item.id === "campfire");
    const campfireCenter = campfire ? campfire.getCenter() : { x: this.world.width * 0.5, y: this.world.height * 0.5 };
    this.player = new Player(campfireCenter.x - 50, campfireCenter.y - 50);
    this.player.speed = 220;
    this.camera = new Camera(DESIGN_WIDTH, DESIGN_HEIGHT);

    this.ui = new HomeBaseUIController();
    this.portalPrepFlow = new PortalPrepFlowController({
      ui: this.ui,
      onStartExpedition: (selectedLureIds) => this.callbacks.onStartExpedition?.(selectedLureIds)
    });
    this.promptEl = this.createPrompt();
    this.legacyMenuBtn = this.createLegacyMenuButton();
    this.locationCalloutEl = this.createLocationCallout();
    this.introHintEl = this.createIntroHint();

    this.input = null;
    this.abortController = null;
    this.running = false;
    this.lastTime = 0;
    this.time = 0;
    this.rafId = null;

    this.activeInteractable = null;
    this.prevInteractPressed = false;
    this.prevEscapePressed = false;
    this.prevDashPressed = false;
    this.interactionLockUntil = 0;
    this.currentZoneId = null;
    this.calloutUntil = 0;
    this.calloutText = "";
    this.calloutCooldownByZone = new Map();
    this.ambientParticles = [];
    this.introState = {
      active: false,
      steps: [],
      stepIndex: 0,
      elapsed: 0
    };
    this.hubDash = {
      active: false,
      dirX: 0,
      dirY: 0,
      speed: HUB_DASH_DISTANCE / HUB_DASH_DURATION,
      timeLeft: 0,
      cooldown: 0
    };

    this.boundLoop = (timestamp) => this.loop(timestamp);
    this.boundResize = () => this.resizeCanvas();
    this.boundHubTileDebugClick = (e) => this.onHubTileDebugClick(e);

    this.hubLayoutEditorMode = false;
    this.hubLayoutDrag = null;
    this.hubLayoutDragStartWorld = null;
    this.hubLayoutSelectedProp = null;
    this.hubLayoutPlaceRegion = null;
    this.hubLayoutPlaceImage = null;
    this.hubLayoutUndoStack = [];
    this.HUB_LAYOUT_MAX_UNDO = 30;
    this.hubLayoutTerrainPaintMode = false;
    this.hubLayoutPaintDragging = false;
    this.hubLayoutLastPaintedCell = null;
    this.hubCollisionBoxMode = false;
    this.hubCollisionBoxSelected = null;
    this.hubCollisionBoxAddMode = false;
    this.hubCollisionBoxNewRect = null;
    this.hubCollisionBoxDrag = null;
    this.hubInteractableMode = false;
    this.hubInteractableSelected = null;
    this.hubInteractableDrag = null;
    this.hubShowPlayerHitbox = false;
    this.hubLayoutEditorPanel = this.createHubLayoutEditorPanel();
    this.hubTileDebugMessage = null;
  }

  getTerrainCell(worldX, worldY) {
    const grid = this.layout.terrainGrid;
    if (!grid || !grid.length) return null;
    const cols = grid[0].length;
    const rows = grid.length;
    const gx = Math.floor(worldX / MAINLEVBUILD_TILE_SIZE);
    const gy = Math.floor(worldY / MAINLEVBUILD_TILE_SIZE);
    if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return null;
    return { gx, gy };
  }

  paintTerrainCell(gx, gy) {
    const grid = this.layout.terrainGrid;
    const region = this.hubLayoutPlaceRegion;
    if (!grid || !region || !MAINLEVBUILD_ATLAS.regions[region]) return;
    if (gy < 0 || gy >= grid.length || gx < 0 || gx >= (grid[0]?.length ?? 0)) return;
    grid[gy][gx] = getFirstGidForRegion(region);
  }

  cloneLayoutSnapshot() {
    const terrainGrid = this.layout.terrainGrid;
    const interactables = (this.layout.interactables || []).map((i) => ({ id: i.id, x: i.x, y: i.y, w: i.w, h: i.h }));
    const areas = (this.layout.areas || []).map((a) => ({ ...a }));
    return {
      atlasProps: (this.layout.atlasProps || []).map((p) => ({ ...p })),
      imageProps: (this.layout.imageProps || []).map((p) => ({ ...p })),
      mainlevbuildProps: (this.layout.mainlevbuildProps || []).map((p) => ({ ...p })),
      terrainGrid: terrainGrid ? terrainGrid.map((row) => row.slice()) : null,
      collisionBoxes: (this.layout.collisionBoxes || []).map((b) => ({ ...b })),
      interactables,
      areas
    };
  }

  pushHubLayoutUndo() {
    this.hubLayoutUndoStack.push(this.cloneLayoutSnapshot());
    if (this.hubLayoutUndoStack.length > this.HUB_LAYOUT_MAX_UNDO) {
      this.hubLayoutUndoStack.shift();
    }
  }

  undoHubLayoutLastStep() {
    if (this.hubLayoutUndoStack.length === 0) return;
    const snap = this.hubLayoutUndoStack.pop();
    this.layout.atlasProps = snap.atlasProps;
    this.layout.imageProps = snap.imageProps;
    this.layout.mainlevbuildProps = snap.mainlevbuildProps;
    if (snap.terrainGrid) this.layout.terrainGrid = snap.terrainGrid.map((row) => row.slice());
    if (snap.collisionBoxes) this.layout.collisionBoxes = snap.collisionBoxes.map((b) => ({ ...b }));
    if (snap.interactables && this.layout.interactables) {
      for (const d of snap.interactables) {
        const i = this.layout.interactables.find((x) => x.id === d.id);
        if (i) {
          i.x = d.x;
          i.y = d.y;
          i.w = d.w;
          i.h = d.h;
        }
      }
    }
    if (snap.areas) this.layout.areas = snap.areas.map((a) => ({ ...a }));
    this.atlasProps = this.layout.atlasProps;
    this.imageProps = this.layout.imageProps;
    this.mainlevbuildProps = this.layout.mainlevbuildProps;
    this.setHubLayoutSelectedProp(null);
    this.hubCollisionBoxSelected = null;
    this.hubInteractableSelected = null;
  }

  createHubLayoutEditorPanel() {
    const regionNames = Object.keys(MAINLEVBUILD_ATLAS.regions || {}).sort();
    const paletteOptions = regionNames
      .map((r) => `<option value="${r}">${r}</option>`)
      .join("");
    const panel = document.createElement("div");
    panel.id = "home-base-layout-editor-panel";
    panel.className = "home-base-layout-editor-panel hidden";
    panel.innerHTML = `
      <button type="button" id="hub-layout-editor-toggle" class="hub-layout-editor-toggle" title="Drag sprites to rearrange the hub">Edit hub layout</button>
      <div id="hub-layout-editor-bar" class="home-base-layout-editor-bar hidden">
        <span class="home-base-layout-editor-title">Drag to move · Click to select &amp; resize</span>
        <label class="hub-layout-terrain-paint-check"><input type="checkbox" id="hub-layout-paint-terrain" /> Paint terrain</label>
        <div class="hub-layout-palette">
          <label for="hub-layout-atlas-palette" id="hub-layout-palette-label">Add sprite:</label>
          <select id="hub-layout-atlas-palette">
            <option value="">— click in scene to place —</option>
            ${paletteOptions}
          </select>
        </div>
        <div class="hub-layout-image-palette">
          <label for="hub-layout-add-image">Add image:</label>
          <select id="hub-layout-add-image">
            <option value="">— click in scene to place —</option>
            ${HUB_BASE_IMAGES.map(({ path, label }) => `<option value="${path.replace(/"/g, "&quot;")}">${label}</option>`).join("")}
          </select>
        </div>
        <div id="hub-layout-size-panel" class="hub-layout-size-panel hidden">
          <label>W <input type="number" id="hub-layout-size-w" min="8" max="800" step="4" /></label>
          <label>H <input type="number" id="hub-layout-size-h" min="8" max="800" step="4" /></label>
          <label class="hub-layout-lock-ratio-check"><input type="checkbox" id="hub-layout-size-lock-ratio" /> Lock ratio</label>
          <button type="button" id="hub-layout-deselect" class="hub-layout-editor-btn">Deselect</button>
          <button type="button" id="hub-layout-delete" class="hub-layout-editor-btn hub-layout-delete-btn">Delete</button>
        </div>
        <div class="hub-layout-collision-section">
          <label class="hub-layout-collision-check"><input type="checkbox" id="hub-layout-edit-collision" /> Collision boxes</label>
          <button type="button" id="hub-layout-collision-add" class="hub-layout-editor-btn">Add box</button>
          <button type="button" id="hub-layout-collision-delete" class="hub-layout-editor-btn hub-layout-delete-btn">Delete selected</button>
        </div>
        <label class="hub-layout-interactable-check"><input type="checkbox" id="hub-layout-edit-interactables" /> Interactables</label>
        <label class="hub-layout-hitbox-check"><input type="checkbox" id="hub-layout-show-player-hitbox" /> Player hitbox</label>
        <button type="button" id="hub-layout-editor-save" class="hub-layout-editor-btn">Save layout</button>
        <button type="button" id="hub-layout-editor-done" class="hub-layout-editor-btn">Done</button>
      </div>
    `;
    const toggleBtn = panel.querySelector("#hub-layout-editor-toggle");
    const bar = panel.querySelector("#hub-layout-editor-bar");
    const paintTerrainCheck = panel.querySelector("#hub-layout-paint-terrain");
    const paletteLabel = panel.querySelector("#hub-layout-palette-label");
    const paletteSelect = panel.querySelector("#hub-layout-atlas-palette");
    const sizePanel = panel.querySelector("#hub-layout-size-panel");
    const sizeW = panel.querySelector("#hub-layout-size-w");
    const sizeH = panel.querySelector("#hub-layout-size-h");
    const deselectBtn = panel.querySelector("#hub-layout-deselect");
    const deleteBtn = panel.querySelector("#hub-layout-delete");
    const saveBtn = panel.querySelector("#hub-layout-editor-save");
    const doneBtn = panel.querySelector("#hub-layout-editor-done");
    toggleBtn.addEventListener("click", () => this.setHubLayoutEditorMode(!this.hubLayoutEditorMode));
    paintTerrainCheck.addEventListener("change", () => {
      this.hubLayoutTerrainPaintMode = paintTerrainCheck.checked;
      this.hubLayoutPaintDragging = false;
      this.hubLayoutLastPaintedCell = null;
      if (paletteLabel) paletteLabel.textContent = this.hubLayoutTerrainPaintMode ? "Terrain tile:" : "Add sprite:";
    });
    paletteSelect.addEventListener("change", () => {
      this.hubLayoutPlaceRegion = paletteSelect.value || null;
      if (this.hubLayoutPlaceRegion) this.hubLayoutPlaceImage = null;
      const imageSelect = document.getElementById("hub-layout-add-image");
      if (imageSelect) imageSelect.value = "";
    });
    const imageSelect = panel.querySelector("#hub-layout-add-image");
    if (imageSelect) {
      imageSelect.addEventListener("change", () => {
        this.hubLayoutPlaceImage = imageSelect.value || null;
        if (this.hubLayoutPlaceImage) {
          this.hubLayoutPlaceRegion = null;
          if (paletteSelect) paletteSelect.value = "";
        }
      });
    }
    deselectBtn.addEventListener("click", () => this.setHubLayoutSelectedProp(null));
    deleteBtn.addEventListener("click", () => this.deleteHubLayoutSelectedProp());
    const lockRatioCheck = panel.querySelector("#hub-layout-size-lock-ratio");
    const clampSize = (v) => Math.max(8, Math.min(800, Number(v) || 32));
    const gcd = (a, b) => {
      a = Math.abs(Math.round(a));
      b = Math.abs(Math.round(b));
      if (b === 0) return a;
      return gcd(b, a % b);
    };
    const getLockRatioSteps = (w, h) => {
      const g = gcd(w, h);
      return {
        stepW: Math.max(1, Math.round(w / g)),
        stepH: Math.max(1, Math.round(h / g))
      };
    };
    const updateSizeInputStepsForLock = () => {
      if (!lockRatioCheck?.checked) {
        if (sizeW) sizeW.step = "4";
        if (sizeH) sizeH.step = "4";
        return;
      }
      const sel = this.hubLayoutSelectedProp;
      if (!sel?.prop) return;
      const cw = Math.max(8, Number(sel.prop.w) || 32);
      const ch = Math.max(8, Number(sel.prop.h) || 32);
      const { stepW, stepH } = getLockRatioSteps(cw, ch);
      this.hubLayoutSizeLockStepW = stepW;
      this.hubLayoutSizeLockStepH = stepH;
      if (sizeW) sizeW.step = String(stepW);
      if (sizeH) sizeH.step = String(stepH);
    };
    const applySizeFromW = () => {
      const sel = this.hubLayoutSelectedProp;
      if (!sel?.prop) return;
      if (this._applyingSizeLock) return;
      let w = clampSize(sizeW.value);
      let h;
      if (lockRatioCheck?.checked && this.hubLayoutSizeLockStepW != null && this.hubLayoutSizeLockStepH != null) {
        const stepW = this.hubLayoutSizeLockStepW;
        const stepH = this.hubLayoutSizeLockStepH;
        const wSnap = Math.round(w / stepW) * stepW;
        w = clampSize(wSnap);
        h = (w * stepH) / stepW;
        h = clampSize(Math.round(h));
        this._applyingSizeLock = true;
        sizeW.value = w;
        sizeH.value = h;
        this._applyingSizeLock = false;
      } else {
        h = clampSize(sizeH.value);
      }
      sel.prop.w = w;
      sel.prop.h = h;
      if (sel.type === "image" && sel.prop.aspectRatio) sel.prop.aspectRatio = 0;
    };
    const applySizeFromH = () => {
      const sel = this.hubLayoutSelectedProp;
      if (!sel?.prop) return;
      if (this._applyingSizeLock) return;
      let h = clampSize(sizeH.value);
      let w;
      if (lockRatioCheck?.checked && this.hubLayoutSizeLockStepW != null && this.hubLayoutSizeLockStepH != null) {
        const stepW = this.hubLayoutSizeLockStepW;
        const stepH = this.hubLayoutSizeLockStepH;
        const hSnap = Math.round(h / stepH) * stepH;
        h = clampSize(hSnap);
        w = (h * stepW) / stepH;
        w = clampSize(Math.round(w));
        this._applyingSizeLock = true;
        sizeW.value = w;
        sizeH.value = h;
        this._applyingSizeLock = false;
      } else {
        w = clampSize(sizeW.value);
      }
      sel.prop.w = w;
      sel.prop.h = h;
      if (sel.type === "image" && sel.prop.aspectRatio) sel.prop.aspectRatio = 0;
    };
    if (lockRatioCheck) {
      lockRatioCheck.addEventListener("change", () => {
        const sel = this.hubLayoutSelectedProp;
        if (lockRatioCheck.checked && sel?.prop) {
          const cw = Math.max(8, Number(sel.prop.w) || 32);
          const ch = Math.max(8, Number(sel.prop.h) || 32);
          this.hubLayoutSizeLockRatio = cw / ch;
          const { stepW, stepH } = getLockRatioSteps(cw, ch);
          this.hubLayoutSizeLockStepW = stepW;
          this.hubLayoutSizeLockStepH = stepH;
          if (sizeW) sizeW.step = String(stepW);
          if (sizeH) sizeH.step = String(stepH);
        } else {
          this.hubLayoutSizeLockStepW = null;
          this.hubLayoutSizeLockStepH = null;
          if (sizeW) sizeW.step = "4";
          if (sizeH) sizeH.step = "4";
        }
      });
    }
    this._updateHubSizeLockSteps = updateSizeInputStepsForLock;
    sizeW.addEventListener("focus", () => this.pushHubLayoutUndo());
    sizeH.addEventListener("focus", () => this.pushHubLayoutUndo());
    sizeW.addEventListener("change", applySizeFromW);
    sizeW.addEventListener("input", applySizeFromW);
    sizeH.addEventListener("change", applySizeFromH);
    sizeH.addEventListener("input", applySizeFromH);
    const collisionCheck = panel.querySelector("#hub-layout-edit-collision");
    const collisionAddBtn = panel.querySelector("#hub-layout-collision-add");
    const collisionDeleteBtn = panel.querySelector("#hub-layout-collision-delete");
    if (collisionCheck) {
      collisionCheck.addEventListener("change", () => {
        this.hubCollisionBoxMode = collisionCheck.checked;
        if (!this.hubCollisionBoxMode) {
          this.hubCollisionBoxSelected = null;
          this.hubCollisionBoxAddMode = false;
          this.hubCollisionBoxNewRect = null;
          this.hubCollisionBoxDrag = null;
        }
      });
    }
    if (collisionAddBtn) {
      collisionAddBtn.addEventListener("click", () => {
        this.hubCollisionBoxAddMode = !this.hubCollisionBoxAddMode;
        this.hubCollisionBoxSelected = null;
        this.hubCollisionBoxNewRect = null;
        collisionAddBtn.textContent = this.hubCollisionBoxAddMode ? "Cancel add" : "Add box";
      });
    }
    if (collisionDeleteBtn) {
      collisionDeleteBtn.addEventListener("click", () => this.deleteHubLayoutSelectedCollisionBox());
    }
    const interactableCheck = panel.querySelector("#hub-layout-edit-interactables");
    if (interactableCheck) {
      interactableCheck.addEventListener("change", () => {
        this.hubInteractableMode = interactableCheck.checked;
        if (!this.hubInteractableMode) {
          this.hubInteractableSelected = null;
          this.hubInteractableDrag = null;
        }
      });
    }
    const hitboxCheck = panel.querySelector("#hub-layout-show-player-hitbox");
    if (hitboxCheck) {
      hitboxCheck.addEventListener("change", () => {
        this.hubShowPlayerHitbox = hitboxCheck.checked;
      });
    }
    saveBtn.addEventListener("click", () => {
      if (saveHubLayout(this.layout)) {
        saveBtn.textContent = "Saved!";
        setTimeout(() => { saveBtn.textContent = "Save layout"; }, 1500);
      }
    });
    doneBtn.addEventListener("click", () => this.setHubLayoutEditorMode(false));
    this.hubLayoutEditorBar = bar;
    this.hubLayoutEditorToggleBtn = toggleBtn;
    this.hubLayoutSizePanel = sizePanel;
    this.hubLayoutSizeW = sizeW;
    this.hubLayoutSizeH = sizeH;
    document.body.appendChild(panel);
    return panel;
  }

  hitTestCollisionBox(worldX, worldY) {
    const boxes = this.layout.collisionBoxes || [];
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      const w = Math.max(16, Number(b.w) || 32);
      const h = Math.max(16, Number(b.h) || 32);
      if (worldX >= b.x && worldX < b.x + w && worldY >= b.y && worldY < b.y + h) return b;
    }
    return null;
  }

  hitTestInteractable(worldX, worldY) {
    const list = this.interactables || [];
    const withSort = list.map((i) => ({ i, sortY: i.y + (Number(i.h) || 64) }));
    withSort.sort((a, b) => b.sortY - a.sortY);
    for (const { i } of withSort) {
      const w = Math.max(16, Number(i.w) || 96);
      const h = Math.max(16, Number(i.h) || 64);
      if (worldX >= i.x && worldX < i.x + w && worldY >= i.y && worldY < i.y + h) return i;
    }
    return null;
  }

  deleteHubLayoutSelectedCollisionBox() {
    if (!this.hubCollisionBoxSelected) return;
    const boxes = this.layout.collisionBoxes || [];
    const i = boxes.indexOf(this.hubCollisionBoxSelected);
    if (i !== -1) {
      this.pushHubLayoutUndo();
      boxes.splice(i, 1);
    }
    this.hubCollisionBoxSelected = null;
  }

  deleteHubLayoutSelectedProp() {
    const sel = this.hubLayoutSelectedProp;
    if (!sel?.prop) return;
    this.pushHubLayoutUndo();
    const arr =
      sel.type === "atlas"
        ? this.layout.atlasProps
        : sel.type === "image"
          ? this.layout.imageProps
          : this.layout.mainlevbuildProps;
    if (Array.isArray(arr)) {
      const i = arr.indexOf(sel.prop);
      if (i !== -1) arr.splice(i, 1);
    }
    this.setHubLayoutSelectedProp(null);
  }

  setHubLayoutSelectedProp(sel) {
    this.hubLayoutSelectedProp = sel;
    if (!this.hubLayoutSizePanel) return;
    this.hubLayoutSizePanel.classList.toggle("hidden", !sel);
    if (sel?.prop) {
      const w = Math.max(8, Number(sel.prop.w) || 32);
      const h = Math.max(8, Number(sel.prop.h) || 32);
      if (sel.type === "image" && sel.prop.aspectRatio > 0) {
        const effectiveH = w / sel.prop.aspectRatio;
        this.hubLayoutSizeW.value = Math.round(w);
        this.hubLayoutSizeH.value = Math.round(effectiveH);
      } else {
        this.hubLayoutSizeW.value = Math.round(w);
        this.hubLayoutSizeH.value = Math.round(h);
      }
      const lockCheck = document.getElementById("hub-layout-size-lock-ratio");
      if (lockCheck?.checked && h > 0) {
        this.hubLayoutSizeLockRatio = w / h;
        if (this._updateHubSizeLockSteps) this._updateHubSizeLockSteps();
      }
    }
  }

  setHubLayoutEditorMode(on) {
    this.hubLayoutEditorMode = !!on;
    this.hubLayoutDrag = null;
    this.hubLayoutDragStartWorld = null;
    this.hubLayoutPaintDragging = false;
    this.hubLayoutLastPaintedCell = null;
    if (!on) {
      this.hubLayoutTerrainPaintMode = false;
      this.setHubLayoutSelectedProp(null);
      this.hubLayoutPlaceRegion = null;
      this.hubLayoutPlaceImage = null;
      this.hubCollisionBoxMode = false;
      this.hubCollisionBoxSelected = null;
      this.hubCollisionBoxAddMode = false;
      this.hubCollisionBoxNewRect = null;
      this.hubCollisionBoxDrag = null;
      this.hubInteractableMode = false;
      this.hubInteractableSelected = null;
      this.hubInteractableDrag = null;
      const paletteSelect = document.getElementById("hub-layout-atlas-palette");
      if (paletteSelect) paletteSelect.value = "";
      const imageSelect = document.getElementById("hub-layout-add-image");
      if (imageSelect) imageSelect.value = "";
      const paintTerrainCheck = document.getElementById("hub-layout-paint-terrain");
      if (paintTerrainCheck) paintTerrainCheck.checked = false;
      const paletteLabel = document.getElementById("hub-layout-palette-label");
      if (paletteLabel) paletteLabel.textContent = "Add sprite:";
      const collisionCheck = document.getElementById("hub-layout-edit-collision");
      if (collisionCheck) collisionCheck.checked = false;
      const collisionAddBtn = document.getElementById("hub-layout-collision-add");
      if (collisionAddBtn) collisionAddBtn.textContent = "Add box";
      const interactableCheck = document.getElementById("hub-layout-edit-interactables");
      if (interactableCheck) interactableCheck.checked = false;
    }
    if (this.hubLayoutEditorBar) this.hubLayoutEditorBar.classList.toggle("hidden", !on);
    if (this.hubLayoutEditorToggleBtn) this.hubLayoutEditorToggleBtn.classList.toggle("hidden", on);
    this.attachHubLayoutEditorListeners(on);
  }

  attachHubLayoutEditorListeners(attach) {
    const canvas = this.canvas;
    if (!canvas) return;
    if (attach) {
      this._hubEditorMouseDown = (e) => this.onHubEditorMouseDown(e);
      this._hubEditorMouseMove = (e) => this.onHubEditorMouseMove(e);
      this._hubEditorMouseUp = () => this.onHubEditorMouseUp();
      this._hubEditorKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          this.undoHubLayoutLastStep();
          return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && this.hubLayoutSelectedProp) {
          e.preventDefault();
          this.deleteHubLayoutSelectedProp();
        }
        if ((e.key === "Delete" || e.key === "Backspace") && this.hubCollisionBoxSelected) {
          e.preventDefault();
          this.deleteHubLayoutSelectedCollisionBox();
        }
      };
      canvas.addEventListener("mousedown", this._hubEditorMouseDown);
      window.addEventListener("mousemove", this._hubEditorMouseMove);
      window.addEventListener("mouseup", this._hubEditorMouseUp);
      canvas.addEventListener("mouseleave", this._hubEditorMouseUp);
      window.addEventListener("keydown", this._hubEditorKeyDown);
    } else {
      if (this._hubEditorMouseDown) canvas.removeEventListener("mousedown", this._hubEditorMouseDown);
      if (this._hubEditorMouseMove) window.removeEventListener("mousemove", this._hubEditorMouseMove);
      if (this._hubEditorMouseUp) {
        window.removeEventListener("mouseup", this._hubEditorMouseUp);
        canvas.removeEventListener("mouseleave", this._hubEditorMouseUp);
      }
      if (this._hubEditorKeyDown) window.removeEventListener("keydown", this._hubEditorKeyDown);
    }
  }

  getCanvasMouseWorld(e) {
    const canvas = this.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    return {
      x: canvasX + this.camera.position.x,
      y: canvasY + this.camera.position.y
    };
  }

  /** Alt+click on hub canvas: store and show debug info for the clicked tile (terrain + floor details). */
  onHubTileDebugClick(e) {
    if (e.button !== 0 || !e.altKey) return;
    e.preventDefault();
    const world = this.getCanvasMouseWorld(e);
    if (!world) return;
    const cell = this.getTerrainCell(world.x, world.y);
    const lines = [];
    lines.push(`Tile debug at world (${Math.floor(world.x)}, ${Math.floor(world.y)})`);
    if (!cell) {
      lines.push("No cell (out of grid bounds)");
      this.hubTileDebugMessage = lines.join("\n");
      console.log("[Hub tile debug]", this.hubTileDebugMessage);
      return;
    }
    const { gx, gy } = cell;
    const terrainGrid = this.layout.terrainGrid;
    const detailsGrid = this.layout.floorDetailsGrid;
    const terrainGid = terrainGrid?.[gy]?.[gx];
    const terrainCoords = terrainGid != null && terrainGid !== 0 ? gidToTileCoords(terrainGid, { firstgid: 1 }, 50) : null;
    const rawDetailGid = detailsGrid?.[gy]?.[gx];
    const detailGid = rawDetailGid != null && rawDetailGid !== 0 ? rawDetailGid : null;
    const strippedGid = detailGid != null ? stripTiledFlipFlags(detailGid) : null;
    const coords = detailGid != null ? gidToTileCoords(detailGid, { firstgid: 1 }, 50) : null;
    const atlasCols = 50;
    const atlasRows = 40;
    const outOfBounds =
      coords &&
      (coords.tx < 0 ||
        coords.ty < 0 ||
        coords.tx >= atlasCols ||
        coords.ty >= atlasRows);

    lines.push(`Cell (gx=${gx}, gy=${gy})`);
    lines.push(
      `Floor: raw GID=${terrainGid ?? "none"}, atlas (tx,ty)=${terrainCoords ? `(${terrainCoords.tx},${terrainCoords.ty})` : "null"}`
    );
    lines.push(
      `Floor detail: raw GID=${detailGid ?? "none"}, stripped=${strippedGid ?? "—"}, atlas (tx,ty)=${coords ? `(${coords.tx},${coords.ty})` : "null"}`
    );
    if (outOfBounds) lines.push("⚠ Detail atlas coords OUT OF BOUNDS (may draw black)");
    this.hubTileDebugMessage = lines.join("\n");
    console.log("[Hub tile debug]\n" + this.hubTileDebugMessage);
  }

  hitTestHubProp(worldX, worldY) {
    const imageProps = this.layout.imageProps || [];
    const atlasProps = this.layout.atlasProps || [];
    const mainlevbuildProps = this.layout.mainlevbuildProps || [];
    const candidates = [];
    for (const p of imageProps) {
      if (p.id === "collector-pillar") continue;
      let w = Number(p.w) || 96;
      let h = Number(p.h) || 96;
      if (Number(p.aspectRatio) > 0) h = w / p.aspectRatio;
      if (worldX >= p.x && worldX < p.x + w && worldY >= p.y && worldY < p.y + h) {
        candidates.push({ type: "image", prop: p, sortY: p.y + h });
      }
    }
    for (const p of atlasProps) {
      const w = Number(p.w) || 32;
      const h = Number(p.h) || 32;
      if (worldX >= p.x && worldX < p.x + w && worldY >= p.y && worldY < p.y + h) {
        candidates.push({ type: "atlas", prop: p, sortY: p.y + h });
      }
    }
    for (const p of mainlevbuildProps) {
      const w = Number(p.w) || 32;
      const h = Number(p.h) || 32;
      if (worldX >= p.x && worldX < p.x + w && worldY >= p.y && worldY < p.y + h) {
        candidates.push({ type: "mainlevbuild", prop: p, sortY: p.y + h });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.sortY - a.sortY);
    return candidates[0];
  }

  onHubEditorMouseDown(e) {
    if (e.button !== 0) return;
    const world = this.getCanvasMouseWorld(e);
    if (!world) return;

    if (this.hubCollisionBoxMode) {
      if (this.hubCollisionBoxAddMode) {
        this.pushHubLayoutUndo();
        this.hubCollisionBoxNewRect = { x: world.x, y: world.y, w: 0, h: 0 };
        this.hubCollisionBoxDrag = { type: "add", startX: world.x, startY: world.y };
        return;
      }
      const hit = this.hitTestCollisionBox(world.x, world.y);
      if (hit) {
        this.hubCollisionBoxSelected = hit;
        this.setHubLayoutSelectedProp(null);
        this.hubCollisionBoxDrag = {
          type: "move",
          box: hit,
          offsetX: world.x - hit.x,
          offsetY: world.y - hit.y
        };
        return;
      }
      this.hubCollisionBoxSelected = null;
      return;
    }

    if (this.hubLayoutTerrainPaintMode && this.hubLayoutPlaceRegion) {
      const cell = this.getTerrainCell(world.x, world.y);
      if (cell) {
        this.pushHubLayoutUndo();
        this.paintTerrainCell(cell.gx, cell.gy);
        this.hubLayoutPaintDragging = true;
        this.hubLayoutLastPaintedCell = { gx: cell.gx, gy: cell.gy };
      }
      return;
    }

    if (this.hubLayoutPlaceRegion) {
      const r = MAINLEVBUILD_ATLAS.regions[this.hubLayoutPlaceRegion];
      if (r) {
        this.pushHubLayoutUndo();
        const id = `mb-${this.hubLayoutPlaceRegion}-${Date.now()}`;
        this.layout.mainlevbuildProps.push({
          id,
          region: this.hubLayoutPlaceRegion,
          x: world.x - MAINLEVBUILD_TILE_SIZE / 2,
          y: world.y - MAINLEVBUILD_TILE_SIZE / 2,
          w: 32,
          h: 32
        });
      }
      return;
    }

    if (this.hubLayoutPlaceImage) {
      this.pushHubLayoutUndo();
      const slug = this.hubLayoutPlaceImage.replace(/^.*\//, "").replace(/\.[^.]+$/, "").replace(/\s+/g, "-");
      const id = `img-${slug}-${Date.now()}`;
      const defaultSize = 96;
      const prop = {
        id,
        src: this.hubLayoutPlaceImage,
        x: world.x,
        y: world.y,
        w: defaultSize,
        h: defaultSize,
        layer: "front"
      };
      this.layout.imageProps.push(prop);
      this._loadSingleImageProp(prop);
      return;
    }

    if (this.hubInteractableMode) {
      const hit = this.hitTestInteractable(world.x, world.y);
      if (hit) {
        this.hubInteractableSelected = hit;
        this.setHubLayoutSelectedProp(null);
        this.pushHubLayoutUndo();
        this.hubInteractableDrag = {
          interactable: hit,
          offsetX: world.x - hit.x,
          offsetY: world.y - hit.y
        };
      } else {
        this.hubInteractableSelected = null;
      }
      return;
    }

    if (!this.hubCollisionBoxMode) {
      const hit = this.hitTestHubProp(world.x, world.y);
      if (!hit) {
        this.setHubLayoutSelectedProp(null);
        return;
      }
      this.hubCollisionBoxSelected = null;
      this.pushHubLayoutUndo();
      this.hubLayoutDragStartWorld = { x: world.x, y: world.y };
      this.hubLayoutDrag = {
        type: hit.type,
        prop: hit.prop,
        offsetX: world.x - hit.prop.x,
        offsetY: world.y - hit.prop.y
      };
    }
  }

  onHubEditorMouseMove(e) {
    const world = this.getCanvasMouseWorld(e);
    if (world) this._hubEditorLastWorld = world;
    if (this.hubInteractableDrag && world) {
      const { interactable, offsetX, offsetY } = this.hubInteractableDrag;
      interactable.x = world.x - offsetX;
      interactable.y = world.y - offsetY;
      const area = (this.layout.areas || []).find((a) => a.interactableId === interactable.id);
      if (area && area.padX != null && area.padY != null) {
        area.x = interactable.x - area.padX;
        area.y = interactable.y - area.padY;
        area.w = (Number(interactable.w) || 96) + area.padX * 2;
        area.h = (Number(interactable.h) || 64) + area.padY * 2;
      }
      return;
    }
    if (this.hubCollisionBoxDrag?.type === "move" && world) {
      const { box, offsetX, offsetY } = this.hubCollisionBoxDrag;
      box.x = world.x - offsetX;
      box.y = world.y - offsetY;
      return;
    }
    if (this.hubCollisionBoxDrag?.type === "add" && world && this.hubCollisionBoxNewRect) {
      const { startX, startY } = this.hubCollisionBoxDrag;
      const x = Math.min(startX, world.x);
      const y = Math.min(startY, world.y);
      const w = Math.max(16, Math.abs(world.x - startX));
      const h = Math.max(16, Math.abs(world.y - startY));
      this.hubCollisionBoxNewRect = { x, y, w, h };
      return;
    }
    if (this.hubLayoutPaintDragging && world && this.hubLayoutPlaceRegion) {
      const cell = this.getTerrainCell(world.x, world.y);
      const last = this.hubLayoutLastPaintedCell;
      if (cell && (!last || cell.gx !== last.gx || cell.gy !== last.gy)) {
        this.paintTerrainCell(cell.gx, cell.gy);
        this.hubLayoutLastPaintedCell = { gx: cell.gx, gy: cell.gy };
      }
      return;
    }
    if (!this.hubLayoutDrag) return;
    if (!world) return;
    const { prop, offsetX, offsetY } = this.hubLayoutDrag;
    prop.x = world.x - offsetX;
    prop.y = world.y - offsetY;
  }

  onHubEditorMouseUp() {
    this.hubLayoutPaintDragging = false;
    if (this.hubInteractableDrag) {
      this.hubInteractableDrag = null;
      return;
    }
    if (this.hubCollisionBoxDrag?.type === "add" && this.hubCollisionBoxNewRect) {
      const r = this.hubCollisionBoxNewRect;
      if (r.w >= 16 && r.h >= 16) {
        const boxes = this.layout.collisionBoxes || [];
        boxes.push({
          id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h
        });
      }
      this.hubCollisionBoxNewRect = null;
      this.hubCollisionBoxDrag = null;
      return;
    }
    if (this.hubCollisionBoxDrag?.type === "move") {
      this.hubCollisionBoxDrag = null;
      return;
    }
    if (this.hubLayoutDrag && this.hubLayoutDragStartWorld && this._hubEditorLastWorld) {
      const dx = this._hubEditorLastWorld.x - this.hubLayoutDragStartWorld.x;
      const dy = this._hubEditorLastWorld.y - this.hubLayoutDragStartWorld.y;
      if (dx * dx + dy * dy < 36) {
        this.setHubLayoutSelectedProp({
          type: this.hubLayoutDrag.type,
          prop: this.hubLayoutDrag.prop
        });
      }
    }
    this.hubLayoutDrag = null;
    this.hubLayoutDragStartWorld = null;
  }

  createPrompt() {
    const prompt = document.createElement("div");
    prompt.id = "home-base-interact-prompt";
    prompt.className = "home-base-interact-prompt hidden";
    prompt.innerHTML = `
      <span class="home-base-interact-main">Press E to interact</span>
      <span class="home-base-interact-target"></span>
    `;
    document.body.appendChild(prompt);
    return prompt;
  }

  createLegacyMenuButton() {
    const btn = document.createElement("button");
    btn.id = "home-base-legacy-menu-btn";
    btn.className = "home-base-legacy-menu-btn hidden";
    btn.type = "button";
    btn.textContent = "Legacy Menu";
    btn.addEventListener("click", () => {
      this.callbacks.onOpenLegacyMenu?.();
    });
    document.body.appendChild(btn);
    return btn;
  }

  createLocationCallout() {
    const callout = document.createElement("div");
    callout.id = "home-base-location-callout";
    callout.className = "home-base-location-callout hidden";
    document.body.appendChild(callout);
    return callout;
  }

  createIntroHint() {
    const hint = document.createElement("div");
    hint.id = "home-base-intro-hint";
    hint.className = "home-base-intro-hint hidden";
    hint.innerHTML = `
      <div class="home-base-intro-title"></div>
      <div class="home-base-intro-text"></div>
    `;
    document.body.appendChild(hint);
    return hint;
  }

  _loadHubMapTerrain() {
    const url = "HubMap..tmj?v=" + Date.now();
    const baseUrl = new URL(url, import.meta.url).href.replace(/[^/]+(\?.*)?$/, "");
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(async (tmj) => {
        await resolveExternalTilesets(tmj.tilesets || [], baseUrl);
        const result = buildTerrainGridFromHubMap(tmj, {
          width: this.world.width,
          height: this.world.height
        });
        if (!result) return;
        this.layout.terrainGrid = result.terrainGrid || [];
        this.layout.floorDetailsGrid = result.floorDetailsGrid || [];
        this.layout.hubMapTileLayers = result.tileLayers || [];
        this.layout.hubMapFirstGid = result.firstgid;
        this.layout.hubMapAtlasCols = result.atlasCols;
        this.layout.hubMapTilesets = result.tilesets || [];
        this.hubMapTilesetImages = this.hubMapTilesetImages || {};
        const tilesets = result.tilesets || [];
        for (let i = 1; i < tilesets.length; i++) {
          const ts = tilesets[i];
          const imagePath = ts?.image || "";
          if (imagePath) {
            const img = new Image();
            img.src = imagePath;
            this.hubMapTilesetImages[i] = img;
          }
        }
      })
      .catch(() => {});
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loadHubMapTerrain();
    this.lastTime = 0;
    this.time = 0;
    this.activeInteractable = null;
    this.prevInteractPressed = false;
    this.prevEscapePressed = false;
    this.prevDashPressed = false;
    this.interactionLockUntil = 0;
    this.currentZoneId = null;
    this.calloutUntil = 0;
    this.calloutText = "";
    this.introState.active = false;
    this.introState.steps = [];
    this.introState.stepIndex = 0;
    this.introState.elapsed = 0;
    this.ui.close();
    this.hidePrompt();
    this.hideLocationCallout();
    this.hideIntroHint();
    this.resetAmbientParticles();
    this.startIntroIfNeeded();
    this.hubDash.active = false;
    this.hubDash.timeLeft = 0;
    this.hubDash.cooldown = 0;

    this.abortController = new AbortController();
    this.input = new Input({ signal: this.abortController.signal });
    window.addEventListener("resize", this.boundResize, { signal: this.abortController.signal });
    this.canvas.addEventListener("mousedown", this.boundHubTileDebugClick, { signal: this.abortController.signal });

    this.resetPlayerToCampfire();
    this.resizeCanvas();
    this.camera.snapTo(this.player, this.world.width, this.world.height);
    this.showLegacyMenuButton(true);
    if (this.hubLayoutEditorPanel) this.hubLayoutEditorPanel.classList.remove("hidden");
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.ui.close();
    this.hidePrompt();
    this.hideLocationCallout();
    this.hideIntroHint();
    this.hubDash.active = false;
    this.hubDash.timeLeft = 0;
    this.hubDash.cooldown = 0;
    this.introState.active = false;
    this.introState.steps = [];
    this.introState.stepIndex = 0;
    this.introState.elapsed = 0;
    this.showLegacyMenuButton(false);
    if (this.hubLayoutEditorPanel) this.hubLayoutEditorPanel.classList.add("hidden");
    this.setHubLayoutEditorMode(false);
    this.hubTileDebugMessage = null;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.input && typeof this.input.destroy === "function") {
      this.input.destroy();
    }
    this.input = null;
  }

  destroy() {
    this.stop();
    this.ui.destroy();
    if (this.promptEl) {
      this.promptEl.remove();
      this.promptEl = null;
    }
    if (this.legacyMenuBtn) {
      this.legacyMenuBtn.remove();
      this.legacyMenuBtn = null;
    }
    if (this.locationCalloutEl) {
      this.locationCalloutEl.remove();
      this.locationCalloutEl = null;
    }
    if (this.introHintEl) {
      this.introHintEl.remove();
      this.introHintEl = null;
    }
  }

  resetPlayerToCampfire() {
    const arrival = this.layout.arrival || null;
    const campfire = this.interactables.find((item) => item.id === "campfire");
    const fallback = campfire ? campfire.getCenter() : { x: this.world.width * 0.5, y: this.world.height * 0.5 };
    const spawn = arrival?.spawn || fallback;
    this.player.position.set(
      spawn.x - this.player.size * 0.5,
      spawn.y - this.player.size * 0.5
    );
    if (arrival?.facing && typeof this.player.setFacingFromVector === "function") {
      this.player.setFacingFromVector(arrival.facing.x, arrival.facing.y);
    }
  }

  loop(timestamp) {
    if (!this.running) return;
    const dt = (timestamp - this.lastTime) / 1000 || 0;
    this.lastTime = timestamp;
    this.time += dt;
    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  update(dt) {
    if (!this.input) return;
    this.updateAmbientParticles(dt);
    this.updateCascadePillarRain(dt);
    this.updateRedPandaRoam(dt);
    this.updateAxolotlRoam(dt);
    this.updateBlobfishRoam(dt);
    if (this.hubDash.cooldown > 0) {
      this.hubDash.cooldown = Math.max(0, this.hubDash.cooldown - dt);
    }

    const movementBlocked = this.isMovementBlocked();
    if (!movementBlocked) {
      const dashPressed = this.input.keys.has(" ");
      if (dashPressed && !this.prevDashPressed) {
        this.tryStartHubDash();
      }
      this.prevDashPressed = dashPressed;

      if (this.hubDash.active) {
        this.updateHubDash(dt);
      } else {
        this.player.update(dt, this.input, this.world, [], this.getEffectiveCollisionWalls());
        this.resolvePlayerOutOfCollisionBoxes();
      }
      this.activeInteractable = this.findNearestInteractable();
    } else {
      this.hubDash.active = false;
      this.prevDashPressed = this.input.keys.has(" ");
      this.activeInteractable = null;
    }

    this.camera.follow(this.player, this.world.width, this.world.height, dt);

    const interactPressed = this.input.keys.has("e");
    const escapePressed = this.input.keys.has("escape");
    const axis = this.input.getAxis();
    const movementIntent = Math.abs(axis.x) > 0.1 || Math.abs(axis.y) > 0.1;

    const canInteract = !movementBlocked
      && !this.hubDash.active
      && !!this.activeInteractable
      && this.time >= this.interactionLockUntil;

    if (interactPressed && !this.prevInteractPressed && canInteract) {
      this.interactionLockUntil = this.time + 0.18;
      this.handleInteraction(this.activeInteractable);
    }

    if (escapePressed && !this.prevEscapePressed) {
      this.handleEscape();
    }

    this.prevInteractPressed = interactPressed;
    this.prevEscapePressed = escapePressed;
    this.updateLocationCalloutState();
    this.updateIntro(dt, movementIntent, interactPressed);
    this.updatePrompt();
  }

  handleEscape() {
    if (this.ui.isOpen()) {
      this.ui.close();
      this.interactionLockUntil = this.time + 0.1;
      return;
    }
    if (this.isOverlayVisible("skill-library-overlay")) {
      this.callbacks.onCloseSkillLibrary?.();
      this.interactionLockUntil = this.time + 0.1;
      return;
    }
    if (this.isOverlayVisible("talent-tree-overlay")) {
      this.callbacks.onCloseTalents?.();
      this.interactionLockUntil = this.time + 0.1;
      return;
    }
    if (this.isOverlayVisible("pillar-overlay")) {
      this.callbacks.onClosePillars?.();
      this.interactionLockUntil = this.time + 0.1;
      return;
    }
    if (this.isOverlayVisible("pre-run-overlay") || this.isOverlayVisible("skill-select-overlay")) {
      this.callbacks.onCancelRunSetup?.();
      this.interactionLockUntil = this.time + 0.1;
    }
    if (this.isOverlayVisible("friends-overlay")) {
      this.callbacks.onCloseFriends?.();
      this.interactionLockUntil = this.time + 0.1;
    }
    if (this.isOverlayVisible("legacy-vault-overlay")) {
      this.callbacks.onCloseLegacyVault?.();
      this.interactionLockUntil = this.time + 0.1;
    }
  }

  handleInteraction(interactable) {
    if (!interactable || this.isMovementBlocked()) return;

    switch (interactable.interactionType) {
      case "menu-return": {
        this.ui.openCustom({
          title: "Return to Main Menu?",
          description: "Leave Home Base and go back to the main menu?",
          actions: [
            {
              label: "Return to Main Menu",
              className: "home-base-panel-button-primary",
              onClick: () => {
                this.callbacks.onOpenLegacyMenu?.();
              }
            },
            {
              label: "Stay in Hub",
              className: "home-base-panel-button-secondary",
              onClick: () => {}
            }
          ]
        });
        break;
      }
      case "skill-library": {
        this.ui.close();
        const handled = this.callbacks.onOpenSkillLibrary?.() === true;
        if (!handled) {
          this.ui.openPlaceholder("Skill Library");
        }
        break;
      }
      case "talents": {
        this.ui.close();
        const handled = this.callbacks.onOpenTalents?.() === true;
        if (!handled) {
          this.ui.openPlaceholder("Campfire");
        }
        break;
      }
      case "portal":
        this.ui.close();
        this.callbacks.onOpenPrepareForRun?.();
        break;
      case "pillars": {
        this.ui.close();
        const handled = this.callbacks.onOpenPillars?.() === true;
        if (!handled) {
          this.ui.openPlaceholder("Pillars");
        }
        break;
      }
      case "lures": {
        this.portalPrepFlow.openLureSelection({ returnToPortal: false });
        break;
      }
      case "center": {
        // Campfire is hub anchor; no heavy UI
        break;
      }
      case "vault": {
        this.ui.close();
        const handled = this.callbacks.onOpenLegacyVault?.() === true;
        if (!handled) {
          this.ui.openPlaceholder("Vault");
        }
        break;
      }
      case "ironsmith": {
        this.ui.close();
        const handled = this.callbacks.onOpenIronsmith?.() === true;
        if (!handled) {
          this.ui.openPlaceholder("Ironsmith");
        }
        break;
      }
      case "companion": {
        this.ui.close();
        const handled = this.callbacks.onOpenFriends?.() === true;
        if (!handled) {
          this.ui.openPlaceholder("Companions");
        }
        break;
      }
      default:
        this.ui.openPlaceholder(interactable.panelTitle || interactable.displayName);
        break;
    }
  }

  findNearestInteractable() {
    const px = this.player.position.x + this.player.size * 0.5;
    const py = this.player.position.y + this.player.size * 0.5;
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const interactable of this.interactables) {
      const dist = interactable.distanceToPoint(px, py);
      if (dist <= interactable.promptRadius && dist < nearestDistance) {
        nearest = interactable;
        nearestDistance = dist;
      }
    }
    return nearest;
  }

  updatePrompt() {
    if (!this.promptEl) return;
    if (this.isMovementBlocked() || this.hubDash.active || !this.activeInteractable) {
      this.hidePrompt();
      return;
    }
    if (this.activeInteractable.interactionType === "center") {
      this.hidePrompt();
      return;
    }
    const targetEl = this.promptEl.querySelector(".home-base-interact-target");
    if (targetEl) {
      targetEl.textContent = this.activeInteractable.displayName;
    }
    this.promptEl.classList.remove("hidden");
  }

  hidePrompt() {
    if (this.promptEl) {
      this.promptEl.classList.add("hidden");
    }
  }

  getDashDirectionVector() {
    if (!this.input) return { x: 0, y: 1 };
    const axis = this.input.getAxis();
    if (Math.abs(axis.x) > 0.01 || Math.abs(axis.y) > 0.01) {
      const len = Math.hypot(axis.x, axis.y) || 1;
      return { x: axis.x / len, y: axis.y / len };
    }

    const facing = String(this.player.facingDirection || "down");
    if (facing === "up") return { x: 0, y: -1 };
    if (facing === "left_up") return { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
    if (facing === "right_up") return { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
    if (facing === "left_down") return { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
    if (facing === "right_down") return { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    return { x: 0, y: 1 };
  }

  tryStartHubDash() {
    if (this.hubDash.active || this.hubDash.cooldown > 0) return;
    const dir = this.getDashDirectionVector();
    this.hubDash.active = true;
    this.hubDash.dirX = dir.x;
    this.hubDash.dirY = dir.y;
    this.hubDash.timeLeft = HUB_DASH_DURATION;
    this.hubDash.cooldown = HUB_DASH_COOLDOWN;
    if (typeof this.player.beginDashAnimation === "function") {
      this.player.beginDashAnimation(dir.x, dir.y);
    }
  }

  updateHubDash(dt) {
    if (!this.hubDash.active) return;
    this.hubDash.timeLeft -= dt;
    if (typeof this.player.tickDashAnimation === "function") {
      this.player.tickDashAnimation(dt);
    }

    const dashInput = {
      getAxis: () => ({ x: this.hubDash.dirX, y: this.hubDash.dirY })
    };
    const originalSpeed = this.player.speed;
    this.player.speed = this.hubDash.speed;
    this.player.update(dt, dashInput, this.world, [], []); // no walls during dash – player can dash through everything
    this.player.speed = originalSpeed;

    if (this.hubDash.timeLeft <= 0) {
      this.hubDash.active = false;
      this.hubDash.timeLeft = 0;
    }
    // Do not resolve during dash – lets the player pass through collision boxes; resolve runs when dash ends (normal update)
  }

  /** Push the player out of any collision box they overlap (e.g. after dashing through). Prevents getting stuck. */
  resolvePlayerOutOfCollisionBoxes() {
    const boxes = this.layout.collisionBoxes || [];
    if (boxes.length === 0) return;
    const p = this.player;
    const HITBOX_SIZE = 30;
    const pxo = Math.max(0, (p.size - HITBOX_SIZE) / 2);
    const pyo = Math.max(0, (p.size - HITBOX_SIZE) / 2);
    const maxIter = 8;
    for (let iter = 0; iter < maxIter; iter++) {
      const px = p.position.x + pxo;
      const py = p.position.y + pyo;
      const pw = HITBOX_SIZE;
      const ph = HITBOX_SIZE;
      let resolved = null;
      let bestPush = Infinity;
      for (const b of boxes) {
        const bw = Math.max(16, Number(b.w) || 32);
        const bh = Math.max(16, Number(b.h) || 32);
        const overlapL = (px + pw) - b.x;
        const overlapR = (b.x + bw) - px;
        const overlapT = (py + ph) - b.y;
        const overlapB = (b.y + bh) - py;
        if (overlapL <= 0 || overlapR <= 0 || overlapT <= 0 || overlapB <= 0) continue;
        const minX = Math.min(overlapL, overlapR);
        const minY = Math.min(overlapT, overlapB);
        const push = Math.min(minX, minY);
        if (push < bestPush) {
          bestPush = push;
          resolved = { minX, minY, overlapL, overlapR, overlapT, overlapB };
        }
      }
      if (!resolved) break;
      const { minX, minY, overlapL, overlapR, overlapT, overlapB } = resolved;
      if (minX <= minY) {
        p.position.x += overlapL <= overlapR ? -overlapL : overlapR;
      } else {
        p.position.y += overlapT <= overlapB ? -overlapT : overlapB;
      }
    }
  }

  getPlayerCenter() {
    return {
      x: this.player.position.x + this.player.size * 0.5,
      y: this.player.position.y + this.player.size * 0.5
    };
  }

  findZoneAtPoint(px, py) {
    let candidate = null;
    for (const zone of this.locationZones) {
      if (!zone) continue;
      const inside = px >= zone.x
        && px <= zone.x + zone.w
        && py >= zone.y
        && py <= zone.y + zone.h;
      if (!inside) continue;
      if (!candidate || (zone.priority || 0) >= (candidate.priority || 0)) {
        candidate = zone;
      }
    }
    return candidate;
  }

  updateLocationCalloutState() {
    const { x, y } = this.getPlayerCenter();
    const zone = this.findZoneAtPoint(x, y);
    const zoneId = zone?.id || null;
    if (zoneId && zoneId !== this.currentZoneId) {
      this.tryShowLocationCallout(zone);
    }
    this.currentZoneId = zoneId;

    if (this.calloutUntil > 0 && this.time >= this.calloutUntil) {
      this.hideLocationCallout();
    }
  }

  tryShowLocationCallout(zone) {
    if (!this.locationCalloutEl || !zone?.label) return;
    const lastAt = this.calloutCooldownByZone.get(zone.id) || -9999;
    if (this.time - lastAt < 3) return;
    this.calloutCooldownByZone.set(zone.id, this.time);
    this.calloutText = zone.label;
    this.locationCalloutEl.textContent = zone.label;
    this.locationCalloutEl.classList.remove("hidden");
    this.calloutUntil = this.time + 2.1;
  }

  hideLocationCallout() {
    this.calloutUntil = 0;
    this.calloutText = "";
    if (this.locationCalloutEl) {
      this.locationCalloutEl.classList.add("hidden");
    }
  }

  startIntroIfNeeded() {
    if (!shouldShowHomeBaseIntro()) return;
    markHomeBaseIntroSeen();
    this.introState.steps = getHomeBaseIntroSteps();
    this.introState.stepIndex = 0;
    this.introState.elapsed = 0;
    this.introState.active = this.introState.steps.length > 0;
    this.applyIntroStep();
  }

  applyIntroStep() {
    if (!this.introHintEl) return;
    const step = this.introState.steps[this.introState.stepIndex] || null;
    if (!step || !this.introState.active) {
      this.hideIntroHint();
      return;
    }
    const titleEl = this.introHintEl.querySelector(".home-base-intro-title");
    const textEl = this.introHintEl.querySelector(".home-base-intro-text");
    if (titleEl) titleEl.textContent = step.title || "Home Base";
    if (textEl) textEl.textContent = step.description || "";
    this.introHintEl.classList.remove("hidden");
  }

  updateIntro(dt, movementIntent, interactPressed) {
    if (!this.introState.active) return;
    const step = this.introState.steps[this.introState.stepIndex] || null;
    if (!step) {
      this.hideIntroHint();
      return;
    }
    this.introState.elapsed += dt;

    if (this.introState.stepIndex === 0 && movementIntent && this.introState.elapsed >= 0.7) {
      this.advanceIntroStep();
      return;
    }
    if (this.introState.stepIndex === 1 && interactPressed && this.introState.elapsed >= 0.5) {
      this.advanceIntroStep();
      return;
    }
    if (this.introState.elapsed >= (step.duration || 4.5)) {
      this.advanceIntroStep();
    }
  }

  advanceIntroStep() {
    this.introState.stepIndex += 1;
    this.introState.elapsed = 0;
    if (this.introState.stepIndex >= this.introState.steps.length) {
      this.introState.active = false;
      this.hideIntroHint();
      return;
    }
    this.applyIntroStep();
  }

  hideIntroHint() {
    if (this.introHintEl) {
      this.introHintEl.classList.add("hidden");
    }
  }

  resetAmbientParticles() {
    this.ambientParticles.length = 0;
    for (const anchor of this.ambientAnchors) {
      const count = Math.max(0, Number(anchor.particleCount) || 0);
      for (let i = 0; i < count; i++) {
        this.ambientParticles.push(this.createAmbientParticle(anchor, true));
      }
    }
  }

  createAmbientParticle(anchor, initial = false) {
    const radius = Math.max(4, Number(anchor.radius) || 20);
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    const maxLife = 1.2 + Math.random() * 1.6;
    const isGolden = anchor.type === "golden";
    const vxMul = isGolden ? 3 : 11;
    const vyMul = isGolden ? 4 : 1;
    const vyBase = isGolden ? -2 : 7;
    const color = isGolden && anchor.particleColorAlt && Math.random() > 0.5
      ? anchor.particleColorAlt
      : (anchor.particleColor || "rgba(226, 232, 240, 0.85)");
    return {
      anchorId: anchor.id,
      anchorType: anchor.type,
      x: anchor.x + Math.cos(angle) * distance,
      y: anchor.y + Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * vxMul,
      vy: -(vyBase + Math.random() * vyMul * (isGolden ? 6 : 17)),
      size: isGolden ? 1.5 + Math.random() * 1.5 : 1.2 + Math.random() * 2.3,
      life: initial ? Math.random() * maxLife : maxLife,
      maxLife,
      color
    };
  }

  updateAmbientParticles(dt) {
    if (!Array.isArray(this.ambientParticles) || this.ambientParticles.length === 0) return;
    for (let i = 0; i < this.ambientParticles.length; i++) {
      const particle = this.ambientParticles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) {
        const anchor = this.ambientAnchorById.get(particle.anchorId);
        if (anchor) {
          this.ambientParticles[i] = this.createAmbientParticle(anchor, false);
        }
      }
    }
  }

  showLegacyMenuButton(visible) {
    if (!this.legacyMenuBtn) return;
    this.legacyMenuBtn.classList.toggle("hidden", !visible);
  }

  isMovementBlocked() {
    if (this.ui.isOpen()) return true;
    return this.isAnyBlockingOverlayVisible();
  }

  isAnyBlockingOverlayVisible() {
    for (const id of BLOCKING_OVERLAY_IDS) {
      if (this.isOverlayVisible(id)) return true;
    }
    return false;
  }

  isOverlayVisible(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    return !el.classList.contains("hidden");
  }

  resizeCanvas() {
    const cap = window.__gameResolutionCap || { width: 1920, height: 1080 };
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
  }

  isAtlasVisualReady() {
    return isTileAtlasLoaded() || this.itemsAtlasLoaded;
  }

  hash2d(x, y, seed = 0) {
    let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 69069);
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }

  pickWeightedTile(tileDefs, hashValue) {
    if (!Array.isArray(tileDefs) || tileDefs.length === 0) return null;
    let totalWeight = 0;
    for (const tile of tileDefs) {
      totalWeight += Math.max(0, Number(tile.weight) || 0);
    }
    if (totalWeight <= 0) return tileDefs[0] || null;

    const pick = hashValue % totalWeight;
    let cursor = 0;
    for (const tile of tileDefs) {
      cursor += Math.max(0, Number(tile.weight) || 0);
      if (pick < cursor) return tile;
    }
    return tileDefs[tileDefs.length - 1] || null;
  }

  _drawHubMapMainlevbuildLayer(grid) {
    if (!grid?.length || !this.mainlevbuildLoaded || !this.mainlevbuildImage?.complete) return;
    const ctx = this.ctx;
    const firstgid = this.layout.hubMapFirstGid ?? 1;
    const atlasCols = this.layout.hubMapAtlasCols ?? 50;
    const cols = grid[0].length;
    const rows = grid.length;
    const startGx = Math.max(0, Math.floor(this.camera.position.x / MAINLEVBUILD_TILE_SIZE));
    const startGy = Math.max(0, Math.floor(this.camera.position.y / MAINLEVBUILD_TILE_SIZE));
    const endGx = Math.min(cols, startGx + Math.ceil(this.canvas.width / MAINLEVBUILD_TILE_SIZE) + 1);
    const endGy = Math.min(rows, startGy + Math.ceil(this.canvas.height / MAINLEVBUILD_TILE_SIZE) + 1);
    for (let gy = startGy; gy < endGy; gy++) {
      for (let gx = startGx; gx < endGx; gx++) {
        const gid = grid[gy]?.[gx];
        if (!gid) continue;
        const coords = gidToTileCoords(gid, { firstgid }, atlasCols);
        if (!coords) continue;
        const worldX = gx * MAINLEVBUILD_TILE_SIZE;
        const worldY = gy * MAINLEVBUILD_TILE_SIZE;
        const screenX = Math.floor(worldX - this.camera.position.x);
        const screenY = Math.floor(worldY - this.camera.position.y);
        const sx = coords.tx * MAINLEVBUILD_TILE_SIZE;
        const sy = coords.ty * MAINLEVBUILD_TILE_SIZE;
        ctx.drawImage(
          this.mainlevbuildImage,
          sx,
          sy,
          MAINLEVBUILD_TILE_SIZE,
          MAINLEVBUILD_TILE_SIZE,
          screenX,
          screenY,
          MAINLEVBUILD_TILE_SIZE,
          MAINLEVBUILD_TILE_SIZE
        );
      }
    }
  }

  _drawHubMapTileLayerWithTilesets(grid) {
    const tilesets = this.layout.hubMapTilesets;
    if (!grid?.length || !tilesets?.length) return;
    const ctx = this.ctx;
    const cols = grid[0].length;
    const rows = grid.length;
    const startGx = Math.max(0, Math.floor(this.camera.position.x / MAINLEVBUILD_TILE_SIZE));
    const startGy = Math.max(0, Math.floor(this.camera.position.y / MAINLEVBUILD_TILE_SIZE));
    const endGx = Math.min(cols, startGx + Math.ceil(this.canvas.width / MAINLEVBUILD_TILE_SIZE) + 1);
    const endGy = Math.min(rows, startGy + Math.ceil(this.canvas.height / MAINLEVBUILD_TILE_SIZE) + 1);
    for (let gy = startGy; gy < endGy; gy++) {
      for (let gx = startGx; gx < endGx; gx++) {
        const gid = grid[gy]?.[gx];
        if (!gid) continue;
        const ts = getTilesetForGid(gid, tilesets);
        if (!ts?.image) continue;
        const coords = gidToTileCoords(gid, { firstgid: ts.firstgid }, ts.columns);
        if (!coords) continue;
        const tilesetIndex = tilesets.indexOf(ts);
        const img = tilesetIndex === 0 ? this.mainlevbuildImage : this.hubMapTilesetImages?.[tilesetIndex];
        if (!img?.complete) continue;
        const worldX = gx * MAINLEVBUILD_TILE_SIZE;
        const worldY = gy * MAINLEVBUILD_TILE_SIZE;
        const screenX = Math.floor(worldX - this.camera.position.x);
        const screenY = Math.floor(worldY - this.camera.position.y);
        const sx = coords.tx * MAINLEVBUILD_TILE_SIZE;
        const sy = coords.ty * MAINLEVBUILD_TILE_SIZE;
        ctx.drawImage(
          img,
          sx,
          sy,
          MAINLEVBUILD_TILE_SIZE,
          MAINLEVBUILD_TILE_SIZE,
          screenX,
          screenY,
          MAINLEVBUILD_TILE_SIZE,
          MAINLEVBUILD_TILE_SIZE
        );
      }
    }
  }

  drawMainlevbuildFloor() {
    if (!this.mainlevbuildLoaded || !this.mainlevbuildImage?.complete) return false;
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;
    // All tile layers in Tiled order (first = back, last = front).
    const layers = this.layout.hubMapTileLayers || [];
    for (let i = 0; i < layers.length; i++) {
      this._drawHubMapTileLayerWithTilesets(layers[i].grid);
    }
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.restore();
    return true;
  }

  drawMainlevbuildFloorDetails() {
    const detailsGrid = this.layout.floorDetailsGrid;
    if (!detailsGrid?.length || !this.mainlevbuildLoaded || !this.mainlevbuildImage?.complete) return;
    const ctx = this.ctx;
    const cols = detailsGrid[0].length;
    const rows = detailsGrid.length;
    const startGx = Math.max(0, Math.floor(this.camera.position.x / MAINLEVBUILD_TILE_SIZE));
    const startGy = Math.max(0, Math.floor(this.camera.position.y / MAINLEVBUILD_TILE_SIZE));
    const endGx = Math.min(cols, startGx + Math.ceil(this.canvas.width / MAINLEVBUILD_TILE_SIZE) + 1);
    const endGy = Math.min(rows, startGy + Math.ceil(this.canvas.height / MAINLEVBUILD_TILE_SIZE) + 1);
    const firstgid = this.layout.hubMapFirstGid ?? 1;
    const atlasCols = this.layout.hubMapAtlasCols ?? 50;
    for (let gy = startGy; gy < endGy; gy++) {
      for (let gx = startGx; gx < endGx; gx++) {
        const gid = detailsGrid[gy]?.[gx];
        if (!gid) continue;
        const coords = gidToTileCoords(gid, { firstgid }, atlasCols);
        if (!coords) continue;
        const worldX = gx * MAINLEVBUILD_TILE_SIZE;
        const worldY = gy * MAINLEVBUILD_TILE_SIZE;
        const screenX = Math.floor(worldX - this.camera.position.x);
        const screenY = Math.floor(worldY - this.camera.position.y);
        const sx = coords.tx * MAINLEVBUILD_TILE_SIZE;
        const sy = coords.ty * MAINLEVBUILD_TILE_SIZE;
        ctx.drawImage(
          this.mainlevbuildImage,
          sx,
          sy,
          MAINLEVBUILD_TILE_SIZE,
          MAINLEVBUILD_TILE_SIZE,
          screenX,
          screenY,
          MAINLEVBUILD_TILE_SIZE,
          MAINLEVBUILD_TILE_SIZE
        );
      }
    }
  }

  drawAtlasFloorZones() {
    const tileAtlas = getTileAtlas();
    if (!tileAtlas || !isTileAtlasLoaded() || !Array.isArray(this.floorTileZones)) {
      return false;
    }

    const ctx = this.ctx;
    let tilesDrawn = 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (let zoneIndex = 0; zoneIndex < this.floorTileZones.length; zoneIndex++) {
      const zone = this.floorTileZones[zoneIndex];
      if (!zone) continue;

      const startX = Math.max(0, Math.floor((this.camera.position.x - zone.x) / ATLAS_TILE_SIZE));
      const startY = Math.max(0, Math.floor((this.camera.position.y - zone.y) / ATLAS_TILE_SIZE));
      const endX = Math.min(
        Math.ceil(zone.w / ATLAS_TILE_SIZE),
        Math.ceil((this.camera.position.x + this.canvas.width - zone.x) / ATLAS_TILE_SIZE) + 1
      );
      const endY = Math.min(
        Math.ceil(zone.h / ATLAS_TILE_SIZE),
        Math.ceil((this.camera.position.y + this.canvas.height - zone.y) / ATLAS_TILE_SIZE) + 1
      );

      for (let gy = startY; gy < endY; gy++) {
        for (let gx = startX; gx < endX; gx++) {
          const worldX = zone.x + gx * ATLAS_TILE_SIZE;
          const worldY = zone.y + gy * ATLAS_TILE_SIZE;
          const screenX = Math.floor(worldX - this.camera.position.x);
          const screenY = Math.floor(worldY - this.camera.position.y);

          const tileHash = this.hash2d(gx + Math.floor(zone.x / ATLAS_TILE_SIZE), gy + Math.floor(zone.y / ATLAS_TILE_SIZE), zoneIndex + 31);
          const noise01 = (tileHash % 1000) / 1000;
          const useAccent = noise01 < (Number(zone.accentChance) || 0);
          const chosenTile = useAccent
            ? this.pickWeightedTile(zone.accentTiles, tileHash >>> 3)
            : this.pickWeightedTile(zone.baseTiles, tileHash >>> 5);
          if (!chosenTile) continue;
          const coords = getTileCoords(chosenTile.row, chosenTile.col);
          if (!coords) continue;

          ctx.drawImage(
            tileAtlas,
            coords.x,
            coords.y,
            coords.width,
            coords.height,
            screenX,
            screenY,
            ATLAS_TILE_SIZE,
            ATLAS_TILE_SIZE
          );
          tilesDrawn += 1;
        }
      }
    }

    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return tilesDrawn > 0;
  }

  getItemsAtlasCoords(row, col) {
    const rowIndex = Math.max(0, Number(row) - 1);
    const colIndex = String(col || "a").toLowerCase().charCodeAt(0) - 97;
    if (colIndex < 0) return null;
    return {
      x: colIndex * ITEMS_ATLAS_TILE,
      y: rowIndex * ITEMS_ATLAS_TILE,
      w: ITEMS_ATLAS_TILE,
      h: ITEMS_ATLAS_TILE
    };
  }

  _loadImageProps() {
    if (!Array.isArray(this.imageProps)) return;
    for (const prop of this.imageProps) {
      this._loadSingleImageProp(prop);
    }
  }

  _loadSingleImageProp(prop) {
    if (!prop?.src) return;
    const img = new Image();
    img.addEventListener("load", () => {
      this.imagePropCache.set(prop.id, { prop, image: img });
    });
    img.addEventListener("error", () => {
      this.imagePropCache.delete(prop.id);
    });
    img.src = prop.src;
  }

  _loadPeaceClouds() {
    const config = this.peaceFloatingClouds;
    if (!config?.clouds?.length) return;
    for (const cloud of config.clouds) {
      if (!cloud?.src) continue;
      const img = new Image();
      img.addEventListener("load", () => {
        this.peaceCloudCache.set(cloud.id, { cloud, image: img });
      });
      img.addEventListener("error", () => {
        this.peaceCloudCache.delete(cloud.id);
      });
      img.src = cloud.src;
    }
  }

  _loadRedPandaRoam() {
    const config = this.layout.redPandaRoam;
    if (!config?.spriteSheet || !config?.spriteJson) return;
    const img = new Image();
    img.addEventListener("load", () => {
      this.redPandaSheet = img;
      this._applyRedPandaJson(config);
    });
    img.addEventListener("error", () => {
      this.redPandaSheet = null;
    });
    img.src = config.spriteSheet;
    fetch(config.spriteJson)
      .then((r) => r.json())
      .then((data) => {
        this._redPandaJsonData = data;
        this._applyRedPandaJson(config);
      })
      .catch(() => {});
  }

  _applyRedPandaJson(config) {
    if (!this.redPandaSheet?.complete || !this._redPandaJsonData?.frames) return;
    const frames = this._redPandaJsonData.frames;
    const anims = {};
    const re = /\(([^)]+)\)\s*(\d+)\.ase$/;
    for (const key of Object.keys(frames)) {
      const m = key.match(re);
      if (!m) continue;
      const tag = m[1];
      const index = parseInt(m[2], 10);
      const f = frames[key];
      const rect = f.frame || f;
      if (!anims[tag]) anims[tag] = [];
      anims[tag][index] = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, duration: (f.duration ?? 100) / 1000, index };
    }
    for (const tag of Object.keys(anims)) {
      anims[tag] = anims[tag].filter(Boolean).sort((a, b) => a.index - b.index);
    }
    this.redPandaAnimations = anims;
    if (!this.redPanda && config) {
      const cx = Number(config.centerX) || 0;
      const cy = Number(config.centerY) || 0;
      const rx = Number(config.radiusX) || 80;
      const ry = Number(config.radiusY) || 60;
      this.redPanda = {
        x: cx + (Math.random() - 0.5) * rx,
        y: cy + (Math.random() - 0.5) * ry,
        vx: 0,
        vy: 0,
        state: "idle",
        animName: "Idle",
        frameIndex: 0,
        frameTime: 0,
        direction: 1,
        stateTime: 0,
        stateDuration: 2 + Math.random() * 2,
        idleTime: 0,
        attackCooldown: 0
      };
    }
  }

  _loadAxolotlRoam() {
    const config = this.layout.axolotlRoam;
    if (!config?.animations?.length || !config.basePath) return;
    const basePath = config.basePath;
    let pending = config.animations.length;
    const tryInit = () => {
      pending--;
      if (pending > 0) return;
      const cx = Number(config.centerX) || 0;
      const cy = Number(config.centerY) || 0;
      const rx = Number(config.radiusX) || 80;
      const ry = Number(config.radiusY) || 55;
      if (!this.axolotl) {
        this.axolotl = {
          x: cx + (Math.random() - 0.5) * rx,
          y: cy + (Math.random() - 0.5) * ry,
          vx: 0,
          vy: 0,
          state: "resting_idle",
          animName: "Resting_Idle",
          frameIndex: 0,
          frameTime: 0,
          stateTime: 0,
          stateDuration: 2 + Math.random() * 2,
          direction: 1
        };
      }
    };
    for (const anim of config.animations) {
      const path = basePath + anim.file;
      const img = new Image();
      img.addEventListener("load", () => {
        const cols = Math.max(1, anim.cols ?? 1);
        const rows = Math.max(1, anim.rows ?? 1);
        const total = anim.frameCount ?? (cols * rows);
        const frameCount = Math.min(total, cols * rows);
        const frameW = img.naturalWidth / cols;
        const frameH = img.naturalHeight / rows;
        const frames = [];
        for (let i = 0; i < frameCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          frames.push({
            x: col * frameW,
            y: row * frameH,
            w: frameW,
            h: frameH
          });
        }
        this.axolotlSheets.set(anim.name, { image: img, frames });
        tryInit();
      });
      img.addEventListener("error", tryInit);
      img.src = path;
    }
  }

  _loadBlobfishRoam() {
    const config = this.layout.blobfishRoam;
    if (!config?.spriteSheet || !config?.columns?.length) return;
    const img = new Image();
    img.addEventListener("load", () => {
      this.blobfishSheet = img;
      const fw = Number(config.frameWidth) || 32;
      const fh = Number(config.frameHeight) || 32;
      const maxRows = Math.max(1, Math.floor(img.naturalHeight / fh));
      const anims = {};
      for (const colDef of config.columns) {
        const frameCount = Math.min(maxRows, Math.max(1, colDef.frames ?? maxRows));
        const frames = [];
        for (let row = 0; row < frameCount; row++) {
          frames.push({
            x: colDef.col * fw,
            y: row * fh,
            w: fw,
            h: fh,
            duration: (Number(config.frameDuration) || 0.1)
          });
        }
        anims[colDef.name] = frames;
      }
      this.blobfishAnimations = anims;
      if (!this.blobfish && config) {
        const cx = Number(config.centerX) || 0;
        const cy = Number(config.centerY) || 0;
        const rx = Number(config.radiusX) || 80;
        const ry = Number(config.radiusY) || 50;
        this.blobfish = {
          x: cx + (Math.random() - 0.5) * rx,
          y: cy + (Math.random() - 0.5) * ry,
          vx: 0,
          vy: 0,
          state: "idle",
          animName: "Idle",
          frameIndex: 0,
          frameTime: 0,
          direction: 1,
          stateTime: 0,
          stateDuration: 2 + Math.random() * 2
        };
      }
    });
    img.addEventListener("error", () => {
      this.blobfishSheet = null;
    });
    img.src = config.spriteSheet;
  }

  drawPeaceFloatingClouds() {
    const config = this.peaceFloatingClouds;
    if (!config?.clouds?.length) return;
    const ctx = this.ctx;
    const centerX = config.centerX ?? 0;
    const centerY = config.centerY ?? 0;
    const orbitSpeed = config.orbitSpeed ?? 0.035;
    const bobAmplitude = config.bobAmplitude ?? 10;
    const bobSpeed = config.bobSpeed ?? 0.5;

    const drawables = [];
    for (const cloud of config.clouds) {
      const entry = this.peaceCloudCache.get(cloud.id);
      if (!entry?.image?.complete) continue;
      const item = {
        radius: cloud.radius ?? 80,
        radiusY: cloud.radiusY ?? 40,
        angleOffset: cloud.angleOffset ?? 0,
        bobPhase: cloud.bobPhase ?? 0,
        orbitSpeed,
        bobAmplitude,
        bobSpeed
      };
      const t = getOrbitSpriteTransform(item, centerX, centerY, this.time);
      const w = Math.max(16, Number(cloud.w) || 64);
      const h = Math.max(8, Number(cloud.h) || 32);
      drawables.push({ x: t.x, y: t.y, w, h, image: entry.image });
    }
    drawables.sort((a, b) => a.y - b.y);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    const cloudAlpha = Number(config.alpha) >= 0 && Number(config.alpha) <= 1 ? config.alpha : 0.65;
    ctx.globalAlpha = cloudAlpha;
    for (const d of drawables) {
      const sx = Math.floor(d.x - d.w * 0.5 - this.camera.position.x);
      const sy = Math.floor(d.y - d.h * 0.5 - this.camera.position.y);
      if (sx + d.w < -40 || sy + d.h < -40 || sx > this.canvas.width + 40 || sy > this.canvas.height + 40) continue;
      ctx.drawImage(d.image, 0, 0, d.image.naturalWidth, d.image.naturalHeight, sx, sy, d.w, d.h);
    }
    ctx.restore();
  }

  drawOrbitSprites() {
    if (!this.itemsAtlas?.complete || !this.itemsAtlasLoaded || !Array.isArray(this.orbitConfigs) || this.orbitConfigs.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const groupsByPillar = new Map();
    for (const config of this.orbitConfigs) {
      const key = config.pillarImageId ?? "\0";
      if (!groupsByPillar.has(key)) groupsByPillar.set(key, []);
      groupsByPillar.get(key).push(config);
    }

    for (const [pillarId, configs] of groupsByPillar) {
      const drawables = [];
      let pillarProp = null;
      let pillarCenterY = null;

      if (pillarId !== "\0") {
        pillarProp = (this.layout.imageProps || []).find((p) => p.id === pillarId);
        if (pillarProp) {
          const aspectRatio = Number(pillarProp.aspectRatio) || 1;
          const h = pillarProp.w / aspectRatio;
          pillarCenterY = pillarProp.y + h * 0.5;
          drawables.push({ type: "pillar", sortY: pillarCenterY, pillarProp });
        }
      }

      for (const config of configs) {
        const orbitList = buildOrbitDrawList(config, this.time);
        const orbitCenterY = config.centerY;
        for (const entry of orbitList) {
          let sortY;
          if (pillarCenterY != null) {
            if (entry.y > orbitCenterY) {
              sortY = Math.max(entry.y, pillarCenterY + 0.5);
            } else {
              sortY = Math.min(entry.y, pillarCenterY - 0.5);
            }
          } else {
            sortY = entry.y;
          }
          drawables.push({ type: "orbit", sortY, entry });
        }
      }

      drawables.sort((a, b) => a.sortY - b.sortY);

      for (const d of drawables) {
        if (d.type === "pillar") {
          const prop = d.pillarProp;
          const entry = this.imagePropCache.get(prop.id);
          if (!entry?.image?.complete) continue;
          const sx = Math.floor(prop.x - this.camera.position.x);
          const sy = Math.floor(prop.y - this.camera.position.y);
          const w = Math.max(8, Number(prop.w) || 96);
          const aspectRatio = Number(prop.aspectRatio) || 1;
          const drawH = w / aspectRatio;
          if (sx + w < -40 || sy + drawH < -40 || sx > this.canvas.width + 40 || sy > this.canvas.height + 40) continue;
          ctx.globalAlpha = Number.isFinite(prop.alpha) ? prop.alpha : 1;
          ctx.drawImage(entry.image, 0, 0, entry.image.naturalWidth, entry.image.naturalHeight, sx, sy, w, drawH);
          ctx.globalAlpha = 1;
        } else {
          const entry = d.entry;
          const coords = this.getItemsAtlasCoords(entry.row, entry.col);
          if (!coords) continue;
          const sx = Math.floor(entry.x - this.camera.position.x);
          const sy = Math.floor(entry.y - this.camera.position.y);
          const size = Math.max(8, entry.spriteSize || 24);
          if (sx + size < -40 || sy + size < -40 || sx > this.canvas.width + 40 || sy > this.canvas.height + 40) continue;
          ctx.drawImage(
            this.itemsAtlas,
            coords.x, coords.y, coords.w, coords.h,
            sx, sy, size, size
          );
        }
      }
    }
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
  }

  updateCascadePillarRain(dt) {
    const config = this.layout.cascadePillarRain;
    if (!config || config.count < 1) return;
    const pillarId = config.pillarImageId || "cascade-pillar";
    const pillarProp = (this.layout.imageProps || []).find((p) => p.id === pillarId);
    const width = Math.max(20, Number(pillarProp?.w) || Number(config.width) || 200);
    const aspectRatio = Number(pillarProp?.aspectRatio) || 1024 / 1536;
    const pillarH = pillarProp ? width / aspectRatio : 400;
    const centerX = pillarProp ? pillarProp.x + width * 0.5 : Number(config.centerX) || 0;
    const topY = pillarProp ? pillarProp.y : Number(config.topY) || 0;
    const bottomY = pillarProp ? pillarProp.y + pillarH : Number(config.bottomY) ?? topY + 400;
    const prev = this._cascadeRainBounds;
    if (prev && this.cascadeRainDrops?.length) {
      const dx = centerX - prev.centerX;
      const dy = topY - prev.topY;
      if (dx !== 0 || dy !== 0) {
        for (const p of this.cascadeRainDrops) {
          p.x += dx;
          p.y += dy;
          for (const t of p.trailPositions || []) {
            t.x += dx;
            t.y += dy;
          }
        }
        for (const p of this.cascadeRainDropsDelayed || []) {
          p.x += dx;
          p.y += dy;
          for (const t of p.trailPositions || []) {
            t.x += dx;
            t.y += dy;
          }
        }
      }
    }
    this._cascadeRainBounds = { centerX, topY, bottomY, width };
    const count = Math.min(12, Math.max(10, config.count | 0));
    const fallSpeed = Number(config.fallSpeed) || 200;
    const acceleration = Number(config.acceleration) ?? 90;
    const trailLen = Math.min(12, Math.max(4, config.trailLength | 0));
    const halfW = width * 0.5;

    const CASCADE_STYLE_CYCLE = [
      { preset: "arcaneBolt" },
      { preset: "fireOrb" },
      { preset: "frostShard", rotationSpeed: 2 },
      { preset: "ancientSigil", rotationSpeed: 3 }
    ];

    const delaySec = 0.5;
    const spawnYOffset = fallSpeed * delaySec;
    const rand095105 = () => 0.95 + Math.random() * 0.1;

    if (!this.cascadeRainDrops) {
      this.cascadeRainDrops = [];
      for (let i = 0; i < count; i++) {
        const x = centerX - halfW + Math.random() * width;
        const speedMult = rand095105();
        this.cascadeRainDrops.push({
          x,
          y: topY + (i / count) * (bottomY - topY) * 0.3,
          vy: fallSpeed * speedMult,
          speedMult,
          sizeMult: rand095105(),
          trailPositions: [],
          magicStyle: CASCADE_STYLE_CYCLE[i % CASCADE_STYLE_CYCLE.length]
        });
      }
    }
    const staggerRange = (bottomY - topY) * 0.3;
    if (!this.cascadeRainDropsDelayed) {
      this.cascadeRainDropsDelayed = [];
      for (let i = 0; i < count; i++) {
        const x = centerX - halfW + Math.random() * width;
        const staggerFraction = i / count;
        const speedMult = rand095105();
        this.cascadeRainDropsDelayed.push({
          x,
          y: topY - spawnYOffset + staggerFraction * staggerRange,
          staggerFraction,
          vy: fallSpeed * speedMult,
          speedMult,
          sizeMult: rand095105(),
          trailPositions: [],
          magicStyle: CASCADE_STYLE_CYCLE[i % CASCADE_STYLE_CYCLE.length]
        });
      }
    }

    for (const p of this.cascadeRainDrops) {
      if (p.vy == null) p.vy = fallSpeed * (p.speedMult ?? 1);
      p.vy += acceleration * dt;
      p.y += p.vy * dt;
      p.trailPositions.push({ x: p.x, y: p.y });
      if (p.trailPositions.length > trailLen) p.trailPositions.shift();
      if (p.y >= bottomY) {
        p.y = topY;
        p.x = centerX - halfW + Math.random() * width;
        p.vy = fallSpeed * (p.speedMult ?? 1);
        p.trailPositions.length = 0;
      }
    }
    for (const p of this.cascadeRainDropsDelayed) {
      if (p.vy == null) p.vy = fallSpeed * (p.speedMult ?? 1);
      p.vy += acceleration * dt;
      p.y += p.vy * dt;
      p.trailPositions.push({ x: p.x, y: p.y });
      if (p.trailPositions.length > trailLen) p.trailPositions.shift();
      if (p.y >= bottomY) {
        p.y = topY - spawnYOffset + (p.staggerFraction ?? 0) * staggerRange;
        p.x = centerX - halfW + Math.random() * width;
        p.vy = fallSpeed * (p.speedMult ?? 1);
        p.trailPositions.length = 0;
      }
    }
  }

  drawCascadePillarRain() {
    const config = this.layout.cascadePillarRain;
    if (!config || !this.cascadeRainDrops?.length) return;
    const ctx = this.ctx;
    const size = Number(config.size) || 12;
    const angle = Math.PI * 0.5;
    const afterimageCount = Math.min(8, Math.max(4, config.trailLength ?? 8));

    const drawDropWithAfterimages = (p) => {
      const baseSize = size * (p.sizeMult ?? 1);
      const trail = p.trailPositions || [];
      const trailSegment = trail.length <= afterimageCount ? trail : trail.slice(-afterimageCount);
      for (let i = 0; i < trailSegment.length; i++) {
        const t = trailSegment[i];
        const progress = (i + 1) / trailSegment.length;
        const alpha = progress * 0.5;
        const scale = 0.35 + 0.6 * progress;
        const tsx = Math.floor(t.x - this.camera.position.x) - (baseSize * scale) / 2;
        const tsy = Math.floor(t.y - this.camera.position.y) - (baseSize * scale) / 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        const afterOpts = getMagicProjectileDrawOptions(p.magicStyle, {
          sx: tsx,
          sy: tsy,
          angle,
          size: baseSize * scale,
          trailPositions: [],
          camera: this.camera,
          time: this.time
        });
        drawMagicProjectile(ctx, afterOpts);
        ctx.restore();
      }
      const sx = Math.floor(p.x - this.camera.position.x);
      const sy = Math.floor(p.y - this.camera.position.y);
      const halfSize = baseSize / 2;
      const trailAsTopLeft = (p.trailPositions || []).map((t) => ({
        x: t.x - halfSize,
        y: t.y - halfSize
      }));
      const opts = getMagicProjectileDrawOptions(p.magicStyle, {
        sx,
        sy,
        angle,
        size: baseSize,
        trailPositions: trailAsTopLeft,
        camera: this.camera,
        time: this.time
      });
      drawMagicProjectile(ctx, opts);
    };

    for (const p of this.cascadeRainDrops) drawDropWithAfterimages(p);
    for (const p of this.cascadeRainDropsDelayed || []) drawDropWithAfterimages(p);
  }

  updateRedPandaRoam(dt) {
    const config = this.layout.redPandaRoam;
    const p = this.redPanda;
    if (!config || !p || !this.redPandaAnimations) return;
    const cx = Number(config.centerX) || 0;
    const cy = Number(config.centerY) || 0;
    const rx = Number(config.radiusX) || 80;
    const ry = Number(config.radiusY) || 60;
    const walkSpeed = Number(config.walkSpeed) || 25;
    const idleMin = Number(config.idleMinDuration) ?? 1;
    const idleMax = Number(config.idleMaxDuration) ?? 3;
    const walkMin = Number(config.walkMinDuration) ?? 1.5;
    const walkMax = Number(config.walkMaxDuration) ?? 4;
    const sleepThreshold = Number(config.sleepIdleThreshold) ?? 7;
    const sleepChance = Number(config.sleepChancePerSec) ?? 0.2;
    const sleepMin = Number(config.sleepMinDuration) ?? 4;
    const sleepMax = Number(config.sleepMaxDuration) ?? 8;
    const attackRadius = Number(config.attackPlayerRadius) ?? 55;
    const attackDuration = Number(config.attackDuration) ?? 0.9;
    const attackCooldownAfter = Number(config.attackCooldownAfter) ?? 6;
    const anims = this.redPandaAnimations;

    if (p.attackCooldown > 0) p.attackCooldown -= dt;

    const playerCenter = this.getPlayerCenter?.() ?? { x: cx, y: cy };
    const distToPlayer = Math.hypot(p.x - playerCenter.x, p.y - playerCenter.y);

    const pickIdleAnim = () => {
      p.animName = (anims.Idle2?.length && Math.random() < 0.4) ? "Idle2" : "Idle";
    };

    p.stateTime += dt;

    if (p.state === "sleeping") {
      p.vx = 0;
      p.vy = 0;
      if (p.stateTime >= p.stateDuration) {
        p.state = "idle";
        p.idleTime = 0;
        pickIdleAnim();
        p.stateTime = 0;
        p.stateDuration = idleMin + Math.random() * (idleMax - idleMin);
      }
    } else if (p.state === "attack") {
      p.vx = 0;
      p.vy = 0;
      if (p.stateTime >= p.stateDuration) {
        p.state = "idle";
        p.idleTime = 0;
        p.attackCooldown = attackCooldownAfter;
        pickIdleAnim();
        p.stateTime = 0;
        p.stateDuration = idleMin + Math.random() * (idleMax - idleMin);
      }
    } else if (p.state === "idle") {
      p.idleTime += dt;
      p.vx = 0;
      p.vy = 0;
      if (distToPlayer < attackRadius && p.attackCooldown <= 0 && anims.Attack?.length) {
        p.state = "attack";
        p.animName = "Attack";
        p.frameIndex = 0;
        p.frameTime = 0;
        p.stateTime = 0;
        p.stateDuration = attackDuration;
        const dx = playerCenter.x - p.x;
        p.direction = dx >= 0 ? 1 : -1;
      } else if (p.idleTime >= sleepThreshold && anims.Sleep?.length && Math.random() < sleepChance * dt) {
        p.state = "sleeping";
        p.animName = "Sleep";
        p.frameIndex = 0;
        p.frameTime = 0;
        p.stateTime = 0;
        p.stateDuration = sleepMin + Math.random() * (sleepMax - sleepMin);
      } else if (p.stateTime >= p.stateDuration) {
        p.state = "walking";
        p.animName = anims.Movement?.length ? "Movement" : "Idle";
        p.stateDuration = walkMin + Math.random() * (walkMax - walkMin);
        const angle = Math.random() * Math.PI * 2;
        p.vx = Math.cos(angle) * walkSpeed * (Math.random() < 0.5 ? 1 : -1);
        p.vy = Math.sin(angle) * walkSpeed * (Math.random() < 0.5 ? 1 : -1);
        p.direction = p.vx >= 0 ? 1 : -1;
        p.stateTime = 0;
      }
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(cx - rx, Math.min(cx + rx, p.x));
      p.y = Math.max(cy - ry, Math.min(cy + ry, p.y));
      if (p.x <= cx - rx + 2 || p.x >= cx + rx - 2) p.vx = -p.vx;
      if (p.y <= cy - ry + 2 || p.y >= cy + ry - 2) p.vy = -p.vy;
      p.direction = p.vx >= 0 ? 1 : -1;

      if (p.stateTime >= p.stateDuration) {
        p.state = "idle";
        p.idleTime = 0;
        pickIdleAnim();
        p.vx = 0;
        p.vy = 0;
        p.stateTime = 0;
        p.stateDuration = idleMin + Math.random() * (idleMax - idleMin);
      }
    }

    const animFrames = anims[p.animName];
    if (animFrames?.length) {
      if (p.state === "idle") {
        p.frameIndex = 0;
        p.frameTime = 0;
      } else {
        p.frameTime += dt;
        if (p.frameTime > 0.2) p.frameTime = 0.2;
        const frame = animFrames[p.frameIndex];
        const dur = frame?.duration ?? 0.1;
        while (p.frameTime >= dur) {
          p.frameTime -= dur;
          p.frameIndex = (p.frameIndex + 1) % animFrames.length;
        }
      }
    }
  }

  drawRedPandaRoam() {
    const p = this.redPanda;
    if (!this.redPandaSheet?.complete || !p || !this.redPandaAnimations) return;
    const frames = this.redPandaAnimations[p.animName];
    if (!frames?.length) return;
    const frame = frames[p.frameIndex] ?? frames[0];
    if (!frame) return;
    const ctx = this.ctx;
    const displayW = 64;
    const displayH = 64;
    const sx = Math.floor(p.x - this.camera.position.x) - displayW / 2;
    const sy = Math.floor(p.y - this.camera.position.y) - displayH;
    if (sx + displayW < -40 || sy + displayH < -40 || sx > this.canvas.width + 40 || sy > this.canvas.height + 40) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (p.direction < 0) {
      const cx = sx + displayW / 2;
      const cy = sy + displayH / 2;
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(
      this.redPandaSheet,
      frame.x, frame.y, frame.w, frame.h,
      sx, sy, displayW, displayH
    );
    ctx.restore();
  }

  updateAxolotlRoam(dt) {
    const config = this.layout.axolotlRoam;
    const a = this.axolotl;
    if (!config || !a || this.axolotlSheets.size === 0) return;
    const cx = Number(config.centerX) || 0;
    const cy = Number(config.centerY) || 0;
    const rx = Number(config.radiusX) || 90;
    const ry = Number(config.radiusY) || 55;
    const swimSpeed = Number(config.swimSpeed) || 22;
    const restIdleMin = Number(config.restIdleMin) ?? 2;
    const restIdleMax = Number(config.restIdleMax) ?? 5;
    const swimMin = Number(config.swimMin) ?? 2;
    const swimMax = Number(config.swimMax) ?? 4;
    const floatMin = Number(config.floatMin) ?? 2;
    const floatMax = Number(config.floatMax) ?? 4;
    const transitionDuration = Number(config.transitionDuration) ?? 0.8;
    const frameDuration = Number(config.frameDuration) ?? 0.12;

    a.stateTime += dt;

    const setTransition = (nextState, animName, duration) => {
      a.state = nextState;
      a.animName = animName;
      a.frameIndex = 0;
      a.frameTime = 0;
      a.stateTime = 0;
      a.stateDuration = duration;
    };

    if (a.state === "resting_idle") {
      a.vx = 0;
      a.vy = 0;
      if (a.stateTime >= a.stateDuration) {
        if (Math.random() < 0.5) {
          setTransition("preparing_to_swim", "Preparing_To_Swim", transitionDuration);
        } else {
          a.state = "floating";
          a.animName = "Floating";
          a.frameIndex = 0;
          a.frameTime = 0;
          a.stateTime = 0;
          a.stateDuration = floatMin + Math.random() * (floatMax - floatMin);
        }
      }
    } else if (a.state === "preparing_to_swim") {
      a.vx = 0;
      a.vy = 0;
      if (a.stateTime >= a.stateDuration) {
        a.state = "swimming";
        a.animName = "Swimming";
        a.frameIndex = 0;
        a.frameTime = 0;
        a.stateTime = 0;
        a.stateDuration = swimMin + Math.random() * (swimMax - swimMin);
        const angle = Math.random() * Math.PI * 2;
        a.vx = Math.cos(angle) * swimSpeed;
        a.vy = Math.sin(angle) * swimSpeed;
        a.direction = a.vx >= 0 ? 1 : -1;
      }
    } else if (a.state === "swimming") {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.x = Math.max(cx - rx, Math.min(cx + rx, a.x));
      a.y = Math.max(cy - ry, Math.min(cy + ry, a.y));
      if (a.x <= cx - rx + 2 || a.x >= cx + rx - 2) a.vx = -a.vx;
      if (a.y <= cy - ry + 2 || a.y >= cy + ry - 2) a.vy = -a.vy;
      a.direction = a.vx >= 0 ? 1 : -1;
      if (a.stateTime >= a.stateDuration) {
        setTransition("getting_down", "Getting_Down", transitionDuration);
      }
    } else if (a.state === "getting_down") {
      a.vx = 0;
      a.vy = 0;
      if (a.stateTime >= a.stateDuration) {
        a.state = "resting";
        a.animName = "Resting";
        a.frameIndex = 0;
        a.frameTime = 0;
        a.stateTime = 0;
        a.stateDuration = restIdleMin + Math.random() * (restIdleMax - restIdleMin);
      }
    } else if (a.state === "resting") {
      a.vx = 0;
      a.vy = 0;
      if (a.stateTime >= a.stateDuration) {
        a.state = "resting_idle";
        a.animName = "Resting_Idle";
        a.frameIndex = 0;
        a.frameTime = 0;
        a.stateTime = 0;
        a.stateDuration = restIdleMin + Math.random() * (restIdleMax - restIdleMin);
      }
    } else if (a.state === "floating") {
      a.vx = 0;
      a.vy = 0;
      if (a.stateTime >= a.stateDuration) {
        a.state = "floating_idle";
        a.animName = "Floating_Idle";
        a.frameIndex = 0;
        a.frameTime = 0;
        a.stateTime = 0;
        a.stateDuration = floatMin + Math.random() * (floatMax - floatMin);
      }
    } else if (a.state === "floating_idle") {
      a.vx = 0;
      a.vy = 0;
      if (a.stateTime >= a.stateDuration) {
        setTransition("getting_down", "Getting_Down", transitionDuration);
      }
    }

    const sheet = this.axolotlSheets.get(a.animName);
    const frames = sheet?.frames;
    if (sheet?.image?.complete && frames?.length > 1) {
      a.frameTime += dt;
      if (a.frameTime >= frameDuration) {
        a.frameTime = 0;
        a.frameIndex = (a.frameIndex + 1) % frames.length;
      }
    }
  }

  drawAxolotlRoam() {
    const a = this.axolotl;
    if (!a || this.axolotlSheets.size === 0) return;
    const sheet = this.axolotlSheets.get(a.animName);
    if (!sheet?.image?.complete || !sheet.frames?.length) return;
    const img = sheet.image;
    const frame = sheet.frames[Math.min(a.frameIndex, sheet.frames.length - 1)] ?? sheet.frames[0];
    const ctx = this.ctx;
    const displayW = 40;
    const displayH = Math.round((displayW / frame.w) * frame.h);
    const screenX = Math.floor(a.x - this.camera.position.x) - displayW / 2;
    const screenY = Math.floor(a.y - this.camera.position.y) - displayH;
    if (screenX + displayW < -40 || screenY + displayH < -40 || screenX > this.canvas.width + 40 || screenY > this.canvas.height + 40) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (a.direction >= 0) {
      const cx = screenX + displayW / 2;
      const cy = screenY + displayH / 2;
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, screenX, screenY, displayW, displayH);
    ctx.restore();
  }

  updateBlobfishRoam(dt) {
    const config = this.layout.blobfishRoam;
    const b = this.blobfish;
    if (!config || !b || !this.blobfishAnimations) return;
    const cx = Number(config.centerX) || 0;
    const cy = Number(config.centerY) || 0;
    const rx = Number(config.radiusX) || 85;
    const ry = Number(config.radiusY) || 50;
    const walkSpeed = Number(config.walkSpeed) || 24;
    const idleMin = Number(config.idleMinDuration) ?? 1.5;
    const idleMax = Number(config.idleMaxDuration) ?? 4;
    const walkMin = Number(config.walkMinDuration) ?? 2;
    const walkMax = Number(config.walkMaxDuration) ?? 5;
    const jumpDuration = Number(config.jumpDuration) ?? 0.7;
    const cryMin = Number(config.cryMinDuration) ?? 2;
    const cryMax = Number(config.cryMaxDuration) ?? 4;
    const cryChance = Number(config.cryChance) ?? 0.15;
    const jumpChance = Number(config.jumpChance) ?? 0.25;
    const frameDuration = Number(config.frameDuration) ?? 0.1;
    const anims = this.blobfishAnimations;

    b.stateTime += dt;

    if (b.state === "idle") {
      b.vx = 0;
      b.vy = 0;
      if (b.stateTime >= b.stateDuration) {
        const r = Math.random();
        if (r < cryChance && anims.Crying?.length) {
          b.state = "crying";
          b.animName = "Crying";
          b.frameIndex = 0;
          b.frameTime = 0;
          b.stateTime = 0;
          b.stateDuration = cryMin + Math.random() * (cryMax - cryMin);
        } else if (r < cryChance + jumpChance && anims.Jumping?.length) {
          b.state = "jumping";
          b.animName = "Jumping";
          b.frameIndex = 0;
          b.frameTime = 0;
          b.stateTime = 0;
          b.stateDuration = jumpDuration;
        } else if (anims.Walking?.length) {
          b.state = "walking";
          b.animName = "Walking";
          b.frameIndex = 0;
          b.frameTime = 0;
          b.stateTime = 0;
          b.stateDuration = walkMin + Math.random() * (walkMax - walkMin);
          const angle = Math.random() * Math.PI * 2;
          b.vx = Math.cos(angle) * walkSpeed;
          b.vy = Math.sin(angle) * walkSpeed;
          b.direction = b.vx >= 0 ? 1 : -1;
        } else {
          b.stateTime = 0;
          b.stateDuration = idleMin + Math.random() * (idleMax - idleMin);
        }
      }
    } else if (b.state === "walking") {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = Math.max(cx - rx, Math.min(cx + rx, b.x));
      b.y = Math.max(cy - ry, Math.min(cy + ry, b.y));
      if (b.x <= cx - rx + 2 || b.x >= cx + rx - 2) b.vx = -b.vx;
      if (b.y <= cy - ry + 2 || b.y >= cy + ry - 2) b.vy = -b.vy;
      b.direction = b.vx >= 0 ? 1 : -1;
      if (b.stateTime >= b.stateDuration) {
        b.state = "idle";
        b.animName = "Idle";
        b.frameIndex = 0;
        b.frameTime = 0;
        b.vx = 0;
        b.vy = 0;
        b.stateTime = 0;
        b.stateDuration = idleMin + Math.random() * (idleMax - idleMin);
      }
    } else if (b.state === "jumping") {
      b.vx = 0;
      b.vy = 0;
      if (b.stateTime >= b.stateDuration) {
        b.state = "idle";
        b.animName = "Idle";
        b.frameIndex = 0;
        b.frameTime = 0;
        b.stateTime = 0;
        b.stateDuration = idleMin + Math.random() * (idleMax - idleMin);
      }
    } else if (b.state === "crying") {
      b.vx = 0;
      b.vy = 0;
      if (b.stateTime >= b.stateDuration) {
        b.state = "idle";
        b.animName = "Idle";
        b.frameIndex = 0;
        b.frameTime = 0;
        b.stateTime = 0;
        b.stateDuration = idleMin + Math.random() * (idleMax - idleMin);
      }
    }

    const animFrames = anims[b.animName];
    if (!animFrames?.length) return;
    const len = animFrames.length;
    if (len === 1) {
      b.frameIndex = 0;
      b.frameTime = 0;
      return;
    }
    b.frameIndex = Math.min(b.frameIndex, len - 1);
    b.frameTime += dt;
    const frame = animFrames[b.frameIndex];
    const dur = frame?.duration ?? frameDuration;
    while (b.frameTime >= dur) {
      b.frameTime -= dur;
      b.frameIndex = (b.frameIndex + 1) % len;
    }
  }

  drawBlobfishRoam() {
    const b = this.blobfish;
    if (!this.blobfishSheet?.complete || !b || !this.blobfishAnimations) return;
    const frames = this.blobfishAnimations[b.animName];
    if (!frames?.length) return;
    const frame = frames[b.frameIndex] ?? frames[0];
    if (!frame) return;
    const ctx = this.ctx;
    const displayW = 32;
    const displayH = 32;
    const sx = Math.floor(b.x - this.camera.position.x) - displayW / 2;
    const sy = Math.floor(b.y - this.camera.position.y) - displayH;
    if (sx + displayW < -40 || sy + displayH < -40 || sx > this.canvas.width + 40 || sy > this.canvas.height + 40) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (b.direction >= 0) {
      const cx = sx + displayW / 2;
      const cy = sy + displayH / 2;
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(
      this.blobfishSheet,
      frame.x, frame.y, frame.w, frame.h,
      sx, sy, displayW, displayH
    );
    ctx.restore();
  }

  drawImageProps() {
    if (!Array.isArray(this.imageProps) || this.imageProps.length === 0) return;
    const ctx = this.ctx;
    const effectiveHeight = (prop) => {
      const ar = Number(prop.aspectRatio);
      if (ar > 0) return (Number(prop.w) || 96) / ar;
      return Number(prop.h) || 96;
    };
    const sorted = this.imageProps
      .slice()
      .sort((a, b) => {
        const layerA = a.layer === "back" ? 0 : 1;
        const layerB = b.layer === "back" ? 0 : 1;
        if (layerA !== layerB) return layerA - layerB;
        return (a.y + effectiveHeight(a)) - (b.y + effectiveHeight(b));
      });
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const prop of sorted) {
      if (prop.id === "collector-pillar") continue;
      const entry = this.imagePropCache.get(prop.id);
      if (!entry?.image?.complete) continue;
      const sx = Math.floor(prop.x - this.camera.position.x);
      const sy = Math.floor(prop.y - this.camera.position.y);
      const aspectRatio = Number(prop.aspectRatio);
      let w = Math.max(8, Number(prop.w) || 96);
      let h = Math.max(8, Number(prop.h) || 96);
      if (aspectRatio > 0) {
        h = w / aspectRatio;
      }
      if (sx + w < -40 || sy + h < -40 || sx > this.canvas.width + 40 || sy > this.canvas.height + 40) continue;
      ctx.globalAlpha = Number.isFinite(prop.alpha) ? prop.alpha : 1;
      ctx.drawImage(entry.image, 0, 0, entry.image.naturalWidth, entry.image.naturalHeight, sx, sy, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
  }

  drawAtlasProps() {
    if (!Array.isArray(this.atlasProps) || this.atlasProps.length === 0) return false;
    const tileAtlas = getTileAtlas();
    const canDrawTiles = !!tileAtlas && isTileAtlasLoaded();
    const canDrawItems = this.itemsAtlasLoaded && this.itemsAtlas && this.itemsAtlas.complete;
    if (!canDrawTiles && !canDrawItems) return false;

    const ctx = this.ctx;
    const sorted = this.atlasProps
      .slice()
      .sort((a, b) => {
        const layerA = a.layer === "back" ? 0 : 1;
        const layerB = b.layer === "back" ? 0 : 1;
        if (layerA !== layerB) return layerA - layerB;
        return (a.y + a.h) - (b.y + b.h);
      });

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (const prop of sorted) {
      if (!prop) continue;
      const sx = Math.floor(prop.x - this.camera.position.x);
      const sy = Math.floor(prop.y - this.camera.position.y);
      const w = Math.max(8, Number(prop.w) || ATLAS_TILE_SIZE);
      const h = Math.max(8, Number(prop.h) || ATLAS_TILE_SIZE);
      if (sx + w < -40 || sy + h < -40 || sx > this.canvas.width + 40 || sy > this.canvas.height + 40) continue;

      if (prop.atlas === "tiles") {
        if (!canDrawTiles) continue;
        const coords = getTileCoords(prop.row, prop.col);
        if (!coords) continue;
        ctx.globalAlpha = Number.isFinite(prop.alpha) ? prop.alpha : 1;
        ctx.drawImage(tileAtlas, coords.x, coords.y, coords.width, coords.height, sx, sy, w, h);
      } else if (prop.atlas === "items") {
        if (!canDrawItems) continue;
        const coords = this.getItemsAtlasCoords(prop.row, prop.col);
        if (!coords) continue;
        ctx.globalAlpha = Number.isFinite(prop.alpha) ? prop.alpha : 1;
        ctx.drawImage(this.itemsAtlas, coords.x, coords.y, coords.w, coords.h, sx, sy, w, h);
      }
    }

    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return true;
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const atlasVisualsReady = this.isAtlasVisualReady();
    this.drawBackground();
    if (!this.drawMainlevbuildFloor() && !this.drawAtlasFloorZones()) {
      this.drawGroundGrid();
    }
    this.drawAreas();
    if (!atlasVisualsReady) {
      this.drawStructures(this.layout.blockers);
      this.drawStructures(this.layout.props, true);
    } else {
      this.drawStructures(this.layout.blockers, true);
      this.drawAtlasProps();
      this.drawImageProps();
      this.drawMainlevbuildProps();
      this.drawPeaceFloatingClouds();
      this.drawOrbitSprites();
      this.drawCascadePillarRain();
    }
    this.drawAmbientEffects();
    this.drawInteractables();
    this.drawRedPandaRoam();
    this.drawAxolotlRoam();
    this.drawBlobfishRoam();
    this.player.draw(ctx, this.camera, this.hubDash.active);
    if (this.hubShowPlayerHitbox) this.drawPlayerHitbox();
    this.drawHeader();
    if (this.hubLayoutEditorMode) {
      this.drawHubEditorOutlines();
      if (this.hubLayoutTerrainPaintMode) this.drawTerrainPaintOverlay();
    }
    if (this.hubTileDebugMessage) this.drawHubTileDebugOverlay();
  }

  drawPlayerHitbox() {
    const ctx = this.ctx;
    const p = this.player;
    if (!ctx || !p) return;
    const camX = this.camera.position.x;
    const camY = this.camera.position.y;

    // Player hitbox: 30x30 centered – used for overlap resolve and obstacle blocking (walls do not block)
    const HITBOX_SIZE = 30;
    const pxo = Math.max(0, (p.size - HITBOX_SIZE) / 2);
    const pyo = Math.max(0, (p.size - HITBOX_SIZE) / 2);
    const x = p.position.x + pxo;
    const y = p.position.y + pyo;
    const sx = Math.floor(x - camX);
    const sy = Math.floor(y - camY);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 200, 0, 0.7)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(sx + 0.5, sy + 0.5, HITBOX_SIZE - 1, HITBOX_SIZE - 1);
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(0, 255, 128, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 0.5, sy + 0.5, HITBOX_SIZE - 1, HITBOX_SIZE - 1);
    ctx.restore();
  }

  drawHubTileDebugOverlay() {
    const msg = this.hubTileDebugMessage;
    if (!msg || !this.ctx) return;
    const ctx = this.ctx;
    const pad = 8;
    const lineHeight = 14;
    const lines = msg.split("\n");
    const w = Math.min(320, this.canvas.width - pad * 2);
    const h = pad * 2 + lines.length * lineHeight;
    const x = pad;
    const y = this.canvas.height - h - pad;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeStyle = "rgba(0, 255, 200, 0.9)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.font = "12px monospace";
    ctx.fillStyle = "#e0e0e0";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillStyle = line.startsWith("⚠") ? "#ffaa00" : "#e0e0e0";
      ctx.fillText(line, x + pad, y + pad + i * lineHeight);
    });
    ctx.restore();
  }

  drawTerrainPaintOverlay() {
    const grid = this.layout.terrainGrid;
    if (!grid || !grid.length) return;
    const ctx = this.ctx;
    const cols = grid[0].length;
    const rows = grid.length;
    const startGx = Math.max(0, Math.floor(this.camera.position.x / MAINLEVBUILD_TILE_SIZE));
    const startGy = Math.max(0, Math.floor(this.camera.position.y / MAINLEVBUILD_TILE_SIZE));
    const endGx = Math.min(cols, startGx + Math.ceil(this.canvas.width / MAINLEVBUILD_TILE_SIZE) + 1);
    const endGy = Math.min(rows, startGy + Math.ceil(this.canvas.height / MAINLEVBUILD_TILE_SIZE) + 1);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let gy = startGy; gy < endGy; gy++) {
      for (let gx = startGx; gx < endGx; gx++) {
        const screenX = Math.floor(gx * MAINLEVBUILD_TILE_SIZE - this.camera.position.x);
        const screenY = Math.floor(gy * MAINLEVBUILD_TILE_SIZE - this.camera.position.y);
        ctx.strokeRect(screenX, screenY, MAINLEVBUILD_TILE_SIZE, MAINLEVBUILD_TILE_SIZE);
      }
    }
    const world = this._hubEditorLastWorld;
    if (world) {
      const cell = this.getTerrainCell(world.x, world.y);
      if (cell) {
        const screenX = Math.floor(cell.gx * MAINLEVBUILD_TILE_SIZE - this.camera.position.x);
        const screenY = Math.floor(cell.gy * MAINLEVBUILD_TILE_SIZE - this.camera.position.y);
        ctx.strokeStyle = "rgba(0, 255, 200, 0.7)";
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, MAINLEVBUILD_TILE_SIZE, MAINLEVBUILD_TILE_SIZE);
      }
    }
    ctx.restore();
  }

  drawMainlevbuildProps() {
    const props = this.layout.mainlevbuildProps || [];
    if (props.length === 0 || !this.mainlevbuildLoaded || !this.mainlevbuildImage?.complete) return;
    const ctx = this.ctx;
    const sorted = props.slice().sort((a, b) => (a.y + (a.h || 32)) - (b.y + (b.h || 32)));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const p of sorted) {
      const r = MAINLEVBUILD_ATLAS.regions[p.region];
      if (!r) continue;
      const tx = r.tx;
      const ty = r.ty;
      const sx = tx * MAINLEVBUILD_TILE_SIZE;
      const sy = ty * MAINLEVBUILD_TILE_SIZE;
      const w = Math.max(8, Number(p.w) || 32);
      const h = Math.max(8, Number(p.h) || 32);
      const dx = Math.floor(p.x - this.camera.position.x);
      const dy = Math.floor(p.y - this.camera.position.y);
      if (dx + w < -40 || dy + h < -40 || dx > this.canvas.width + 40 || dy > this.canvas.height + 40) continue;
      ctx.drawImage(this.mainlevbuildImage, sx, sy, MAINLEVBUILD_TILE_SIZE, MAINLEVBUILD_TILE_SIZE, dx, dy, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
  }

  drawHubEditorOutlines() {
    const ctx = this.ctx;
    const sel = this.hubLayoutSelectedProp?.prop;
    ctx.save();
    const boxes = this.layout.collisionBoxes || [];
    const collisionSel = this.hubCollisionBoxSelected;
    for (const b of boxes) {
      const sx = Math.floor(b.x - this.camera.position.x);
      const sy = Math.floor(b.y - this.camera.position.y);
      const w = Math.max(16, Number(b.w) || 32);
      const h = Math.max(16, Number(b.h) || 32);
      const isSelected = b === collisionSel;
      ctx.fillStyle = isSelected ? "rgba(250, 204, 21, 0.25)" : "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(sx, sy, w, h);
      ctx.strokeStyle = isSelected ? "rgba(250, 204, 21, 0.95)" : "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
    }
    if (this.hubCollisionBoxNewRect) {
      const r = this.hubCollisionBoxNewRect;
      const sx = Math.floor(r.x - this.camera.position.x);
      const sy = Math.floor(r.y - this.camera.position.y);
      ctx.fillStyle = "rgba(34, 197, 94, 0.2)";
      ctx.fillRect(sx, sy, r.w, r.h);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 0.5, sy + 0.5, r.w - 1, r.h - 1);
    }
    if (this.hubInteractableMode && (this.interactables || []).length) {
      const interactableSel = this.hubInteractableSelected;
      for (const i of this.interactables) {
        const sx = Math.floor(i.x - this.camera.position.x);
        const sy = Math.floor(i.y - this.camera.position.y);
        const w = Math.max(16, Number(i.w) || 96);
        const h = Math.max(16, Number(i.h) || 64);
        const isSelected = i === interactableSel;
        ctx.fillStyle = isSelected ? "rgba(34, 211, 238, 0.3)" : "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = isSelected ? "rgba(34, 211, 238, 0.95)" : "rgba(59, 130, 246, 0.85)";
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
      }
    }
    ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    for (const p of this.atlasProps || []) {
      if (p === sel) continue;
      const sx = Math.floor(p.x - this.camera.position.x);
      const sy = Math.floor(p.y - this.camera.position.y);
      const w = Math.max(8, Number(p.w) || 32);
      const h = Math.max(8, Number(p.h) || 32);
      ctx.strokeRect(sx, sy, w, h);
    }
    for (const p of this.imageProps || []) {
      if (p.id === "collector-pillar") continue;
      if (p === sel) continue;
      const sx = Math.floor(p.x - this.camera.position.x);
      const sy = Math.floor(p.y - this.camera.position.y);
      let w = Math.max(8, Number(p.w) || 96);
      let h = Math.max(8, Number(p.h) || 96);
      if (Number(p.aspectRatio) > 0) h = w / p.aspectRatio;
      ctx.strokeRect(sx, sy, w, h);
    }
    for (const p of this.mainlevbuildProps || []) {
      if (p === sel) continue;
      const sx = Math.floor(p.x - this.camera.position.x);
      const sy = Math.floor(p.y - this.camera.position.y);
      const w = Math.max(8, Number(p.w) || 32);
      const h = Math.max(8, Number(p.h) || 32);
      ctx.strokeRect(sx, sy, w, h);
    }
    if (sel) {
      ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
      ctx.lineWidth = 3;
      const sx = Math.floor(sel.x - this.camera.position.x);
      const sy = Math.floor(sel.y - this.camera.position.y);
      let w = Math.max(8, Number(sel.w) || 32);
      let h = Math.max(8, Number(sel.h) || 32);
      if (sel.aspectRatio > 0) h = w / sel.aspectRatio;
      ctx.strokeRect(sx, sy, w, h);
    }
    ctx.restore();
  }

  drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#172122");
    gradient.addColorStop(0.58, "#152438");
    gradient.addColorStop(1, "#0b1020");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGroundGrid() {
    if (this.isAtlasVisualReady()) return;
    const ctx = this.ctx;
    const gridSize = 64;
    const startX = -((this.camera.position.x % gridSize) + gridSize) % gridSize;
    const startY = -((this.camera.position.y % gridSize) + gridSize) % gridSize;
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.07)";
    ctx.lineWidth = 1;
    for (let x = startX; x < this.canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(Math.floor(x) + 0.5, 0);
      ctx.lineTo(Math.floor(x) + 0.5, this.canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < this.canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(this.canvas.width, Math.floor(y) + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAreas() {
    const ctx = this.ctx;
    for (const area of this.layout.areas || []) {
      const sx = Math.floor(area.x - this.camera.position.x);
      const sy = Math.floor(area.y - this.camera.position.y);
      ctx.save();
      ctx.strokeStyle = area.borderColor || "rgba(148, 163, 184, 0.22)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, area.w - 1, area.h - 1);
      ctx.restore();
    }
  }

  drawStructures(structures, decorative = false) {
    const ctx = this.ctx;
    const tileAtlas = getTileAtlas();
    const canUseWallTiles = !!tileAtlas && isTileAtlasLoaded();
    for (const structure of structures || []) {
      if (structure.invisible) continue;
      const sx = Math.floor(structure.x - this.camera.position.x);
      const sy = Math.floor(structure.y - this.camera.position.y);
      if (
        sx + structure.w < -40 ||
        sy + structure.h < -40 ||
        sx > this.canvas.width + 40 ||
        sy > this.canvas.height + 40
      ) {
        continue;
      }
      if (canUseWallTiles && structure?.collides) {
        const tileRef = this.getWallTileRefForStructure(structure);
        const tile = getTileCoords(tileRef.row, tileRef.col);
        if (tile) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          for (let y = sy; y < sy + structure.h; y += ATLAS_TILE_SIZE) {
            for (let x = sx; x < sx + structure.w; x += ATLAS_TILE_SIZE) {
              const drawW = Math.min(ATLAS_TILE_SIZE, sx + structure.w - x);
              const drawH = Math.min(ATLAS_TILE_SIZE, sy + structure.h - y);
              ctx.drawImage(
                tileAtlas,
                tile.x,
                tile.y,
                tile.width,
                tile.height,
                x,
                y,
                drawW,
                drawH
              );
            }
          }
          ctx.imageSmoothingEnabled = true;
          ctx.strokeStyle = "rgba(15, 23, 42, 0.8)";
          ctx.lineWidth = decorative ? 1 : 2;
          ctx.strokeRect(sx + 0.5, sy + 0.5, structure.w - 1, structure.h - 1);
          ctx.restore();
          continue;
        }
      }
      const style = STRUCTURE_STYLE[structure.style] || STRUCTURE_STYLE.default;
      let drawX = sx;
      let drawY = sy;
      if (decorative && structure.motion === "sway") {
        drawY += Math.round(Math.sin(this.time * 2.2 + structure.x * 0.03) * 2);
      }
      ctx.save();
      ctx.fillStyle = style.fill;
      ctx.globalAlpha = decorative ? 0.72 : 0.9;
      if (structure.shape === "circle") {
        const r = Math.min(structure.w, structure.h) * 0.5;
        ctx.beginPath();
        ctx.arc(drawX + structure.w * 0.5, drawY + structure.h * 0.5, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (structure.shape === "ring") {
        const cx = drawX + structure.w * 0.5;
        const cy = drawY + structure.h * 0.5;
        const outer = Math.min(structure.w, structure.h) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, outer, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(cx, cy, outer * 0.64, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.fillRect(drawX, drawY, structure.w, structure.h);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = decorative ? 1 : 2;
      if (structure.shape === "circle") {
        const r = Math.min(structure.w, structure.h) * 0.5;
        ctx.beginPath();
        ctx.arc(drawX + structure.w * 0.5, drawY + structure.h * 0.5, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (structure.shape === "ring") {
        const cx = drawX + structure.w * 0.5;
        const cy = drawY + structure.h * 0.5;
        const outer = Math.min(structure.w, structure.h) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, outer, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, outer * 0.64, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(drawX + 0.5, drawY + 0.5, structure.w - 1, structure.h - 1);
      }
      ctx.restore();
    }
  }

  getWallTileRefForStructure(structure) {
    const style = String(structure?.style || "").toLowerCase();
    if (style === "wood" || style === "bench" || style === "crate") {
      return { row: 1, col: "a" }; // dirt wall (top) for warm/orange blockers
    }
    return { row: 3, col: "a" }; // stone brick wall (top) for grey blockers
  }

  drawAmbientEffects() {
    const ctx = this.ctx;
    for (const anchor of this.ambientAnchors) {
      const sx = anchor.x - this.camera.position.x;
      const sy = anchor.y - this.camera.position.y;
      if (sx < -120 || sy < -120 || sx > this.canvas.width + 120 || sy > this.canvas.height + 120) continue;
      if (anchor.type === "campfire") {
        const flicker = 0.5 + 0.5 * Math.sin(this.time * 8.4);
        ctx.save();
        ctx.fillStyle = `rgba(251, 146, 60, ${0.13 + flicker * 0.15})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 30 + flicker * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(249, 115, 22, ${0.42 + flicker * 0.24})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 12 + flicker * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (anchor.type === "portal") {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.5);
        ctx.save();
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.2 + pulse * 0.28})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 22 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(147, 197, 253, ${0.18 + pulse * 0.22})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 34 + pulse * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (anchor.type === "golden") {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.8);
        ctx.save();
        ctx.fillStyle = `rgba(255, 215, 0, ${0.06 + pulse * 0.05})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 193, 37, ${0.12 + pulse * 0.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(Math.floor(sx) + 0.5, Math.floor(sy) + 0.5, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const particle of this.ambientParticles) {
      const px = particle.x - this.camera.position.x;
      const py = particle.y - this.camera.position.y;
      if (px < -32 || py < -32 || px > this.canvas.width + 32 || py > this.canvas.height + 32) continue;
      const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      ctx.save();
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = alpha * 0.82;
      if (particle.anchorType === "golden") {
        const size = Math.max(1, Math.floor(particle.size));
        const ix = Math.floor(px) - (size >> 1);
        const iy = Math.floor(py) - (size >> 1);
        ctx.fillRect(ix, iy, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(px, py, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawInteractables() {
    const ctx = this.ctx;
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 3.1);
    const selectedLures = getSelectedLures();
    const lureSummary = selectedLures.length > 0
      ? selectedLures.map((entry) => entry.shortLabel || entry.name).join(" + ")
      : "No Lures Equipped";
    for (const interactable of this.interactables) {
      if (interactable.hideRect) continue;

      const sx = Math.floor(interactable.x - this.camera.position.x);
      const sy = Math.floor(interactable.y - this.camera.position.y);
      if (
        sx + interactable.w < -32 ||
        sy + interactable.h < -32 ||
        sx > this.canvas.width + 32 ||
        sy > this.canvas.height + 32
      ) {
        continue;
      }

      const marker = this.markerById[interactable.id] || {};
      const isActive = this.activeInteractable?.id === interactable.id && !this.isMovementBlocked();
      const centerX = sx + interactable.w * 0.5;
      const centerY = sy + interactable.h * 0.5;

      ctx.save();
      ctx.fillStyle = interactable.color;
      ctx.globalAlpha = isActive ? 0.46 : 0.29;
      ctx.fillRect(sx, sy, interactable.w, interactable.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isActive ? "#f8fafc" : "rgba(15, 23, 42, 0.95)";
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.strokeRect(sx + 0.5, sy + 0.5, interactable.w - 1, interactable.h - 1);

      ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
      ctx.fillRect(sx + 7, sy + 6, interactable.w - 14, 20);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "11px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(interactable.displayName, centerX, sy + 20);
      if (interactable.id === "portal-gate" || interactable.id === "lure-altar") {
        ctx.fillStyle = "rgba(2, 6, 23, 0.76)";
        ctx.fillRect(sx + 7, sy + interactable.h - 24, interactable.w - 14, 16);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "10px 'Segoe UI', sans-serif";
        ctx.fillText(lureSummary, centerX, sy + interactable.h - 12);
      }

      const icon = marker.icon || "E";
      const iconY = sy - 10;
      ctx.fillStyle = "rgba(2, 6, 23, 0.88)";
      ctx.beginPath();
      ctx.arc(centerX, iconY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isActive ? `rgba(254, 240, 138, ${pulse})` : "rgba(148, 163, 184, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, iconY, 11, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 10px 'Segoe UI', sans-serif";
      ctx.fillText(icon, centerX, iconY + 3);
      if (interactable.id === "portal-gate") {
        const socketY = iconY - 16;
        for (let i = 0; i < 2; i++) {
          const lure = selectedLures[i] || null;
          const socketX = centerX + (i === 0 ? -12 : 12);
          ctx.fillStyle = lure ? "rgba(14, 116, 144, 0.9)" : "rgba(71, 85, 105, 0.78)";
          ctx.beginPath();
          ctx.arc(socketX, socketY, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = lure ? "rgba(34, 211, 238, 0.95)" : "rgba(148, 163, 184, 0.7)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(socketX, socketY, 7, 0, Math.PI * 2);
          ctx.stroke();
          if (lure?.shortLabel) {
            ctx.fillStyle = "#e2e8f0";
            ctx.font = "bold 8px 'Segoe UI', sans-serif";
            ctx.fillText(lure.shortLabel.slice(0, 1), socketX, socketY + 3);
          }
        }
      }

      if (isActive) {
        ctx.strokeStyle = `rgba(254, 240, 138, ${0.5 + pulse * 0.45})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 4, sy - 4, interactable.w + 8, interactable.h + 8);
      }
      ctx.restore();
    }
  }

  drawHeader() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
    ctx.fillRect(8, 8, 260, 34);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.strokeRect(8, 8, 260, 34);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px 'Segoe UI', sans-serif";
    const zone = this.calloutText || this.findZoneAtPoint(this.getPlayerCenter().x, this.getPlayerCenter().y)?.label || "Home Base";
    ctx.fillText(`Home Base / ${zone}`, 16, 29);
    ctx.restore();
  }
}
