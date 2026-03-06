// -------- Searchable prop entity --------
// World props the player can hold-interact to search for loot.

import { Vec2 } from "../utils.js";
import { SEARCHABLE_PROP_DEFS } from "../data/searchable-props-data.js";
import { rollSearchableLoot } from "../data/searchable-loot-tables.js";
import { hasTalent } from "../data/talents.js";
import { play as playSfx } from "../audio.js";
import { drawTile, isTileAtlasLoaded } from "./tile-system.js";

/** Interaction range (distance from prop center to player center). */
export const SEARCHABLE_PROP_INTERACT_RANGE = 100;

export class SearchableProp {
  constructor(id, x, y, typeId) {
    this.id = id;
    this.position = new Vec2(x, y);
    this.typeId = typeId;
    const def = SEARCHABLE_PROP_DEFS[typeId];
    if (!def) throw new Error(`Unknown searchable prop type: ${typeId}`);
    this.def = def;
    this.isSearched = false;
    this.searchProgress = 0;
    this.width = def.width ?? 32;
    this.height = def.height ?? 32;
    this.pendingLootDefs = null;
    this.searchTimeOverride = null;
  }

  get centerX() {
    return this.position.x + this.width / 2;
  }
  get centerY() {
    return this.position.y + this.height / 2;
  }

  /** Returns true if player center is within INTERACT_RANGE. */
  playerInRange(player) {
    if (!player) return false;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    return dx * dx + dy * dy <= SEARCHABLE_PROP_INTERACT_RANGE * SEARCHABLE_PROP_INTERACT_RANGE;
  }

  startSearch(player) {
    if (this.isSearched || !this.playerInRange(player)) return false;
    this.searchProgress = 0;
    return true;
  }

  updateSearch(deltaTime, player) {
    if (this.isSearched) return;
    if (!this.playerInRange(player)) return false;
    this.searchProgress += deltaTime;
    return true;
  }

  finishSearch(game) {
    if (this.isSearched) return;
    this.isSearched = true;
    this.spawnLoot(game);
    if (game && hasTalent("cardHoarder")) {
      const until = (game.time ?? 0) + 10;
      game.lootHoarderUntil = Math.max(game.lootHoarderUntil || 0, until);
    }
    playSfx("chestOpen");
  }

  spawnLoot(game) {
    if (Array.isArray(this.pendingLootDefs) && this.pendingLootDefs.length > 0 && game?.lootSystem) {
      for (const def of this.pendingLootDefs) {
        if (!def || typeof def !== "object") continue;
        if (def.type === "Gold") {
          game.lootSystem.spawnGoldAt(this.centerX, this.centerY, Math.max(1, Math.round(def.goldAmount || 0)));
          continue;
        }
        if (def.type === "Cube" && def.cubeKey) {
          game.lootSystem.spawnCubeAt(this.centerX, this.centerY, def.cubeKey);
          continue;
        }
        if (def.type === "Ancestor Spirit" && def.spiritDefId) {
          game.lootSystem.spawnAncestorSpiritAt(this.centerX, this.centerY, def);
          continue;
        }
        game.lootSystem.spawnEquipmentAt(this.centerX, this.centerY, def);
      }
      this.pendingLootDefs = [];
      return;
    }
    const isBossRoom = (game?.currentMapId ?? game?.currentMap?.id) === 4;
    let lootMultiplier = isBossRoom ? 2 : 1;
    if (hasTalent("arcaneEye")) lootMultiplier *= 1.2;
    rollSearchableLoot(this.def.lootTable, this.centerX, this.centerY, game, lootMultiplier);
  }

  get searchProgressNormalized() {
    const required = this.getRequiredSearchTime();
    if (required <= 0) return 1;
    return Math.min(1, this.searchProgress / required);
  }

  getRequiredSearchTime() {
    const t = Number.isFinite(this.searchTimeOverride) ? this.searchTimeOverride : this.def.searchTime;
    return Math.max(0, Number(t) || 0);
  }

  draw(ctx, camera, timeSeconds) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const w = this.width;
    const h = this.height;
    const tileRef = this.isSearched ? this.def.tileOpen : this.def.tileClosed;
    if (tileRef && isTileAtlasLoaded()) {
      drawTile(ctx, tileRef.row, tileRef.col, sx, sy, Math.max(w, h));
      return;
    }
    const colors = {
      locker: { fill: "#4a5568", stroke: "#2d3748", opened: "#2d3748" },
      crate: { fill: "#8b6914", stroke: "#5c4610", opened: "#5c4610" },
      deadWarrior: { fill: "#4a5568", stroke: "#1a202c", opened: "#2d3748" },
      chest: { fill: "#7c5a12", stroke: "#5b410d", opened: "#4b5563" },
    };
    const c = colors[this.typeId] || colors.crate;
    ctx.fillStyle = this.isSearched ? c.opened : c.fill;
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 2;
    ctx.fillRect(sx, sy, w, h);
    ctx.strokeRect(sx, sy, w, h);
    if (this.isSearched) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(sx + 4, sy + 4, w - 8, h - 8);
    }
  }

  /** Draw search progress bar above the prop (call from game when this prop is being searched). */
  drawProgressBar(ctx, camera) {
    if (this.isSearched || this.searchProgress <= 0) return;
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const barW = this.width;
    const barH = 6;
    const barY = sy - barH - 4;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sx, barY, barW, barH);
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(sx, barY, barW * this.searchProgressNormalized, barH);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, barY, barW, barH);
  }
}
