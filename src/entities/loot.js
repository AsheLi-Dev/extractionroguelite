import { Vec2 } from '../utils.js';
import { RARITY_COLORS, LOOT_COLORS, LOOT_ICONS, LOOT_DEFS, generateEquipmentItem } from '../data/loot-data.js';
import { getCubeLabel } from '../data/cubes-data.js';

export class LootItem {
  constructor(id, x, y, definition, burstFromX = null, burstFromY = null) {
    this.id = id;
    this.position = new Vec2(x, y);
    this.size = 20;
    this.type = definition.type;
    this.name = definition.name;
    this.cubeKey = definition.cubeKey ?? null;
    this.stats = definition.stats || {};
    this.cardKey = definition.cardKey || null;
    this.description = definition.description || "";
    this.weight = definition.weight || null;
    this.rarity = definition.rarity || null;
    this.modifiers = definition.modifiers || [];
    this.baseStat = definition.baseStat || null;
    this.sockets = definition.sockets ?? 0;
    this.goldAmount = definition.goldAmount ?? 0;
    this.color = this.rarity ? RARITY_COLORS[this.rarity] : (LOOT_COLORS[this.type] || "#fbbf24");
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
    const pos = this.displayPosition;
    const sx = Math.floor(pos.x - camera.position.x);
    const sy = Math.floor(pos.y - camera.position.y);
    const half = this.size / 2;
    const pulse = 0.75 + 0.25 * Math.sin(timeSeconds * 4 + this.id);
    const icon = LOOT_ICONS[this.type] || "💰";

    ctx.save();
    ctx.translate(sx + half, sy + half);
    ctx.scale(pulse, pulse);

    if (this.type === "Gold") {
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 10;
    } else if (this.rarity === "legendary") {
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 18 + 4 * Math.sin(timeSeconds * 6);
    } else if (this.rarity === "magic") {
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 14;
    } else if (this.rarity === "rare") {
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 16;
    }

    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, half);
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fill();

    if (this.rarity === "magic" || this.rarity === "rare") {
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.round(this.size * 1.1)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (this.type === "Gold" && this.goldAmount > 0) {
      ctx.fillText(String(this.goldAmount), 0, 0);
    } else {
      ctx.fillText(icon, 0, 0);
    }
    if (this.type === "Gold") ctx.shadowBlur = 0;

    ctx.restore();

  }

  drawLabel(ctx, camera, yOffset = 0) {
    const label = this.name || this.type;
    if (!label) return;
    const pos = this.displayPosition;
    const sx = Math.floor(pos.x - camera.position.x);
    const sy = Math.floor(pos.y - camera.position.y);
    const labelX = sx + this.size / 2;
    const labelY = sy - 6 + yOffset;
    const labelColor = this.rarity ? (RARITY_COLORS[this.rarity] || "#f8fafc") : "#f8fafc";

    ctx.save();
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(2, 6, 23, 0.95)";
    ctx.strokeText(label, labelX, labelY);
    ctx.fillStyle = labelColor;
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
  }

  intersectsPlayer(player) {
    if (this.age < this.pickupDelay) return false;
    if (this.burstFrom && this.burstProgress < 1) return false;
    const pos = this.displayPosition;
    const r1 = {
      x: pos.x,
      y: pos.y,
      w: this.size,
      h: this.size
    };
    const r2 = {
      x: player.position.x,
      y: player.position.y,
      w: player.size,
      h: player.size
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
  }

  setMapLootQuality(quality) {
    this.mapLootQuality = quality;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty != null ? Math.min(5, Math.max(1, difficulty)) : 1;
  }

  getLootDefinition(qualityBonus = 0) {
    const group = LOOT_DEFS[Math.floor(Math.random() * LOOT_DEFS.length)];
    const opts = this.difficulty != null ? { difficulty: this.difficulty } : {};
    return generateEquipmentItem(group.type, this.mapLootQuality, qualityBonus, null, opts);
  }

  spawnGuaranteedWeaponAt(centerX, centerY) {
    const opts = this.difficulty != null ? { difficulty: this.difficulty } : {};
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

  update(dt, player, onLootPicked) {
    for (const item of this.items) {
      item.updateBurst(dt);
    }

    const remaining = [];
    for (const item of this.items) {
      if (item.intersectsPlayer(player)) {
        if (onLootPicked) onLootPicked(item);
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
    ctx.font = "12px sans-serif";
    for (const item of sorted) {
      const label = item.name || item.type;
      if (!label) continue;
      const pos = item.displayPosition;
      const sx = Math.floor(pos.x - camera.position.x);
      const sy = Math.floor(pos.y - camera.position.y);
      const centerX = sx + item.size / 2;
      const textWidth = Math.ceil(ctx.measureText(label).width);
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
