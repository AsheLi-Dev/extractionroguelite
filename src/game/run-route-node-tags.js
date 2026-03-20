import { NODE_TAGS } from './run-route-grid.js';

export function applyRunRouteNodeTagMixin(Game) {
  Object.assign(Game.prototype, {
    getCurrentNodeTag() {
      return this.activeNodeTag || this.getCurrentNode?.()?.tag || null;
    },

    hasCurrentNodeTag(tag) {
      return this.enableRunRouteGraph && this.getCurrentNodeTag() === tag;
    },

    getNodeSearchableMultiplier() {
      return this.hasCurrentNodeTag(NODE_TAGS.TREASURE) ? 2 : 1;
    },

    rollNodeExtraEliteGroupsPerCell() {
      if (!this.hasCurrentNodeTag(NODE_TAGS.ELITE_RICH)) return 0;
      return 1 + Math.floor(Math.random() * 2);
    },

    isNodeAttractionActive() {
      return this.hasCurrentNodeTag(NODE_TAGS.ATTRACTION);
    },

    spawnExtractionPortalAtNodeExit() {
      if (!this.world) return;
      const ts = this.world.tileSize || 32;
      const exitPixel = this.world.exitPixel || { x: this.world.width - ts * 3, y: this.world.height / 2 };
      const px = Math.max(0, Math.min(this.world.width, exitPixel.x + ts / 2));
      const py = Math.max(0, Math.min(this.world.height, exitPixel.y + ts / 2));
      const prev = this.player?.position ? { x: this.player.position.x, y: this.player.position.y } : null;
      if (this.player?.position) {
        this.player.position.x = px;
        this.player.position.y = py;
      }
      this.spawnExtractionPortalNearPlayer?.();
      if (prev && this.player?.position) {
        this.player.position.x = prev.x;
        this.player.position.y = prev.y;
      }
    },

    applyNodeTagOnMapLoad() {
      if (!this.enableRunRouteGraph) return;
      const tag = this.getCurrentNodeTag();
      if (!tag) return;
      if (tag === NODE_TAGS.EXTRACTION && !this.victoryPortal) {
        this.spawnExtractionPortalAtNodeExit();
      }
      if (tag === NODE_TAGS.CAMPFIRE) {
        this.clearedMaps?.add(this.currentMapStateKey);
        this.spawnExitPortals?.(true);
      }
    }
  });
}

