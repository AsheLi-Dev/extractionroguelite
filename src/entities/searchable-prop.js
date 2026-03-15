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
export const BASE_SEARCHABLE_LOOT_MULT = 1.5;

function normalizeSearchableCubeKey(cubeKey) {
  const match = /^(.+?)T(\d+)$/i.exec(String(cubeKey || ""));
  if (!match) return cubeKey;
  const tier = Math.max(1, Number(match[2]) || 1);
  const cappedTier = Math.min(2, tier);
  return `${match[1]}T${cappedTier}`;
}

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
    this.isMiniBossLootChest = false;
    this.keepVisibleWhenSearched = !!def.keepVisibleWhenSearched;
    /** Set true after 5% phantom-elite spawn is rolled (locker/deadWarrior); each prop triggers at most once. */
    this.phantomSpawnTriggered = false;
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

  startSearch(player, game = null) {
    if (this.isSearched || !this.playerInRange(player)) return false;
    this.searchProgress = 0;
    // 5% chance to spawn an elite with Phantom when starting to search locker or deadWarrior; once per prop.
    if (
      game?.enemySystem &&
      typeof game.enemySystem.spawnOne === "function" &&
      (this.typeId === "locker" || this.typeId === "deadWarrior") &&
      !this.phantomSpawnTriggered
    ) {
      this.phantomSpawnTriggered = true;
      if (Math.random() < 0.05) {
        game.enemySystem.spawnOne("elite", ["phantom"], { x: this.centerX, y: this.centerY }, game, null, false);
      }
    }
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
    if (typeof game?.grantXP === "function") {
      const xp = 1 + Math.floor(Math.random() * 5);
      game.grantXP(xp);
    }
    if (this.spawnEliteOnOpen && game?.enemySystem && typeof game.enemySystem.spawnOne === "function") {
      game.enemySystem.spawnOne("elite", null, { x: this.centerX, y: this.centerY }, game, null, false);
    } else if (this.trapDamage && typeof game?.applyDamage === "function") {
      game.applyDamage({
        targetType: "player",
        sourceType: "trap_chest",
        amount: Number(this.trapDamage) || 0,
        reason: "trapped_chest",
        damageClass: "trap",
        fromEnemy: false,
        bypassMitigation: false,
        canKill: true
      });
    }
    this.spawnLoot(game);
    // Chest Spirits: chance to grant a Soul Siphon soul when opening chests
    if (game && typeof game.getAttackUpgradeStackCount === "function" && this.typeId === "chest") {
      const stacks = game.getAttackUpgradeStackCount("chest_spirits");
      if (stacks > 0) {
        const chance = Math.min(1, 0.12 * stacks);
        if (Math.random() < chance) {
          const souls = 1;
          const ex = this.centerX;
          const ey = this.centerY;
          game.runSoulsTotal = (game.runSoulsTotal || 0) + souls;
          game.addFloatingText(ex, ey, `+${souls} soul`, "heal", true);
        }
      }
    }
    if (game && game.hasCharacterTalent("lootHoarder")) {
      if (typeof game.logTalentTrigger === "function") game.logTalentTrigger("lootHoarder", "Searchable opened: +20% drop chance 10s");
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
          game.lootSystem.spawnCubeAt(this.centerX, this.centerY, normalizeSearchableCubeKey(def.cubeKey));
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
    let lootMultiplier = (isBossRoom ? 2 : 1) * BASE_SEARCHABLE_LOOT_MULT;
    if (game.hasCharacterTalent("arcaneEye")) {
      if (typeof game.logTalentTrigger === "function") game.logTalentTrigger("arcaneEye", "Searchable loot: +20% amount");
      lootMultiplier *= 1.2;
    }
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
    if (this.isInvisible) return;
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const w = this.width;
    const h = this.height;
    if (this.isMiniBossLootChest && !this.isSearched) {
      const t = Number(timeSeconds) || 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6 + this.id * 0.37);
      ctx.save();
      ctx.fillStyle = `rgba(255, 214, 64, ${0.18 + pulse * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(
        sx + w / 2,
        sy + h / 2,
        w * (0.9 + pulse * 0.08),
        h * (0.75 + pulse * 0.08),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.shadowColor = "rgba(255, 214, 64, 0.95)";
      ctx.shadowBlur = 14 + pulse * 10;
      ctx.strokeStyle = `rgba(255, 237, 145, ${0.55 + pulse * 0.25})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, sy - 1, w + 2, h + 2);
      ctx.restore();
    }
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
