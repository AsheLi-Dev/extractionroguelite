import { Vec2 } from '../utils.js';
import { LOOT_DEFS, generateEquipmentItem } from '../data/loot-data.js';
import { getCubeLabel } from '../data/cubes-data.js';

const ANCESTOR_CLAN_SPRITES = {
  swift: "assets/images/Swift Clan.png",
  arcana: "assets/images/Arcana Clan.png",
  savage: "assets/images/Savage Clan.png",
  bulwark: "assets/images/Bulwark Clan.png",
  hoarder: "assets/images/Hoarder Clan.png"
};
const ancestorClanSpriteCache = {};

const GOLD_ITEMS_ATLAS_SRC = "assets/Environments/items.png";
const GOLD_ATLAS_TILE = 32;
const GOLD_SPRITE_SMALL = { row: 24, col: 1 };
const GOLD_SPRITE_LARGE = { row: 24, col: 2 };
const goldItemsAtlasCache = {};
function getGoldItemsAtlasImage() {
  if (!goldItemsAtlasCache[GOLD_ITEMS_ATLAS_SRC]) {
    const img = new Image();
    img.src = GOLD_ITEMS_ATLAS_SRC;
    goldItemsAtlasCache[GOLD_ITEMS_ATLAS_SRC] = img;
  }
  return goldItemsAtlasCache[GOLD_ITEMS_ATLAS_SRC];
}
const FLOOR_LABEL_STYLE = {
  common: { text: "#ffffff", bg: "#000000" },
  magic: { text: "#ffffff", bg: ["#0b1f52", "#1e3a8a"] },
  rare: { text: "#000000", bg: "#facc15" },
  legendary: { text: "#000000", bg: "#f59e0b" }
};
const FLOOR_LABEL_FONT_SIZE = 12;
const FLOOR_LABEL_FONT_FAMILY = "\"Trebuchet MS\", Arial, sans-serif";
const FLOOR_LABEL_SUPERSAMPLE = 2;

function setFloorLabelFont(ctx, pixelSize = FLOOR_LABEL_FONT_SIZE) {
  ctx.font = `700 ${pixelSize}px ${FLOOR_LABEL_FONT_FAMILY}`;
}

function measureFloorLabelWidth(ctx, label) {
  setFloorLabelFont(ctx, FLOOR_LABEL_FONT_SIZE * FLOOR_LABEL_SUPERSAMPLE);
  return Math.ceil(ctx.measureText(label).width / FLOOR_LABEL_SUPERSAMPLE);
}

function getCubeTier(cubeKey) {
  const m = /T(\d+)$/i.exec(String(cubeKey || ""));
  return m ? Number(m[1]) : null;
}

function getFloorLootTier(item) {
  if (item?.type === "Cube") {
    const tier = getCubeTier(item.cubeKey);
    if (tier === 1) return "common";
    if (tier === 2) return "magic";
    if (tier === 3) return "rare";
    // Non-tier cube keys are legendary/special cubes.
    return "legendary";
  }
  if (item?.type === "LifeOrb" || item?.type === "LifeFlask") return "magic";
  if (item?.type === "XpOrb") return "common";
  const rarity = String(item?.rarity || "common").toLowerCase();
  if (rarity === "legendary") return "legendary";
  if (rarity === "rare") return "rare";
  if (rarity === "magic") return "magic";
  return "common";
}

function getFloorLabelColors(item) {
  return FLOOR_LABEL_STYLE[getFloorLootTier(item)] || FLOOR_LABEL_STYLE.common;
}

function getAncestorSpriteSrc(clans) {
  if (!Array.isArray(clans)) return null;
  for (const clan of clans) {
    const src = ANCESTOR_CLAN_SPRITES[String(clan || "").toLowerCase()];
    if (src) return src;
  }
  return null;
}

function getAncestorSpriteImage(src) {
  if (!src) return null;
  if (!ancestorClanSpriteCache[src]) {
    const img = new Image();
    img.src = src;
    ancestorClanSpriteCache[src] = img;
  }
  return ancestorClanSpriteCache[src];
}

