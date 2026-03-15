// -------- Game Stats Methods Mixin --------
// Stats calculation, equipment stats
// This module adds methods to Game.prototype when imported

import { getSkillModSockets } from '../data/constants.js';
import { hasTalent } from '../data/talents.js';
import { getItemRarityColor } from '../ui/tooltips.js';
import { getCompanionBuffForRun, getFriendsState } from '../systems/friends-system.js';
import { recomputeAncestorState } from './ancestor-system.js';
import {
  hasRing,
  applyRingPassiveStatBonuses,
  getRingDashCooldownOffset,
  getRingAttackSpeedMultiplier,
  getRingExtraDashCharges,
  syncFocusCharges
} from './ring-effects.js';

export function applyGameStatsMixin(Game) {
  Object.assign(Game.prototype, {
    recalculateStats() {
      if (this.devStatsOverride) {
        this.currentStats = { ...this.devStatsOverride };
        recomputeAncestorState(this);
        this.currentHealth = Math.min(this.currentHealth, this.currentStats.maxHealth);
        this.updateStatsUI();
        this.updateHealthBar();
        return;
      }
      const stats = { ...this.baseStats };
      const percentMods = { attack: 0, maxHealth: 0, defense: 0, speed: 0, xpGained: 0, skillDamage: 0 };
      const getPillarEquipmentScale = (item, slot) => {
        if (typeof this.getPillarEquipmentStatMultiplier !== "function") return 1;
        return Math.max(0, Number(this.getPillarEquipmentStatMultiplier(item, slot)) || 1);
      };
      let equipmentAttackSpeedMult = 1;
      let equipmentCooldownRecovery = 1;
      let equipmentSpeedPenalty = 0;
      let hasHeavyArmour = false;
      const WEIGHT_PENALTIES = { light: 0, medium: 0.1, heavy: 0.15 };
      for (const slot of Object.keys(this.equipment)) {
        const item = this.equipment[slot];
        if (!item || !item.stats) continue;
        const pillarEquipmentScale = getPillarEquipmentScale(item, slot);
        if ((slot === "Helmet" || slot === "Body Armour") && item.weight) {
          let speedPenalty = WEIGHT_PENALTIES[item.weight] || 0;
          if (
            hasRing(this, "ring_armorers_grace") &&
            item.weight === "medium" &&
            (slot === "Helmet" || slot === "Body Armour")
          ) {
            speedPenalty = 0;
          }
          equipmentSpeedPenalty += speedPenalty;
          if (item.weight === "heavy") hasHeavyArmour = true;
        }
        for (const [k, v] of Object.entries(item.stats)) {
          const numericValue = Number(v);
          const useScaledValue = Number.isFinite(numericValue);
          const scaledValue = !useScaledValue
            ? v
            : (k === "attackSpeed" || k === "cooldownRecovery")
              ? 1 + (numericValue - 1) * pillarEquipmentScale
              : numericValue * pillarEquipmentScale;
          if (k === "attackSpeed") {
            equipmentAttackSpeedMult *= scaledValue;
          } else if (k === "cooldownRecovery") {
            equipmentCooldownRecovery *= scaledValue;
          } else if (k === "attackPercent" || k === "maxHealthPercent" || k === "defensePercent" || k === "speedPercent") {
            const baseKey = k.replace("Percent", "");
            percentMods[baseKey] = (percentMods[baseKey] || 0) + scaledValue;
          } else if (k === "xpGainedPercent") {
            percentMods.xpGained += scaledValue;
          } else if (k === "skillDamagePercent") {
            percentMods.skillDamage += scaledValue;
          } else {
            stats[k] = (stats[k] || 0) + scaledValue;
          }
        }
      }
      this.equipmentAttackSpeedMult = equipmentAttackSpeedMult;
      // Cap cooldown reduction from item modifiers to 40% total.
      // cooldownRecovery is a multiplier (1 - CDR), so 40% CDR floor is 0.60.
      equipmentCooldownRecovery = Math.max(0.6, equipmentCooldownRecovery);
      this.itemCooldownRecovery = equipmentCooldownRecovery;
      this.equipmentCooldownRecovery = equipmentCooldownRecovery;
      this.equipmentXpGainedMult = 1 + (percentMods.xpGained || 0);
      this.equipmentSkillDamageMult = 1 + (percentMods.skillDamage || 0);
      equipmentSpeedPenalty = Math.max(0, Math.min(0.95, equipmentSpeedPenalty));
      this.equipmentSpeedMult = 1 - equipmentSpeedPenalty;
      this.equipmentDashCooldownMult = hasHeavyArmour ? 1.2 : 1;
      this.dashCooldownTime = this.baseDashCooldownTime * this.equipmentDashCooldownMult;
      this.dashCooldownTime = Math.max(0.1, this.dashCooldownTime - getRingDashCooldownOffset(this));
      for (const key of ["attack", "maxHealth", "defense", "speed"]) {
        const pct = percentMods[key] || 0;
        if (pct !== 0) stats[key] = Math.round((stats[key] || 0) * (1 + pct));
      }
      if (this.hasRunTalent("bulwark")) stats.defense = Math.round((stats.defense || 0) * 1.1);
      if (this.hasRunTalent("thickSkin")) stats.defense = Math.round((stats.defense || 0) * 1.1);
      stats.maxHealth = Math.round(stats.maxHealth);
      stats.speed = Math.round(stats.speed);
      stats.attack = Math.round(stats.attack);

      // Apply companion buffs
      const friendsState = getFriendsState();
      const companionBuff = getCompanionBuffForRun(friendsState);
      if (companionBuff && companionBuff.modifiers) {
        const mods = companionBuff.modifiers;
        // Movement speed (moveSpeed)
        if (mods.moveSpeed) {
          stats.speed = Math.round(stats.speed * (1 + mods.moveSpeed));
        }
        // Skill damage (skillDamage)
        if (mods.skillDamage) {
          percentMods.skillDamage += mods.skillDamage;
        }
        // Skill cooldown reduction (skillCooldownReduction)
        if (mods.skillCooldownReduction) {
          equipmentCooldownRecovery *= (1 - mods.skillCooldownReduction);
        }
        this.companionSkillDamage = mods.skillDamage || 0;
        this.companionSkillCooldownReduction = mods.skillCooldownReduction || 0;
        // Store runtime modifiers for use during gameplay
        this.companionCritChance = mods.critChance || 0;
        this.companionDamageReduction = mods.damageReduction || 0;
        this.companionLifesteal = mods.lifesteal || 0;
        this.companionPickupRadius = mods.pickupRadius || 0;
        this.companionHpRegen = mods.hpRegen || 0;
        this.companionCubeDropRate = mods.cubeDropRate || 0;
        this.companionMeleeDamage = mods.meleeDamage || 0;
        this.companionDropDuplicateChance = mods.dropDuplicateChance || 0;
        this.companionShopDiscount = mods.shopDiscount || 0;
      } else {
        this.companionSkillDamage = 0;
        this.companionSkillCooldownReduction = 0;
        this.companionCritChance = 0;
        this.companionDamageReduction = 0;
        this.companionLifesteal = 0;
        this.companionPickupRadius = 0;
        this.companionHpRegen = 0;
        this.companionCubeDropRate = 0;
        this.companionMeleeDamage = 0;
        this.companionDropDuplicateChance = 0;
        this.companionShopDiscount = 0;
      }
      
      // Recalculate multipliers with companion buffs
      this.equipmentCooldownRecovery = equipmentCooldownRecovery;
      this.equipmentXpGainedMult = 1 + (percentMods.xpGained || 0);
      this.equipmentSkillDamageMult = 1 + (percentMods.skillDamage || 0);
      applyRingPassiveStatBonuses(this, stats);
      const pillarStatMods = typeof this.getPillarStatModifiers === "function" ? this.getPillarStatModifiers() : null;
      if (pillarStatMods) {
        stats.attack = Math.round((stats.attack || 0) * (pillarStatMods.attackMultiplier || 1) + (pillarStatMods.attackFlat || 0));
        stats.maxHealth = Math.round((stats.maxHealth || 0) * (pillarStatMods.maxHealthMultiplier || 1) + (pillarStatMods.maxHealthFlat || 0));
        stats.defense = Math.round((stats.defense || 0) * (pillarStatMods.defenseMultiplier || 1) + (pillarStatMods.defenseFlat || 0));
        stats.speed = Math.round((stats.speed || 0) * (pillarStatMods.moveSpeedMultiplier || 1) + (pillarStatMods.moveSpeedFlat || 0));
      }
      stats.hazardDamageReduction = Math.max(
        0,
        Math.min(0.75, Number(stats.hazardDamageReduction) || 0)
      );
      const pillarDashOverride = typeof this.getPillarDashChargeOverride === "function"
        ? this.getPillarDashChargeOverride()
        : null;
      const pillarInfiniteDash = !!pillarStatMods?.infiniteDashCharges;
      const pillarDashFlat = Math.max(0, Math.floor(Number(pillarStatMods?.dashChargesFlat) || 0));
      const computedDashMax = 2 + getRingExtraDashCharges(this) + pillarDashFlat;
      this.dashMaxCharges = pillarDashOverride == null ? computedDashMax : Math.max(0, pillarDashOverride);
      if (pillarInfiniteDash) {
        this.dashMaxCharges = Math.max(1, this.dashMaxCharges || computedDashMax || 1);
        this.dashCharges = this.dashMaxCharges;
        this.dashRechargeTimer = 0;
        this.dashCooldown = 0;
      } else {
        this.dashCharges = Math.min(this.dashCharges ?? this.dashMaxCharges, this.dashMaxCharges);
      }
      syncFocusCharges(this);
      
      this.currentStats = stats;
      recomputeAncestorState(this);
      this.currentHealth = Math.min(this.currentHealth, stats.maxHealth);
      this.updateStatsUI();
      this.updateHealthBar();
    },

    getPlayerStatRows() {
      const stats = this.currentStats;
      if (!stats) return [];

      const spdMult = this.equipmentSpeedMult ?? 1;
      const defenseValue = Math.max(0, Number(stats.defense) || 0);
      const defenseReductionPct = (defenseValue / (50 + defenseValue)) * 100;
      const baseSpeed = Math.round(stats.speed);
      const effectiveArmourSpeed = Math.round(baseSpeed * spdMult);
      const speedLabel = spdMult < 1 ? `${effectiveArmourSpeed} (${baseSpeed} base)` : `${baseSpeed}`;
      const rows = [
        ["Health", `${Math.round(this.currentHealth)}/${stats.maxHealth}`],
        ["Defense", `${stats.defense} (${defenseReductionPct.toFixed(1)}% DR)`],
        ["Speed", speedLabel],
        ["Attack", `${stats.attack}`]
      ];
      const attacksPerSecond = Math.round((1 / this.getCurrentBasicAttackCooldownSeconds()) * 100) / 100;
      const cdRec = this.equipmentCooldownRecovery ?? 1;
      const cooldownReductionPct = Math.max(0, Math.round((1 - cdRec) * 100));
      const dashCd = this.equipmentDashCooldownMult ?? 1;
      rows.push(["Attack Speed", `${attacksPerSecond.toFixed(2)}/s`]);
      rows.push(["Cooldown Red.", `${cooldownReductionPct}%`]);
      rows.push(["Hazard DR", `${Math.round((Number(stats.hazardDamageReduction) || 0) * 100)}%`]);
      if (spdMult < 1) rows.push(["Armour", `-${Math.round((1 - spdMult) * 100)}% speed`]);
      if (dashCd > 1) rows.push(["Dash CD", `+${Math.round((dashCd - 1) * 100)}%`]);
      return rows;
    },

    getCurrentBasicAttackCooldownSeconds() {
      const attackType = this.attackType || "projectile";
      const attackMults = typeof this.getSkillMultipliersFor === "function"
        ? (this.getSkillMultipliersFor(attackType) || {})
        : {};
      const attackSpeedMult = attackMults.attackSpeedMult || 1;
      const attackCooldownMult = attackMults.cooldownMult || 1;

      let atkSpdMult = (this.equipmentAttackSpeedMult || 1) * (this.talentAttackSpeedMult || 1);
      atkSpdMult *= getRingAttackSpeedMultiplier(this);
      if (typeof this.getPillarAttackSpeedMultiplier === "function") {
        atkSpdMult *= this.getPillarAttackSpeedMultiplier({ attackType });
      }
      if (this.frenzyBuffUntil > this.time) atkSpdMult *= 1.3;
      if (this.hasRunTalent("brutalityRetaliation") && this.time < (this.brutalityRetaliationUntil || 0) && (this.brutalityRetaliationStacks || 0) > 0) {
        atkSpdMult *= 1 + (this.brutalityRetaliationStacks || 0) * 0.05;
      }
      if (typeof this.getAttackUpgradeValue === "function") {
        atkSpdMult *= 1 + this.getAttackUpgradeValue("attackSpeed");
      }
      if (typeof this.getAttackPenaltyValue === "function") {
        atkSpdMult *= 1 - this.getAttackPenaltyValue("speedPenalty");
      }
      if (this.playerWeakenUntil > this.time) atkSpdMult *= 0.9;

      const projectileEvolution = typeof this.getProjectileShotEvolutionOverrides === "function"
        ? this.getProjectileShotEvolutionOverrides()
        : null;
      if (this.attackType === "projectile" && projectileEvolution?.attackSpeedMult != null) {
        atkSpdMult *= projectileEvolution.attackSpeedMult;
      }

      atkSpdMult = Math.max(0.05, atkSpdMult);
      const baseCooldown = this.devAttackCooldownOverride ?? this.playerAttackCooldown ?? 0.72;
      let effectiveCooldown = (baseCooldown / atkSpdMult) * attackCooldownMult;
      effectiveCooldown /= attackSpeedMult;

      if (this.hasRunTalent("cardSurge") && this.cardSurgeUntil > this.time) {
        effectiveCooldown /= 1.2;
      }
      if (typeof this.getAttackPenaltyValue === "function") {
        effectiveCooldown += this.getAttackPenaltyValue("cooldown");
      }
      if (typeof this.hasUpgradeCard === "function" && this.hasUpgradeCard("berserkerRage")) {
        const ratio = this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
        effectiveCooldown *= Math.max(0.4, ratio);
      }

      return Math.max(0.01, effectiveCooldown);
    },

    renderPlayerStatRows(targetEl, rows) {
      if (!targetEl) return;
      targetEl.innerHTML = "";

      for (const [label, value] of rows) {
        const labelEl = document.createElement("div");
        labelEl.className = "player-stat-label";
        labelEl.textContent = label;

        const valueEl = document.createElement("div");
        valueEl.className = "player-stat-value";
        valueEl.textContent = value;

        targetEl.appendChild(labelEl);
        targetEl.appendChild(valueEl);
      }
    },

    updateStatsUI() {
      const rows = this.getPlayerStatRows();
      this.renderPlayerStatRows(this.playerStatsEl, rows);
      const overlayStatsEl = document.getElementById("inventory-overlay-stats-list");
      this.renderPlayerStatRows(overlayStatsEl, rows);
    }
  });
}
