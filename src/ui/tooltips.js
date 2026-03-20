// -------- Item tooltip formatting & display --------

import { escapeHtml } from '../utils.js';
import { LEGENDARY_MODIFIER_IDS, LEGENDARY_MODIFIER_EFFECTS } from '../data/cubes-data.js';
import {
  RARITY_COLORS,
  EQUIPMENT_BASE_STAT,
  EQUIPMENT_SECONDARY_BASE,
  NAME_PREFIXES,
  NAME_SUFFIXES,
  MODIFIER_RARITY
} from '../data/loot-data.js';
import { ANCESTOR_SPIRIT_DEFS } from '../data/ancestor-spirits-data.js';
import { getRingDefById } from '../data/rings-data.js';

const PERCENT_STAT_LABELS = { xpGained: "XP Gained", skillDamage: "Skill Damage" };
const SORTED_NAME_PREFIXES = [...NAME_PREFIXES].sort((a, b) => b.length - a.length);
const SORTED_NAME_SUFFIXES = [...NAME_SUFFIXES].sort((a, b) => b.length - a.length);

function splitItemNameParts(rawName) {
  const name = String(rawName || "").trim();
  if (!name) return { prefix: "", base: "", affix: "" };

  let prefix = "";
  let base = name;
  let affix = "";

  const matchedPrefix = SORTED_NAME_PREFIXES.find((p) => base.startsWith(`${p} `));
  if (matchedPrefix) {
    prefix = matchedPrefix;
    base = base.slice(matchedPrefix.length + 1);
  }

  const matchedSuffix = SORTED_NAME_SUFFIXES.find((s) => base.endsWith(` ${s}`));
  if (matchedSuffix) {
    affix = matchedSuffix;
    base = base.slice(0, -(matchedSuffix.length + 1));
  }

  if (!base) base = name;
  return { prefix, base, affix };
}