export class LootItem {
  constructor(id, x, y, definition, burstFromX = null, burstFromY = null) {
    this.id = id;
    this.position = new Vec2(x, y);
    this.size = 20;
    this.type = definition.type;
    this.name = definition.name;
    this.category = definition.category ?? null;
    this.preciousId = definition.preciousId ?? null;
    this.ringId = definition.ringId ?? null;
    this.ringSpriteKey = definition.ringSpriteKey ?? null;
    this.consumedOnTrigger = !!definition.consumedOnTrigger;
    this.rolledModifiers = definition.rolledModifiers ?? null;
    this.spriteCell = definition.spriteCell ?? null;
    this.cubeKey = definition.cubeKey ?? null;
    this.stats = definition.stats || {};
    this.cardKey = definition.cardKey || null;
    this.description = definition.description || "";
    this.weight = definition.weight || null;
    this.rarity = definition.rarity || null;
    this.modifiers = definition.modifiers || [];
    this.baseStat = definition.baseStat || null;
    this.sockets = definition.sockets ?? 0;
    this.vesselsMax = definition.vesselsMax ?? 0;
    this.vessels = Array.isArray(definition.vessels) ? definition.vessels : [];
    this.spiritDefId = definition.spiritDefId ?? null;
    this.clans = Array.isArray(definition.clans) ? definition.clans : [];
    this.goldAmount = definition.goldAmount ?? 0;
    this.xpAmount = definition.xpAmount ?? 0;
    this.modId = definition.modId ?? null;
    this.xpOrbSize = definition.xpOrbSize ?? "small"; // "small" | "medium" | "large"
    this.healFraction = Number(definition.healFraction) || 0;
    this.healFlat = Number(definition.healFlat) || 0;
    this.burstFrom = burstFromX != null && burstFromY != null ? { x: burstFromX, y: burstFromY } : null;
    this.burstProgress = 0;
    this.pickupDelay = 1.0;
    this.age = 0;
  }

  updateBurst(dt) {
    this.age += dt;
    if (!this.burstFrom) return;
    this.burstProgress = Math.min(1, this.burstProgress + dt / 0.18);
    if (this.burstProgress >= 1) this.burstFrom = null;
  }

  get displayPosition() {
    if (!this.burstFrom || this.burstProgress >= 1) return this.position;
    const t = this.burstProgress;
    const easeOut = 1 - (1 - t) * (1 - t);
    return new Vec2(
      this.burstFrom.x + (this.position.x - this.burstFrom.x) * easeOut,
      this.burstFrom.y + (this.position.y - this.burstFrom.y) * easeOut
    );
  }