function formatModifierLine(mod) {
  if (!mod) return "";
  const isLegendary = LEGENDARY_MODIFIER_IDS.includes(mod.id);
  if (isLegendary) {
    const effect = LEGENDARY_MODIFIER_EFFECTS[mod.id] || "";
    return effect ? `${mod.label} (${effect})` : mod.label;
  }
  if (mod.id === "defenseStatScale") return `Defense of this item +${Math.round(mod.value * 100)}%`;
  if (mod.id === "maxHealthStatScale") return `Max Health of this item +${Math.round(mod.value * 100)}%`;
  if (mod.id === "dashFireball") return "Dash spawns a fireball";
  if (mod.id === "restoreHpOnNewMapFlat") return "Recover life on entering a new map";
  if (mod.id === "healOnKillChance") return "Chance to recover life on kill";
  if (mod.id === "restoreHpOnLevelUpFlat") return "Recover life on level up";
  if (mod.id === "chanceToBleedOnHit") return "Basic attacks have a chance to inflict bleed";
  if (mod.id === "chanceToBurnOnHit") return "Basic attacks have a chance to inflict burn";
  if (mod.id === "chanceToSlowOnHit") return "Basic attacks have a chance to inflict slow";
  if (mod.id === "projectilePierce") return `Projectiles pierce +${Math.round(Number(mod.value) || 0)} additional targets`;
  if (mod.id === "orbitalArrows") return `Every 2s: fire ${Math.max(1, Math.round(Number(mod.value) || 0))} arrows around you (10% Attack Damage)`;
  if (mod.id === "mapEntryGoldPercent") return `Enter new area: gain ${Math.round((Number(mod.value) || 0) * 100)}% of your Gold`;
  if (mod.id === "repeatBasicAttackChance") return "Chance to repeat a basic attack hit";
  if (mod.id === "goldPickupDamageBuff") return "Picking up gold grants a damage buff";
  if (mod.id === "critLifesteal") return "Critical hits restore life";
  if (mod.id === "chestCritChanceBuff") return "Opening a chest grants crit chance briefly";
  if (mod.id === "basicAttackExplosion") return "Basic attacks can trigger an explosion";
  if (mod.id === "newMapGoldXpBuff") return "Entering a map grants temporary Gold/XP bonus";
  if (mod.id === "chestBonusXpFlat") return "Opening a chest grants bonus XP";
  if (mod.id === "pickMagicItemMoveSpeedBuff") return "Picking up a magic item grants move speed briefly";
  if (mod.id === "critAttackSpeedStacking") return "Critical hits grant stacking attack speed";
  if (mod.id === "chestDamageStacking") return "Opening chests grants stacking damage";
  if (mod.id === "dashChargeBonus") return "Gain +1 maximum dash charge";
  if (mod.id === "reactiveKnockbackHeal") return "Taking damage knocks back nearby enemies and heals";
  if (mod.id === "critSummonSpirit") return "Critical hits can summon a spirit projectile";
  if (mod.id === "critLightningChance") return "Critical hits can trigger chain lightning";
  if (mod.id === "newMapMoveSpeedBuff") return "Entering a map grants temporary move speed";
  if (mod.id === "enterMapGoldFlat") return `Enter new area: gain ${Math.round(Number(mod.value) || 0)} Gold`;
  if (mod.id === "minibossGoldFlat") return `Kill a mini-boss: gain ${Math.round(Number(mod.value) || 0)} Gold`;
  if (mod.id === "fullHpMoveSpeed") return "At full Health: gain Move Speed";
  if (mod.id === "burningEnemyAttackSpeed") return "Nearby burning enemies increase Attack Speed";
  if (mod.id === "lowCritHighDamage") return "Tradeoff: +200% Critical Damage, Crit Chance capped at 30%";
  if (mod.id === "critScalingDamage") return "Gain +1% Critical Damage per 2% Critical Chance";
  if (mod.id === "levelUpBonusAttributeChance") return "Level up: chance to gain +1 Attribute Point";
  if (mod.id === "levelUpAttackSpeedStack") return "Level up: permanently gain Attack Speed";
  if (mod.id === "levelUpMaxHealthFlat") return "Level up: permanently gain Max Health";
  if (mod.id === "levelUpAttackDamageStack") return "Level up: permanently gain Attack Damage";
  if (mod.id === "attackDamageVsHealth") return "Tradeoff: Attack Damage up, Max Health down";
  if (mod.id === "xpVsHealth") return "Tradeoff: XP Gained up, Max Health down";
  if (mod.id === "attackSpeedVsHealth") return "Tradeoff: Attack Speed up, Max Health down";
  if (mod.id === "healthVsMoveSpeed") return "Tradeoff: Max Health up, Move Speed down";
  if (mod.id === "doubleDashHeavyCooldown") return "Tradeoff: +2 Dash Charges, much longer Dash cooldown";
  if (mod.id === "moveSpeedChestOpenHybrid") {
    const ms = Math.round((Number(mod?.statMods?.speedPercent) || 0) * 100);
    const co = Math.round((Number(mod?.statMods?.chestOpenSpeedPercent) || 0) * 100);
    return `+${ms}% Movement Speed and +${co}% Chest Open Speed`;
  }
  if (mod.id === "flatDefenseBonus") {
    const def = Math.round(Number(mod?.statMods?.defense) || 0);
    return `+${def} Defense`;
  }
  if (mod.id === "flatHpDefenseHybrid") {
    const hp = Math.round(Number(mod?.statMods?.maxHealth) || 0);
    const def = Math.round(Number(mod?.statMods?.defense) || 0);
    return `+${hp} Max Health and +${def} Defense`;
  }
  if (mod.id === "flatHpMoveSpeedHybrid") {
    const hp = Math.round(Number(mod?.statMods?.maxHealth) || 0);
    const spd = Math.round(Number(mod?.statMods?.speed) || 0);
    return `+${hp} Max Health and +${spd} Movement Speed`;
  }
  if (mod.id === "moveAttackSpeedHybrid") {
    const ms = Math.round((Number(mod?.statMods?.speedPercent) || 0) * 100);
    const as = Math.round((Number(mod?.statMods?.attackSpeedPercent) || 0) * 100);
    return `+${ms}% Movement Speed and +${as}% Attack Speed`;
  }
  if (mod.id === "ring_gambler_health_penalty") return `${Math.round(Math.abs(mod.value) * 100)}% decreased Max Health`;
  if (mod.id === "ring_gambler_damage") return `+${Math.round(mod.value * 100)}% increased damage`;
  if (mod.id === "meleeFlatDamage" || mod.statKey === "flatDamage") return `+${Math.round(mod.value)} ${mod.label}`;
  const pct = Math.round((mod.value || 0) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% ${mod.label}`;
}

function getModifierRarityColor(mod) {
  const rarity = String(mod?.rarity || MODIFIER_RARITY.NORMAL).toLowerCase();
  if (rarity === MODIFIER_RARITY.RARE) return RARITY_COLORS.rare;   // yellow
  if (rarity === MODIFIER_RARITY.MAGIC) return RARITY_COLORS.magic; // blue
  return RARITY_COLORS.common;                                      // white
}

export function formatItemStats(item) {
  const parts = [];
  if (item.stats && Object.keys(item.stats).length > 0) {
    const fmt = (k, v) => {
      if (k === "attackSpeed") {
        const pct = Math.round((v - 1) * 100);
        const sign = pct >= 0 ? "+" : "";
        return `${sign}${pct}% atk spd`;
      }
      if (k === "cooldownRecovery") return `${Math.round((1 - v) * 100)}% less CD`;
      if (k.endsWith("Percent")) return `+${Math.round(v * 100)}% ${k.replace("Percent", "")}`;
      if (k === "xpGained" || k === "skillDamage") return `+${Math.round(v * 100)}% ${PERCENT_STAT_LABELS[k] || k}`;
      return `${k}: +${v}`;
    };
    parts.push(Object.entries(item.stats).map(([k, v]) => fmt(k, v)).join(", "));
  }
  if (item.weight && (item.type === "Helmet" || item.type === "Body Armour" || item.type === "Boots" || item.type === "Weapon")) {
    const w = item.weight;
    if (item.type === "Boots") {
      if (w === "light") parts.push("Light Boots (120% speed base)");
      else if (w === "medium") parts.push("Medium Boots (+10-30 max health base)");
      else if (w === "heavy") parts.push("Heavy Boots (80% speed base, +20-40 max health, +5-10 defense base)");
    } else if (item.type === "Weapon") {
      if (w === "light") parts.push("Light Weapon (80% attack base, +10-20% atk speed base)");
      else if (w === "medium") parts.push("Medium Weapon (100% attack base, +5-10% atk speed base)");
      else if (w === "heavy") parts.push("Heavy Weapon (140% attack base, -20-30% atk speed base)");
    } else {
      if (w === "medium") parts.push("Medium (-10% speed)");
      else if (w === "heavy") parts.push("Heavy (-15% speed, +20% dash CD)");
      else if (w === "light") parts.push("Light (no penalty)");
    }
  }
  return parts.join(" | ");
}

export function formatItemModifiers(item) {
  if (!item.modifiers || item.modifiers.length === 0) return [];
  return item.modifiers.map((m) => formatModifierLine(m));
}

export function formatItemModifierEntries(item) {
  if (!item?.modifiers || item.modifiers.length === 0) return [];
  return item.modifiers.map((m) => ({
    text: formatModifierLine(m),
    color: getModifierRarityColor(m)
  }));
}

export function getItemRarityColor(item) {
  if (!item) return "#e2e8f0";
  if (item.rarity === "legendary") return RARITY_COLORS.legendary;
  if (item.rarity === "magic") return RARITY_COLORS.magic;
  if (item.rarity === "rare") return RARITY_COLORS.rare;
  return RARITY_COLORS.common;
}

/** Shown next to a stat when comparing to equipped gear: `(+5)` / `(-3)` (empty if no difference). */
function formatFlatStatDeltaHtml(current, eq, shouldCompare) {
  if (!shouldCompare) return "";
  const d = Math.round((Number(current) || 0) - (Number(eq) || 0));
  if (d === 0) return "";
  return ` <span class="tooltip-stat-delta">(${d >= 0 ? "+" : ""}${d})</span>`;
}

/** Attack speed stored as multiplier; delta shown in percentage points vs equipped. */
function formatAttackSpeedDeltaHtml(current, eq, shouldCompare) {
  if (!shouldCompare) return "";
  const d = Math.round(((Number(current) || 0) - (Number(eq) || 0)) * 100);
  if (d === 0) return "";
  return ` <span class="tooltip-stat-delta">(${d >= 0 ? "+" : ""}${d})</span>`;
}

function formatModifierDeltaSuffix(mod, eqVal) {
  const curRaw = mod?.value;
  const cur = Number(curRaw);
  const eq = Number(eqVal) || 0;
  const curSafe = Number.isFinite(cur) ? cur : 0;
  const d = curSafe - eq;
  if (Math.abs(d) < 1e-9) return "";

  const id = mod?.id;

  if (
    id === "projectilePierce" ||
    id === "orbitalArrows" ||
    id === "enterMapGoldFlat" ||
    id === "minibossGoldFlat"
  ) {
    const di = Math.round(d);
    if (di === 0) return "";
    return ` <span class="tooltip-stat-delta">(${di >= 0 ? "+" : ""}${di})</span>`;
  }

  if (id === "meleeFlatDamage" || mod?.statKey === "flatDamage") {
    const di = Math.round(d);
    if (di === 0) return "";
    return ` <span class="tooltip-stat-delta">(${di >= 0 ? "+" : ""}${di})</span>`;
  }

  if (id === "defenseStatScale" || id === "maxHealthStatScale") {
    const dp = Math.round(d * 100);
    if (dp === 0) return "";
    return ` <span class="tooltip-stat-delta">(${dp >= 0 ? "+" : ""}${dp})</span>`;
  }

  if (
    id === "moveSpeedChestOpenHybrid" ||
    id === "flatDefenseBonus" ||
    id === "flatHpDefenseHybrid" ||
    id === "flatHpMoveSpeedHybrid" ||
    id === "moveAttackSpeedHybrid"
  ) {
    return "";
  }

  const dp = Math.round(d * 100);
  if (dp === 0) return "";
  return ` <span class="tooltip-stat-delta">(${dp >= 0 ? "+" : ""}${dp})</span>`;
}

export function buildItemTooltipContent(item, game = null) {
  const rarityColor = getItemRarityColor(item);
  const { prefix, base, affix } = splitItemNameParts(item.name);
  const nameParts = [];
  if (prefix) nameParts.push(`<span class="tooltip-name-prefix">${escapeHtml(prefix)}</span>`);
  nameParts.push(`<span class="tooltip-name-base">${escapeHtml(base)}</span>`);
  if (affix) nameParts.push(`<span class="tooltip-name-affix">${escapeHtml(affix)}</span>`);
  const nameHtml = nameParts.join(" ");
  const type = escapeHtml(item.type || "Item");
  const ringDef = item?.type === "Ring" && item?.ringId ? getRingDefById(item.ringId) : null;
  const resolvedDesc = item?.description || ringDef?.description || "";
  const desc = resolvedDesc ? escapeHtml(resolvedDesc) : "";

  let html = `<div class="tooltip-name" style="color:${rarityColor}">${nameHtml}</div><div class="tooltip-type">${type}</div>`;

  if (item.type === "Upgrade Card") {
    if (desc) html += `<div class="tooltip-desc">${desc}</div>`;
    return html;
  }

  const baseKey = EQUIPMENT_BASE_STAT[item.type];
  const equipped = game && item.type && item.type !== "Ring" ? game.equipment[item.type] : null;
  const compareToEquipped = !!(equipped && equipped !== item);
  if (baseKey) {
    const baseVal = item.stats && item.stats[baseKey] ? item.stats[baseKey] : 0;
    const baseLabel = baseKey === "maxHealth" ? "Max Health" : baseKey === "attack" ? "Attack" : baseKey === "speed" ? "Speed" : "Defense";
    const eqBaseVal = equipped?.stats?.[baseKey] ?? 0;
    let baseCls = "tooltip-stats";
    if (compareToEquipped) {
      if (baseVal > eqBaseVal) baseCls += " tooltip-better";
      else if (baseVal < eqBaseVal) baseCls += " tooltip-worse";
    }
    html += `<div class="${baseCls}">${baseLabel}: +${baseVal}${formatFlatStatDeltaHtml(baseVal, eqBaseVal, compareToEquipped)}</div>`;
  } else if (item.type === "Ring") {
    html += `<div class="tooltip-stats">${desc || "Unique Effect"}</div>`;
    if (item.consumedOnTrigger) {
      html += `<div class="tooltip-mod" style="color:#f97316">Consumed on trigger</div>`;
    }
  }

  const statLabel = (k) => {
    if (k === "maxHealth") return "Max Health";
    if (k === "defense") return "Defense";
    if (k === "speed") return "Speed";
    if (k === "attack") return "Attack";
    if (k === "attackSpeed") return "Attack Speed";
    return k;
  };

  const displayedBaseStatKeys = new Set(baseKey ? [baseKey] : []);

  // Display secondary stat if it exists (for Helmets and Body Armours)
  const sec = EQUIPMENT_SECONDARY_BASE[item.type];
  if (sec && item.stats && item.stats[sec.statKey]) {
    const secVal = item.stats[sec.statKey];
    const secLabel = sec.statKey === "maxHealth" ? "Max Health" : sec.statKey === "defense" ? "Defense" : sec.statKey;
    const eqSecVal = equipped?.stats?.[sec.statKey] ?? 0;
    let secCls = "tooltip-stats";
    if (compareToEquipped) {
      if (secVal > eqSecVal) secCls += " tooltip-better";
      else if (secVal < eqSecVal) secCls += " tooltip-worse";
    }
    html += `<div class="${secCls}">${secLabel}: +${secVal}${formatFlatStatDeltaHtml(secVal, eqSecVal, compareToEquipped)}</div>`;
    displayedBaseStatKeys.add(sec.statKey);
  }

  // Display any extra base stats (e.g. medium/heavy boots maxHealth/defense).
  const baseStatEntries = Object.entries(item.baseStat || {});
  for (const [key, val] of baseStatEntries) {
    if (displayedBaseStatKeys.has(key)) continue;
    const currentVal = item.stats?.[key] ?? val;
    if (!currentVal) continue;
    const eqVal = equipped?.stats?.[key] ?? 0;
    let extraCls = "tooltip-stats";
    if (compareToEquipped) {
      if (currentVal > eqVal) extraCls += " tooltip-better";
      else if (currentVal < eqVal) extraCls += " tooltip-worse";
    }
    let valueText = `+${currentVal}`;
    if (key === "attackSpeed") {
      const pct = Math.round((currentVal - 1) * 100);
      const sign = pct >= 0 ? "+" : "";
      valueText = `${sign}${pct}%`;
    }
    const deltaHtml =
      key === "attackSpeed"
        ? formatAttackSpeedDeltaHtml(currentVal, eqVal, compareToEquipped)
        : formatFlatStatDeltaHtml(currentVal, eqVal, compareToEquipped);
    html += `<div class="${extraCls}">${statLabel(key)}: ${valueText}${deltaHtml}</div>`;
  }

  if (item.modifiers && item.modifiers.length > 0) {
    const eqModifiers = equipped?.modifiers || [];
    for (const m of item.modifiers) {
      const isLegendaryMod = LEGENDARY_MODIFIER_IDS.includes(m.id);
      const classes = ["tooltip-mod"];
      if (isLegendaryMod) classes.push("tooltip-legendary-mod");
      let eqModValForDelta = 0;
      if (!isLegendaryMod && compareToEquipped) {
        const eqMod = eqModifiers.find((x) => x.id === m.id);
        const eqVal = eqMod ? eqMod.value : 0;
        eqModValForDelta = eqVal;
        if (m.value > eqVal) classes.push("tooltip-better");
        else if (m.value < eqVal) classes.push("tooltip-worse");
      }
      const elapsed = m.addedAt ? Date.now() - m.addedAt : 99999;
      if (elapsed < 10000) classes.push("mod-crafted");
      const style = elapsed < 10000 ? ` style="animation-delay: -${elapsed / 1000}s"` : "";
      const text = formatModifierLine(m);
      const color = getModifierRarityColor(m);
      const removedText = elapsed < 10000 && m.removedModifier ? formatModifierLine(m.removedModifier) : "";
      const removedHtml = removedText
        ? `<span class="tooltip-mod-removed mod-removed-fade"${style}>Removed: ${escapeHtml(removedText)}</span>`
        : "";
      const modDeltaHtml = !isLegendaryMod && compareToEquipped ? formatModifierDeltaSuffix(m, eqModValForDelta) : "";
      html += `<div class="${classes.join(" ")}"${style}><span style="color:${color}">${escapeHtml(text)}</span>${modDeltaHtml}${removedHtml}</div>`;
    }
  }

  if (item.weight && (item.type === "Helmet" || item.type === "Body Armour" || item.type === "Boots" || item.type === "Weapon")) {
    const w = item.weight;
    let wText = "";
    if (item.type === "Boots") {
      if (w === "light") wText = "Light Boots (120% speed base)";
      else if (w === "medium") wText = "Medium Boots (+10-30 max health base)";
      else if (w === "heavy") wText = "Heavy Boots (80% speed base, +20-40 max health, +5-10 defense base)";
    } else if (item.type === "Weapon") {
      if (w === "light") wText = "Light Weapon (80% attack base, +10-20% atk speed base)";
      else if (w === "medium") wText = "Medium Weapon (100% attack base, +5-10% atk speed base)";
      else if (w === "heavy") wText = "Heavy Weapon (140% attack base, -20-30% atk speed base)";
    } else {
      wText = w === "medium" ? "Medium (-10% speed)" : w === "heavy" ? "Heavy (-15% speed, +20% dash CD)" : "Light (no penalty)";
    }
    html += `<div class="tooltip-stats">${escapeHtml(wText)}</div>`;
  }
  const equipmentWithUpgrade = ["Weapon", "Helmet", "Body Armour", "Boots"];
  if (equipmentWithUpgrade.includes(item.type)) {
    const upgradeLevel = Math.min(5, Math.max(0, item.weaponUpgradeLevel ?? 0));
    const upgradeText = upgradeLevel >= 5 ? "Upgrade: +5 (max)" : `Upgrade: +${upgradeLevel}`;
    html += `<div class="tooltip-stats">${escapeHtml(upgradeText)}</div>`;
  }
  if ((item.vesselsMax || 0) > 0) {
    const vessels = Array.isArray(item.vessels) ? item.vessels : [];
    const filled = vessels.filter((v) => !!v?.spiritId).length;
    html += `<div class="tooltip-stats">Vessels: ${filled}/${item.vesselsMax}</div>`;
    const spiritNames = [];
    for (const vessel of vessels) {
      if (!vessel?.spiritId) continue;
      const spirit = game?.runInventory?.ancestorSpiritRegistry?.[vessel.spiritId];
      const def = spirit?.defId ? ANCESTOR_SPIRIT_DEFS[spirit.defId] : null;
      spiritNames.push(def?.name || spirit?.defId || "Spirit");
    }
    if (spiritNames.length > 0) {
      html += `<div class="tooltip-mod">Spirits: ${escapeHtml(spiritNames.join("  "))}</div>`;
    }
  }
  if (desc && item.type !== "Ring") html += `<div class="tooltip-desc">${desc}</div>`;
  return html;
}

export function showItemTooltip(e, item, game = null) {
  const el = document.getElementById("item-tooltip");
  if (!el || !item) return;
  el.innerHTML = buildItemTooltipContent(item, game);
  el.style.left = "-9999px";
  el.style.top = "0";
  el.classList.remove("hidden");
  el.offsetHeight; // force reflow
  const rect = (e.currentTarget || e.target).getBoundingClientRect();
  const tr = el.getBoundingClientRect();
  let left = rect.left + (rect.width / 2) - (tr.width / 2);
  let top = rect.bottom + 6;
  if (left < 8) left = 8;
  if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
  if (top + tr.height > window.innerHeight - 8) top = rect.top - tr.height - 6;
  if (top < 8) top = 8;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

export function hideItemTooltip() {
  const el = document.getElementById("item-tooltip");
  if (el) {
    el.classList.add("hidden");
    el.innerHTML = "";
  }
}