  draw(ctx, camera, timeSeconds) {
    if (this.type === "Gold" && this.goldAmount > 0) {
      const img = getGoldItemsAtlasImage();
      if (img.complete && img.naturalWidth) {
        const cell = this.goldAmount > 20 ? GOLD_SPRITE_LARGE : GOLD_SPRITE_SMALL;
        const sx = cell.col * GOLD_ATLAS_TILE;
        const sy = cell.row * GOLD_ATLAS_TILE;
        const pos = this.displayPosition;
        const dx = Math.floor(pos.x - camera.position.x);
        const dy = Math.floor(pos.y - camera.position.y);
        const drawSize = this.size;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, GOLD_ATLAS_TILE, GOLD_ATLAS_TILE, dx, dy, drawSize, drawSize);
        ctx.imageSmoothingEnabled = true;
      }
    }
    if (this.type === "XpOrb" && this.xpAmount > 0) {
      const pos = this.displayPosition;
      const dx = pos.x - camera.position.x;
      const dy = pos.y - camera.position.y;
      const radius = this.size / 2;
      ctx.save();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    if (this.type === "ModCard") {
      const pos = this.displayPosition;
      const dx = pos.x - camera.position.x;
      const dy = pos.y - camera.position.y;
      const r = String(this.rarity || "common").toLowerCase();
      const fill = r === "legendary" ? "#f59e0b" : r === "epic" ? "#a855f7" : r === "rare" ? "#eab308" : "#94a3b8";
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.5;
      const w = this.size || 22;
      const h = this.size || 22;
      ctx.beginPath();
      ctx.roundRect(dx, dy, w, h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    void timeSeconds;
  }

  drawLabel(ctx, camera, yOffset = 0) {
    const label = this.name || this.type;
    if (!label) return;
    const pos = this.displayPosition;
    const sx = Math.floor(pos.x - camera.position.x);
    const sy = Math.floor(pos.y - camera.position.y);
    const labelX = sx + this.size / 2;
    const labelY = sy - 6 + yOffset;
    const colors = getFloorLabelColors(this);
    const textColor = colors.text;
    const bgColor = colors.bg;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textW = measureFloorLabelWidth(ctx, label);
    const boxW = textW + 8;
    const boxH = 16;
    const boxX = Math.floor(labelX - boxW / 2);
    const boxY = Math.floor(labelY - boxH / 2 - 2);
    if (Array.isArray(bgColor) && bgColor.length >= 2) {
      const grad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY);
      grad.addColorStop(0, bgColor[0]);
      grad.addColorStop(1, bgColor[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bgColor;
    }
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = textColor;
    ctx.save();
    ctx.translate(labelX, boxY + boxH / 2);
    ctx.scale(1 / FLOOR_LABEL_SUPERSAMPLE, 1 / FLOOR_LABEL_SUPERSAMPLE);
    setFloorLabelFont(ctx, FLOOR_LABEL_FONT_SIZE * FLOOR_LABEL_SUPERSAMPLE);
    ctx.fillText(label, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  /**
   * @param {object} player - Player entity with position and size.
   * @param {number} [pickupRadiusMult=1] - Multiplier for pickup range (e.g. 1.5 = +50% range).
   */
  intersectsPlayer(player, pickupRadiusMult = 1) {
    if (this.age < this.pickupDelay) return false;
    if (this.burstFrom && this.burstProgress < 1) return false;
    const pos = this.displayPosition;
    const r1 = {
      x: pos.x,
      y: pos.y,
      w: this.size,
      h: this.size
    };
    const half = (player.size / 2) * pickupRadiusMult;
    const cx = player.position.x + player.size / 2;
    const cy = player.position.y + player.size / 2;
    const r2 = {
      x: cx - half,
      y: cy - half,
      w: half * 2,
      h: half * 2
    };

    return (
      r1.x < r2.x + r2.w &&
      r1.x + r1.w > r2.x &&
      r1.y < r2.y + r2.h &&
      r1.y + r1.h > r2.y
    );
  }
}

export class LootSystem {
  constructor(world) {
    this.world = world;
    this.items = [];
    this.nextId = 1;
    this.mapLootQuality = 0;
    this.difficulty = 1;
    this.playerLuck = 0;
  }

  setMapLootQuality(quality) {
    this.mapLootQuality = quality;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty != null ? Math.min(5, Math.max(1, difficulty)) : 1;
  }

  setPlayerLuck(luck) {
    this.playerLuck = Math.max(0, Number(luck) || 0);
  }

  getLootDefinition(qualityBonus = 0) {
    const group = LOOT_DEFS[Math.floor(Math.random() * LOOT_DEFS.length)];
    const opts = this.difficulty != null ? { difficulty: this.difficulty, luck: this.playerLuck } : { luck: this.playerLuck };
    return generateEquipmentItem(group.type, this.mapLootQuality, qualityBonus, null, opts);
  }

  spawnGuaranteedWeaponAt(centerX, centerY) {
    const opts = this.difficulty != null ? { difficulty: this.difficulty, luck: this.playerLuck } : { luck: this.playerLuck };
    const def = generateEquipmentItem("Weapon", Math.min(1, this.mapLootQuality + 0.5), 0.5, null, opts);
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 30;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 30;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  spawnEquipmentAt(centerX, centerY, def) {
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  spawnBurstAt(centerX, centerY, count, qualityBonus = 0) {
    const size = 20;
    const burstRadius = 45;
    const margin = this.world.wallThickness + 15;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = burstRadius + Math.random() * 25;
      const landX = centerX + Math.cos(angle) * dist - size / 2;
      const landY = centerY + Math.sin(angle) * dist - size / 2;

      const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
      const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));

      const def = this.getLootDefinition(qualityBonus);
      const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
      item.size = size;
      this.items.push(item);
    }
  }

  spawnCubeAt(centerX, centerY, cubeKey) {
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 24;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 24;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const def = { type: "Cube", name: getCubeLabel(cubeKey), cubeKey };
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  spawnGoldAt(centerX, centerY, amount) {
    if (amount <= 0) return;
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const def = { type: "Gold", name: `${amount} Gold`, goldAmount: amount };
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  spawnLifeOrbAt(centerX, centerY) {
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const def = { type: "LifeOrb", name: "Life Orb", healFraction: 0.1 };
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  /** @param {"small"|"medium"|"large"} sizeVariant */
  spawnXpOrbAt(centerX, centerY, sizeVariant) {
    const xpBySize = { small: 15, medium: 50, large: 180 };
    const sizeByVariant = { small: 12, medium: 20, large: 28 };
    const xpAmount = xpBySize[sizeVariant] ?? 15;
    const size = sizeByVariant[sizeVariant] ?? 12;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const def = { type: "XpOrb", name: `${xpAmount} XP`, xpAmount, xpOrbSize: sizeVariant };
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  spawnLifeFlaskAt(centerX, centerY) {
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const def = { type: "LifeFlask", name: "Life Flask", healFraction: 0.15 };
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  spawnAncestorSpiritAt(centerX, centerY, def) {
    if (!def) return;
    const size = 20;
    const margin = this.world.wallThickness + 15;
    const landX = centerX - size / 2 + (Math.random() - 0.5) * 20;
    const landY = centerY - size / 2 + (Math.random() - 0.5) * 20;
    const clampedX = Math.max(margin, Math.min(landX, this.world.width - margin - size));
    const clampedY = Math.max(margin, Math.min(landY, this.world.height - margin - size));
    const item = new LootItem(this.nextId++, clampedX, clampedY, def, centerX, centerY);
    item.size = size;
    this.items.push(item);
  }

  update(dt, player, onLootPicked, pickupRadiusMult = 1) {
    for (const item of this.items) {
      item.updateBurst(dt);
    }

    const remaining = [];
    for (const item of this.items) {
      if (item.intersectsPlayer(player, pickupRadiusMult)) {
        // Auto-pickup gold and XP orbs; other items require click
        if ((item.type === "Gold" || item.type === "XpOrb") && onLootPicked) onLootPicked(item);
        else remaining.push(item);
      } else {
        remaining.push(item);
      }
    }
    this.items = remaining;
  }

  draw(ctx, camera, timeSeconds) {
    for (const item of this.items) {
      item.draw(ctx, camera, timeSeconds);
    }

    // Lay out labels so they don't overlap each other.
    const placed = [];
    const lineHeight = 14;
    const sorted = [...this.items].sort((a, b) => {
      const ay = a.displayPosition.y;
      const by = b.displayPosition.y;
      return ay - by;
    });
    ctx.save();
    for (const item of sorted) {
      const label = item.name || item.type;
      if (!label) continue;
      const pos = item.displayPosition;
      const sx = Math.floor(pos.x - camera.position.x);
      const sy = Math.floor(pos.y - camera.position.y);
      const centerX = sx + item.size / 2;
      const textWidth = measureFloorLabelWidth(ctx, label);
      const boxW = textWidth + 8;

      let chosenOffset = 0;
      for (let level = 0; level < 12; level++) {
        const yOffset = -level * lineHeight;
        const textY = sy - 6 + yOffset;
        const box = { x: centerX - boxW / 2, y: textY - 12, w: boxW, h: lineHeight };
        const overlaps = placed.some((p) =>
          box.x < p.x + p.w && box.x + box.w > p.x &&
          box.y < p.y + p.h && box.y + box.h > p.y
        );
        if (!overlaps) {
          chosenOffset = yOffset;
          placed.push(box);
          break;
        }
      }

      item.drawLabel(ctx, camera, chosenOffset);
    }
    ctx.restore();
  }
}


