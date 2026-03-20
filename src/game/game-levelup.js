// -------- Game Level Up Methods Mixin --------
// Automatic build-driven upgrades and weapon evolutions.

import { getXpForLevel } from '../entities/enemy.js';
import { markSkillEncountered, addSkillXp } from '../data/constants.js';
import {
  createEmptyCategoryCounts,
  getAttackUpgradeDefById,
  getBladeBlastDominantCategories,
  getBladeBlastUpgradeCategoryCounts,
  getBuildUpgradePoolForAttackType,
  getBuildUpgradeQuotaTotalForAttack,
  getElementalShotUpgradeCategoryCounts,
  getElementalShotDominantCategories,
  rollUpgradeValue
} from '../data/level-up-data.js';
import { getElementalShotEvolutionState, getElementalShotProfile } from '../data/elemental-shot-evolution.js';
import {
  BLADE_BLAST_BASE_WEAPON_ID,
  getAttackEvolutionById,
  getBladeBlastTier1EvolutionOptions,
  getBladeBlastTier2EvolutionOptions,
  getTier1EvolutionOptions,
  getTier2EvolutionOptions
} from '../data/attack-evolutions.js';
import {
  getSoulSiphonFirstEvolutionOptions,
  getSoulSiphonSecondEvolutionOptions
} from '../data/soul-siphon-evolution.js';
import { onRingLevelUp } from './ring-effects.js';
import { play as playSfx } from '../audio.js';

const PROJECTILE_BASE_WEAPON_ID = "ProjectileShot";
const CATEGORY_ORDER = ["damage", "rhythm", "control", "onhit"];
const CATEGORY_LABELS = {
  damage: "Damage",
  rhythm: "Rhythm",
  control: "Control",
  onhit: "OnHit"
};

const ELEMENTAL_SHOT_CATEGORY_LABELS = {
  damage: "Damage",
  rhythm: "Rhythm",
  control: "Control",
  elemental: "Elemental"
};

const ELEMENTAL_SHOT_FIRST_EVO_NAMES = {
  damage: "Inferno Core",
  rhythm: "Storm Engine",
  control: "Tempest Arc",
  elemental: "Prismatic Cycle"
};

function cloneCategoryCounts(counts) {
  return {
    damage: Math.max(0, Math.floor(Number(counts?.damage) || 0)),
    rhythm: Math.max(0, Math.floor(Number(counts?.rhythm) || 0)),
    control: Math.max(0, Math.floor(Number(counts?.control) || 0)),
    onhit: Math.max(0, Math.floor(Number(counts?.onhit) || 0)),
    elemental: Math.max(0, Math.floor(Number(counts?.elemental) || 0))
  };
}

function getMaxCategoryCount(counts) {
  return CATEGORY_ORDER.reduce((max, category) => Math.max(max, Number(counts?.[category]) || 0), 0);
}

function getDominantCategories(counts) {
  const maxCount = getMaxCategoryCount(counts);
  if (maxCount <= 0) return [];
  return CATEGORY_ORDER.filter((category) => (Number(counts?.[category]) || 0) === maxCount);
}

function closeLevelUpOverlay(game) {
  const overlay = document.getElementById("level-up-overlay");
  const rerollBtn = document.getElementById("level-up-reroll");
  if (overlay) {
    overlay.classList.remove("level-up-overlay-visible", "level-up-overlay-evolution");
    overlay.classList.add("hidden");
  }
  if (rerollBtn) {
    rerollBtn.classList.add("hidden");
    rerollBtn.onclick = null;
  }
  game.levelUpChoices = null;
  game.levelUpChoiceContext = null;
  game.paused = false;
  if (game.pauseToggleEl) {
    game.pauseToggleEl.textContent = "Pause";
    game.pauseToggleEl.classList.remove("paused");
  }
}

export function applyGameLevelUpMixin(Game) {
  Object.assign(Game.prototype, {
    showLevelUpOverlayShell(title, subtitle, options = {}) {
      const overlay = document.getElementById("level-up-overlay");
      const titleEl = overlay?.querySelector(".level-up-title");
      const subtitleEl = overlay?.querySelector(".level-up-subtitle");
      if (!overlay || !titleEl || !subtitleEl) return null;
      titleEl.textContent = title || "Level Up!";
      subtitleEl.textContent = subtitle || "";
      overlay.classList.toggle("level-up-overlay-evolution", !!options.evolution);
      overlay.classList.remove("hidden", "level-up-overlay-visible");
      void overlay.offsetWidth;
      overlay.classList.add("level-up-overlay-visible");
      return overlay;
    },

    ensureUpgradeOnlyStats() {
      if (!this.upgradeOnlyStats) {
        this.upgradeOnlyStats = {
          attackDamagePct: 0,
          projectileRangePct: 0,
          attackSpeedPct: 0
        };
      }
      return this.upgradeOnlyStats;
    },

    addUpgradeOnlyStatsFromLevelUpUpgrade(upgrade) {
      if (!upgrade) return;
      const stats = this.ensureUpgradeOnlyStats();
      const value = Number(upgrade.value || 0);
      if (!Number.isFinite(value)) return;
      if (upgrade.id === "damageBoost") stats.attackDamagePct += value;
      if (upgrade.id === "rangeBoost") stats.projectileRangePct += value;
      if (upgrade.id === "attackSpeed") stats.attackSpeedPct += value;
      // Elemental Shot (rarity-first) IDs
      if (upgrade.id === "elemental_damage") stats.attackDamagePct += value;
      if (upgrade.id === "range_boost") stats.projectileRangePct += value;
      if (upgrade.id === "attack_speed") stats.attackSpeedPct += value;
    },

    refreshAscendedGrowthRuntimeState() {
      const pickState = this.levelUpPickState;
      if (!pickState || Number(pickState.pickCount || 0) <= 1) {
        this.__pillarAscendedGrowthState = null;
        return;
      }
      const currentPickIndex = Math.max(
        0,
        Math.min(Number(pickState.pickCount || 1) - 1, Number(pickState.resolvedPicks || 0))
      );
      this.__pillarAscendedGrowthState = {
        active: true,
        pickCount: Number(pickState.pickCount || 1),
        picksRemaining: Number(pickState.picksRemaining || 0),
        resolvedPicks: Number(pickState.resolvedPicks || 0),
        currentPickIndex,
        currentEffectiveness: Number(pickState.effectiveness?.[currentPickIndex] ?? 1) || 1,
        effectiveness: Array.isArray(pickState.effectiveness) ? [...pickState.effectiveness] : [1],
        chosen: Array.isArray(pickState.chosen) ? [...pickState.chosen] : []
      };
    },

    ensureSelectedUpgrades() {
      if (!Array.isArray(this.selectedUpgrades)) {
        this.selectedUpgrades = [];
      }
      const maxSelected = getBuildUpgradeQuotaTotalForAttack(this.attackType);
      if (this.selectedUpgrades.length >= maxSelected) return this.selectedUpgrades;
      const buildPool = getBuildUpgradePoolForAttackType(this.attackType);
      while (this.selectedUpgrades.length < maxSelected && buildPool.length > 0) {
        const def = buildPool[Math.floor(Math.random() * buildPool.length)];
        this.selectedUpgrades.push({
          id: def.id,
          name: def.name,
          category: def.category,
          level: 0,
          maxLevel: def.maxLevel
        });
      }
      return this.selectedUpgrades;
    },

    getSelectedAttackEvolution(baseWeaponId) {
      const state = this.weaponEvolutionState?.[baseWeaponId];
      if (!state) return null;
      return getAttackEvolutionById(state.tier2Id || state.tier1Id);
    },

    getProjectileShotEvolution() {
      return this.getSelectedAttackEvolution(PROJECTILE_BASE_WEAPON_ID);
    },

    getBladeBlastEvolution() {
      return this.getSelectedAttackEvolution(BLADE_BLAST_BASE_WEAPON_ID);
    },

    getProjectileShotEvolutionOverrides() {
      if (this.attackType === "projectile") {
        const profile = typeof getElementalShotProfile === "function" ? getElementalShotProfile(getElementalShotEvolutionState(this)) : null;
        if (!profile) return null;
        if ((this.elementalShotEvolutionFirst != null) && !this._elementalShotSurgeSynced) {
          this._elementalShotSurgeSynced = true;
          this.elementalState = profile.defaultElement ?? "fire";
          const sb = profile.surgeBehavior?.elements;
          if (Array.isArray(sb) && sb[0]) this.nextElementalSurge = sb[0];
        }
        const pm = profile.projectileMods || {};
        return {
          damageMult: pm.damageMult,
          projectileSpeedMult: pm.speedMult,
          attackSpeedMult: pm.attackSpeedMult,
          projectileScaleMult: pm.speedMult,
          infiniteRange: !!pm.pierceInfinite,
          pierceEnabled: !!pm.pierceInfinite,
          pierceMaxTargets: pm.pierceInfinite ? Number.POSITIVE_INFINITY : undefined,
          attackMode: profile.attackMode,
          defaultElement: profile.defaultElement,
          surgeBehavior: profile.surgeBehavior,
          projectileMods: pm,
          elementalInteractions: profile.elementalInteractions || {},
          environment: profile.environment || {},
          links: profile.links || {},
          formId: profile.formId
        };
      }
      return this.getProjectileShotEvolution()?.overrides || null;
    },

    getBladeBlastEvolutionOverrides() {
      if (this.attackType !== "bladeBlast") return null;
      return this.getBladeBlastEvolution()?.overrides || null;
    },

    hasAttackUpgrade(id) {
      return (this.runAttackUpgrades || []).some((upgrade) => upgrade.id === id);
    },

    getAttackUpgradeValue(id) {
      return (this.runAttackUpgrades || []).reduce((sum, upgrade) => {
        if (upgrade.id !== id || upgrade.value == null) return sum;
        return sum + (upgrade.percent ? upgrade.value / 100 : upgrade.value);
      }, 0);
    },

    getAttackUpgradeStackCount(id) {
      return (this.runAttackUpgrades || []).reduce((sum, upgrade) => {
        if (upgrade.id !== id) return sum;
        const lvl = Number(upgrade.level || 1);
        return sum + (Number.isFinite(lvl) && lvl > 0 ? lvl : 1);
      }, 0);
    },

    /** Elemental Shot: effective max charge (profile can override, faster_charge reduces by 2 per stack). */
    getEffectiveMaxElementalCharge() {
      if (this.attackType !== "projectile") return this.maxElementalCharge ?? 12;
      const profileCharge = this.getElementalShotProfile?.()?.surgeChargeRequired;
      const base = profileCharge != null ? profileCharge : (this.maxElementalCharge ?? 12);
      const reduce = typeof this.getAttackUpgradeStackCount === "function" ? this.getAttackUpgradeStackCount("faster_charge") * 2 : 0;
      return Math.max(2, base - reduce);
    },

    /**
     * Elemental Shot evolution trace: attack type, applied upgrades, category counts,
     * threshold checks, and evolution assignment. Use for debugging why evolutions never trigger.
     * @returns {object|null} Trace object or null if not projectile.
     */
    getElementalShotEvolutionTrace() {
      const attackType = this.attackType;
      const trace = {
        attackType,
        isProjectile: attackType === "projectile",
        level: this.level,
        appliedUpgrades: {
          length: (this.runAttackUpgrades || []).length,
          ids: (this.runAttackUpgrades || []).map((u) => u.id),
          perUpgrade: (this.runAttackUpgrades || []).map((u) => {
            const def = typeof getAttackUpgradeDefById === "function" ? getAttackUpgradeDefById(attackType, u.id) : null;
            const category = def?.category ?? null;
            const inElementalKeys = def && ["damage", "rhythm", "control", "elemental"].includes(category);
            return { id: u.id, defFound: !!def, category, inElementalKeys, level: u.level };
          })
        },
        categoryCounts: null,
        maxCount: 0,
        dominantFirst: null,
        dominantSecond: null,
        thresholdFirst: false,
        thresholdSecond: false,
        evolutionFirst: this.elementalShotEvolutionFirst ?? null,
        evolutionSecond: this.elementalShotEvolutionSecond ?? null,
        assignment: { firstAssigned: false, secondAssigned: false },
        reasons: []
      };
      if (attackType !== "projectile") {
        trace.reasons.push("attackType is not 'projectile'");
        return trace;
      }
      const counts = typeof getElementalShotUpgradeCategoryCounts === "function" ? getElementalShotUpgradeCategoryCounts(this) : { damage: 0, rhythm: 0, control: 0, elemental: 0 };
      trace.categoryCounts = counts;
      trace.maxCount = Math.max(counts.damage || 0, counts.rhythm || 0, counts.control || 0, counts.elemental || 0);
      const [first, second] = typeof getElementalShotDominantCategories === "function" ? getElementalShotDominantCategories(counts) : [null, null];
      trace.dominantFirst = first;
      trace.dominantSecond = second;
      trace.thresholdFirst = this.level >= 9;
      trace.thresholdSecond = this.level >= 16;

      if (!this.elementalShotEvolutionFirst) {
        if (!trace.thresholdFirst) trace.reasons.push("first: level < 9");
        else if (!first) trace.reasons.push("first: no dominant category (all zeros?)");
        else trace.assignment.firstAssigned = true;
      } else {
        trace.assignment.firstAssigned = true;
      }
      if (!this.elementalShotEvolutionSecond && this.elementalShotEvolutionFirst) {
        if (!trace.thresholdSecond) trace.reasons.push("second: level < 16");
        else if (!first) trace.reasons.push("second: no dominant category");
        else trace.assignment.secondAssigned = true;
      } else if (this.elementalShotEvolutionSecond) {
        trace.assignment.secondAssigned = true;
      }
      if (trace.reasons.length > 0) {
        const defsMissing = trace.appliedUpgrades.perUpgrade.filter((p) => !p.defFound).length;
        if (defsMissing > 0) trace.diagnostic = `${defsMissing} upgrade(s) have no def for attackType '${attackType}' (wrong pool or id)?`;
        else if (!trace.thresholdFirst && trace.appliedUpgrades.length < 5) trace.diagnostic = `Only ${trace.appliedUpgrades.length} upgrades in runAttackUpgrades; need 5 in one category (grantRandomSelectedUpgrade adding?)`;
        else if (!trace.thresholdFirst) trace.diagnostic = "maxCount < 5; spread upgrades across damage/rhythm/control/elemental?";
        else trace.diagnostic = trace.reasons.join("; ");
      }
      return trace;
    },

    /** Elemental Shot: lightweight debug info (evolution, profile, upgrades, charge, category counts). */
    getElementalShotDebugInfo() {
      if (this.attackType !== "projectile") return null;
      const counts = typeof getElementalShotUpgradeCategoryCounts === "function" ? getElementalShotUpgradeCategoryCounts(this) : { damage: 0, rhythm: 0, control: 0, elemental: 0 };
      const [firstDominant, secondDominant] = typeof getElementalShotDominantCategories === "function" ? getElementalShotDominantCategories(counts) : [null, null];
      const evoState = typeof getElementalShotEvolutionState === "function" ? getElementalShotEvolutionState(this) : { first: null, second: null, formId: "base" };
      const profile = typeof getElementalShotProfile === "function" ? getElementalShotProfile(evoState) : null;
      const upgrades = (this.runAttackUpgrades || []).filter((u) => ["elemental_damage", "burning_power", "burn_hunter", "attack_speed", "projectile_speed", "elemental_charge", "range_boost", "spread_reduction", "crit_chance", "lightning_conduction", "wind_bleed", "extra_projectile", "faster_charge", "fire_explosion", "detonation_boost", "wind_force", "seeking", "chain_lightning", "explosive_burn", "inferno", "elemental_overdrive", "storm_wind", "superstorm"].includes(u.id));
      const stacks = (id) => (typeof this.getAttackUpgradeStackCount === "function" ? this.getAttackUpgradeStackCount(id) : 0);
      const surgeSec = this.hasAttackUpgrade?.("elemental_overdrive") ? 5 : (profile?.surgeBehavior?.durationSec ?? 3);
      return {
        firstEvolution: this.elementalShotEvolutionFirst ?? null,
        secondEvolution: this.elementalShotEvolutionSecond ?? null,
        formId: evoState?.formId ?? "base",
        attackMode: profile?.attackMode ?? "projectile",
        defaultElement: profile?.defaultElement ?? "fire",
        currentElement: this.elementalState ?? "fire",
        nextSurgeElement: this.nextElementalSurge ?? "wind",
        surgeEndTime: this.elementalSurgeEndTime ?? 0,
        categoryCounts: counts,
        firstDominant: firstDominant,
        secondDominant: secondDominant,
        upgrades: upgrades.map((u) => ({ id: u.id, level: u.level || 1, value: u.value })),
        elementalCharge: this.elementalCharge ?? 0,
        maxElementalCharge: this.getEffectiveMaxElementalCharge?.() ?? 12,
        activeStormCount: (this.elementalStorms || []).length,
        activeSwirlCount: (this.elementalSwirls || []).filter((s) => !s.consumed && this.time < (s.endTime || 0)).length,
        derived: {
          damageMult: (profile?.projectileMods?.damageMult ?? 1) * (1 + (this.getAttackUpgradeValue?.("elemental_damage") || 0)),
          attackSpeedMult: (profile?.projectileMods?.attackSpeedMult ?? 1) * (1 + (this.getAttackUpgradeValue?.("attack_speed") || 0)),
          projectileSpeedMult: (profile?.projectileMods?.speedMult ?? 1) * (1 + (this.getAttackUpgradeValue?.("projectile_speed") || 0)),
          chainCount: 2 + (stacks("chain_lightning") || 0),
          surgeDurationSec: surgeSec
        }
      };
    },

    hasAttackPenalty(id) {
      return (this.runAttackPenalties || []).some((penalty) => penalty.id === id);
    },

    getAttackPenaltyValue(id) {
      return (this.runAttackPenalties || []).reduce((sum, penalty) => {
        if (penalty.id !== id || penalty.value == null) return sum;
        return sum + (penalty.percent ? penalty.value / 100 : penalty.value);
      }, 0);
    },

    getCategoryCounts() {
      if (!this.categoryCounts) this.categoryCounts = createEmptyCategoryCounts();
      return cloneCategoryCounts(this.categoryCounts);
    },

    getTier1Prediction() {
      const history = Array.isArray(this.upgradeHistory) ? this.upgradeHistory.slice(0, 5) : [];
      const counts = createEmptyCategoryCounts();
      for (const entry of history) {
        if (!entry?.category || counts[entry.category] == null) continue;
        counts[entry.category]++;
      }
      return {
        counts,
        upgradesConsidered: history.length,
        remainingUntilEvolution: Math.max(0, 5 - history.length),
        dominantCategories: getDominantCategories(counts),
        resolvedEvolutionId: this.tier1EvolutionId || null
      };
    },

    getTier2Progress() {
      const counts = this.getCategoryCounts();
      const progress = {};
      for (const category of CATEGORY_ORDER) {
        const current = Number(counts[category]) || 0;
        progress[category] = {
          label: CATEGORY_LABELS[category],
          current,
          target: 5,
          unlocked: current >= 5
        };
      }
      return progress;
    },

    applyTransformChoice(transformOption) {
      const baseWeaponId = transformOption?.baseWeaponId || PROJECTILE_BASE_WEAPON_ID;
      const evolutionId = transformOption?.evolutionId;
      if (!baseWeaponId || !evolutionId) return;
      const evoDef = getAttackEvolutionById(evolutionId);
      if (!evoDef) return;

      this.weaponEvolutionState = this.weaponEvolutionState || {};
      this.weaponEvolutions = this.weaponEvolutions || {};
      this.evolutionGroupSelections = this.evolutionGroupSelections || {};

      const state = this.weaponEvolutionState[baseWeaponId] || { tier1Id: null, tier2Id: null };
      if (evoDef.tier === 1) {
        state.tier1Id = evoDef.id;
        state.tier2Id = null;
        if (baseWeaponId === BLADE_BLAST_BASE_WEAPON_ID) {
          this.bladeBlastTier1EvolutionId = evoDef.id;
          this.bladeBlastTier2EvolutionId = null;
        } else {
          this.tier1EvolutionId = evoDef.id;
          this.tier2EvolutionId = null;
          this.tier2EvolutionPending = false;
          this.tier2DelayRemaining = 0;
        }
      } else {
        state.tier1Id = state.tier1Id || evoDef.parentEvolutionId || null;
        state.tier2Id = evoDef.id;
        if (baseWeaponId === BLADE_BLAST_BASE_WEAPON_ID) {
          this.bladeBlastTier1EvolutionId = state.tier1Id;
          this.bladeBlastTier2EvolutionId = evoDef.id;
        } else {
          this.tier1EvolutionId = state.tier1Id;
          this.tier2EvolutionId = evoDef.id;
          this.tier2EvolutionPending = false;
          this.tier2DelayRemaining = 0;
        }
      }
      this.weaponEvolutionState[baseWeaponId] = state;
      this.weaponEvolutions[baseWeaponId] = state.tier2Id || state.tier1Id || null;
      if (evoDef.groupId) this.evolutionGroupSelections[evoDef.groupId] = evoDef.id;

      // Spiritual Resonance: souls on Soul Siphon evolution
      if (baseWeaponId === PROJECTILE_BASE_WEAPON_ID && typeof this.getAttackUpgradeStackCount === "function") {
        const stacks = this.getAttackUpgradeStackCount("spiritual_resonance");
        if (stacks > 0 && typeof this.runSoulsTotal === "number") {
          const bonusSouls = 8 * stacks;
          this.runSoulsTotal = (this.runSoulsTotal || 0) + bonusSouls;
        }
      }
    },

    grantXP(amount) {
      let mult = this.equipmentXpGainedMult ?? 1;
      if ((this.equipmentNewMapGoldXpBuffUntil || 0) > this.time) {
        mult *= (this.equipmentNewMapGoldXpBuffMult || 1);
      }
      if (this.frenzyBuffUntil > this.time) {
        mult *= 1.2;
      }
      const rounded = Math.round(amount * mult);
      this.xp += rounded;
      this.updateXpUI();
      this.checkLevelUp();
      for (let i = 0; i < (this.skills?.length || 0); i++) {
        const skillId = this.skills[i];
        if (!skillId) continue;
        markSkillEncountered(skillId);
        const result = addSkillXp(skillId, rounded);
        if (result && result.leveledUp) {
          this.skillLevelUpThisFrame = this.skillLevelUpThisFrame || [];
          this.skillLevelUpThisFrame.push({ skillId, level: result.level });
        }
      }
    },

    createAppliedUpgradeFromSelection(selectedUpgrade) {
      const def = getAttackUpgradeDefById(this.attackType, selectedUpgrade?.id);
      if (!def) return null;
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        level: Math.max(1, Math.floor(Number(selectedUpgrade?.level) || 1)),
        maxLevel: def.maxLevel,
        value: rollUpgradeValue(def),
        percent: !!def.valueRange?.percent
      };
    },

    grantRandomSelectedUpgrade() {
      const selectedUpgrades = this.ensureSelectedUpgrades();
      const available = selectedUpgrades.filter((upgrade) => {
        if (upgrade?.maxLevel == null) return true;
        return Number(upgrade.level || 0) < Number(upgrade.maxLevel || 0);
      });
      if (available.length === 0) return null;
      const selectedUpgrade = available[Math.floor(Math.random() * available.length)];
      selectedUpgrade.level = Math.max(0, Number(selectedUpgrade.level) || 0) + 1;
      const appliedUpgrade = this.createAppliedUpgradeFromSelection(selectedUpgrade);
      if (!appliedUpgrade) return null;
      this.runAttackUpgrades = this.runAttackUpgrades || [];
      this.runAttackUpgrades.push(appliedUpgrade);
      this.addUpgradeOnlyStatsFromLevelUpUpgrade(appliedUpgrade);
      this.upgradeHistory = this.upgradeHistory || [];
      this.upgradeHistory.push({
        id: selectedUpgrade.id,
        name: selectedUpgrade.name,
        category: selectedUpgrade.category,
        level: selectedUpgrade.level,
        maxLevel: selectedUpgrade.maxLevel
      });
      if (typeof this.addFloatingUpgradeText === "function" && this.player) {
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y - 10;
        this.addFloatingUpgradeText(px, py, `Level Up: ${selectedUpgrade.name}`);
      }
      if (!this.categoryCounts) this.categoryCounts = createEmptyCategoryCounts();
      if (this.categoryCounts[selectedUpgrade.category] == null) {
        this.categoryCounts[selectedUpgrade.category] = 0;
      }
      this.categoryCounts[selectedUpgrade.category]++;
      return appliedUpgrade;
    },

    shouldForceTier2EvolutionPrompt() {
      return !this.tier2EvolutionId && this.tier2EvolutionPending && this.tier2DelayRemaining <= 0;
    },

    getTier1EvolutionChoiceDefs() {
      const prediction = this.getTier1Prediction();
      return getTier1EvolutionOptions(prediction.dominantCategories, PROJECTILE_BASE_WEAPON_ID);
    },

    getUnlockedTier2Categories() {
      const counts = this.getCategoryCounts();
      return CATEGORY_ORDER.filter((category) => (Number(counts[category]) || 0) >= 5);
    },

    getTier2EvolutionChoiceDefs() {
      if (!this.tier1EvolutionId) return [];
      return getTier2EvolutionOptions(
        this.tier1EvolutionId,
        this.getUnlockedTier2Categories(),
        PROJECTILE_BASE_WEAPON_ID
      );
    },

    getBladeBlastTier1EvolutionChoiceDefs() {
      const counts = getBladeBlastUpgradeCategoryCounts(this);
      const dominant = getDominantCategories(counts);
      const categories = dominant.length > 0 ? dominant : CATEGORY_ORDER;
      return getBladeBlastTier1EvolutionOptions(categories, BLADE_BLAST_BASE_WEAPON_ID);
    },

    getBladeBlastTier2EvolutionChoiceDefs() {
      if (!this.bladeBlastTier1EvolutionId) return [];
      const counts = getBladeBlastUpgradeCategoryCounts(this);
      const [first, second] = getBladeBlastDominantCategories(counts);
      const firstEvoDef = getAttackEvolutionById(this.bladeBlastTier1EvolutionId);
      const categories = [first, second, firstEvoDef?.sourceCategory]
        .filter((category, index, arr) => category && arr.indexOf(category) === index);
      return getBladeBlastTier2EvolutionOptions(
        this.bladeBlastTier1EvolutionId,
        categories.length > 0 ? categories : CATEGORY_ORDER,
        BLADE_BLAST_BASE_WEAPON_ID
      );
    },

    openEvolutionPrompt(context, evolutionDefs, options = {}) {
      if (!Array.isArray(evolutionDefs) || evolutionDefs.length === 0) return false;
      this.levelUpChoices = evolutionDefs.map((evoDef) => ({
        type: "evolution",
        evolutionId: evoDef.id,
        baseWeaponId: evoDef.baseWeaponId || options.baseWeaponId || context.baseWeaponId || PROJECTILE_BASE_WEAPON_ID,
        name: evoDef.name,
        description: evoDef.summary,
        tier: evoDef.tier
      }));
      this.levelUpChoiceContext = {
        ...context,
        baseWeaponId: options.baseWeaponId || context.baseWeaponId || evolutionDefs[0]?.baseWeaponId || PROJECTILE_BASE_WEAPON_ID,
        delayAllowed: !!options.delayAllowed
      };

      const choicesEl = document.getElementById("level-up-choices");
      const rerollBtn = document.getElementById("level-up-reroll");
      const overlay = this.showLevelUpOverlayShell(
        context.title || "Evolution",
        context.subtitle || "Choose an evolution.",
        { evolution: true }
      );
      if (!overlay || !choicesEl) return false;
      choicesEl.innerHTML = "";
      for (const choice of this.levelUpChoices) {
        const btn = document.createElement("button");
        btn.className = "level-up-card level-up-card-unique";
        btn.innerHTML = `
          <div class="level-up-card-inner">
            <div class="level-up-card-upgrade">
              <strong>${choice.name}</strong><br>
              <span class="level-up-card-desc">${choice.description || ""}</span>
            </div>
          </div>
        `;
        btn.addEventListener("click", () => this.applyLevelUpChoice(choice, btn));
        choicesEl.appendChild(btn);
      }

      if (rerollBtn) {
        if (context.type === "tier2" && options.delayAllowed) {
          rerollBtn.classList.remove("hidden");
          rerollBtn.textContent = "Delay Tier 2";
          rerollBtn.onclick = () => this.delayTier2Evolution();
        } else {
          rerollBtn.classList.add("hidden");
          rerollBtn.onclick = null;
        }
      }

      this.paused = true;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Resume";
        this.pauseToggleEl.classList.add("paused");
      }
      const buildLogPanel = document.getElementById("build-log-panel");
      if (buildLogPanel) {
        buildLogPanel.classList.remove("hidden");
        if (this.buildLogRefresh) this.buildLogRefresh();
      }
      return true;
    },

    openElementalShotEvolutionPrompt(context, choices) {
      if (!Array.isArray(choices) || choices.length === 0) return false;
      this.levelUpChoices = choices.map((c) => ({
        type: "elementalShotEvolution",
        stage: c.stage,
        category: c.category,
        name: c.name,
        description: c.description || ""
      }));
      this.levelUpChoiceContext = { ...context, delayAllowed: false };

      const choicesEl = document.getElementById("level-up-choices");
      const rerollBtn = document.getElementById("level-up-reroll");
      const overlay = this.showLevelUpOverlayShell(
        context.title || "Evolution",
        context.subtitle || "",
        { evolution: true }
      );
      if (!overlay || !choicesEl) return false;
      choicesEl.innerHTML = "";
      for (const choice of this.levelUpChoices) {
        const btn = document.createElement("button");
        btn.className = "level-up-card level-up-card-unique";
        btn.innerHTML = `
          <div class="level-up-card-inner">
            <div class="level-up-card-upgrade">
              <strong>${choice.name}</strong><br>
              <span class="level-up-card-desc">${choice.description || ""}</span>
            </div>
          </div>
        `;
        btn.addEventListener("click", () => this.applyLevelUpChoice(choice, btn));
        choicesEl.appendChild(btn);
      }

      if (rerollBtn) {
        rerollBtn.classList.add("hidden");
        rerollBtn.onclick = null;
      }

      this.paused = true;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Resume";
        this.pauseToggleEl.classList.add("paused");
      }
      const buildLogPanel = document.getElementById("build-log-panel");
      if (buildLogPanel) {
        buildLogPanel.classList.remove("hidden");
        if (this.buildLogRefresh) this.buildLogRefresh();
      }
      return true;
    },

    openSoulSiphonEvolutionPrompt(context, choices) {
      if (!Array.isArray(choices) || choices.length === 0) return false;
      this.levelUpChoices = choices.map((choice) => ({
        type: "soulSiphonEvolution",
        stage: choice.stage,
        category: choice.category,
        name: choice.name,
        description: choice.description || ""
      }));
      this.levelUpChoiceContext = { ...context, delayAllowed: false };

      const choicesEl = document.getElementById("level-up-choices");
      const rerollBtn = document.getElementById("level-up-reroll");
      const overlay = this.showLevelUpOverlayShell(
        context.title || "Evolution",
        context.subtitle || "",
        { evolution: true }
      );
      if (!overlay || !choicesEl) return false;
      choicesEl.innerHTML = "";
      for (const choice of this.levelUpChoices) {
        const btn = document.createElement("button");
        btn.className = "level-up-card level-up-card-unique";
        btn.innerHTML = `
          <div class="level-up-card-inner">
            <div class="level-up-card-upgrade">
              <strong>${choice.name}</strong><br>
              <span class="level-up-card-desc">${choice.description || ""}</span>
            </div>
          </div>
        `;
        btn.addEventListener("click", () => this.applyLevelUpChoice(choice, btn));
        choicesEl.appendChild(btn);
      }

      if (rerollBtn) {
        rerollBtn.classList.add("hidden");
        rerollBtn.onclick = null;
      }

      this.paused = true;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Resume";
        this.pauseToggleEl.classList.add("paused");
      }
      const buildLogPanel = document.getElementById("build-log-panel");
      if (buildLogPanel) {
        buildLogPanel.classList.remove("hidden");
        if (this.buildLogRefresh) this.buildLogRefresh();
      }
      return true;
    },

    getElementalShotDominantCategoriesForEvolution() {
      const counts = getElementalShotUpgradeCategoryCounts(this);
      const [first, second] = getElementalShotDominantCategories(counts);
      const firstCat = first || "damage";
      const secondCat = (second && second !== firstCat) ? second : "elemental";
      return [firstCat, secondCat];
    },

    maybeOpenElementalShotFirstEvolutionPrompt() {
      if (this.attackType !== "projectile") return false;
      if (this.elementalShotEvolutionFirst) return false;
      if (this.level !== 9) return false;
      const [major] = this.getElementalShotDominantCategoriesForEvolution();
      const label = ELEMENTAL_SHOT_CATEGORY_LABELS[major] || "Damage";
      const name = ELEMENTAL_SHOT_FIRST_EVO_NAMES[major] || "Inferno Core";
      return this.openElementalShotEvolutionPrompt({
        type: "elementalShotFirst",
        title: "Elemental Shot – First Evolution",
        subtitle: `Your build has converged on ${label}.`
      }, [{
        stage: "first",
        category: major,
        name,
        description: `First evolution: ${label}.`
      }]);
    },

    maybeOpenElementalShotSecondEvolutionPrompt() {
      if (this.attackType !== "projectile") return false;
      if (!this.elementalShotEvolutionFirst || this.elementalShotEvolutionSecond) return false;
      if (this.level !== 16) return false;
      const [major, secondMajor] = this.getElementalShotDominantCategoriesForEvolution();
      const opts = [major, secondMajor].filter((x, i, a) => x && a.indexOf(x) === i);
      const choices = opts.map((cat) => ({
        stage: "second",
        category: cat,
        name: `${ELEMENTAL_SHOT_CATEGORY_LABELS[cat] || cat} Path`,
        description: `Second evolution option: ${ELEMENTAL_SHOT_CATEGORY_LABELS[cat] || cat}.`
      }));
      return this.openElementalShotEvolutionPrompt({
        type: "elementalShotSecond",
        title: "Elemental Shot – Second Evolution",
        subtitle: "Choose your second evolution."
      }, choices);
    },

    maybeOpenBladeBlastFirstEvolutionPrompt() {
      if (this.attackType !== "bladeBlast") return false;
      if (this.bladeBlastTier1EvolutionId) return false;
      if (this.level !== 9) return false;
      const choices = this.getBladeBlastTier1EvolutionChoiceDefs();
      return this.openEvolutionPrompt({
        type: "bladeBlastTier1",
        baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
        title: "Blade & Blast - First Evolution",
        subtitle: "Your hybrid style is ready to specialize."
      }, choices, { baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID, delayAllowed: false });
    },

    maybeOpenBladeBlastSecondEvolutionPrompt() {
      if (this.attackType !== "bladeBlast") return false;
      if (!this.bladeBlastTier1EvolutionId || this.bladeBlastTier2EvolutionId) return false;
      if (this.level !== 16) return false;
      const choices = this.getBladeBlastTier2EvolutionChoiceDefs();
      return this.openEvolutionPrompt({
        type: "bladeBlastTier2",
        baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID,
        title: "Blade & Blast - Final Evolution",
        subtitle: "Choose the form your hybrid attack will take."
      }, choices, { baseWeaponId: BLADE_BLAST_BASE_WEAPON_ID, delayAllowed: false });
    },

    maybeOpenSoulSiphonFirstEvolutionPrompt() {
      if (this.attackType !== "soulSiphon") return false;
      if (this.soulSiphonEvolutionFirst) return false;
      if (this.level !== 9) return false;
      return this.openSoulSiphonEvolutionPrompt({
        type: "soulSiphonFirst",
        title: "Soul Siphon - First Evolution",
        subtitle: "Choose the first direction for your beam and spirit."
      }, getSoulSiphonFirstEvolutionOptions());
    },

    maybeOpenSoulSiphonSecondEvolutionPrompt() {
      if (this.attackType !== "soulSiphon") return false;
      if (!this.soulSiphonEvolutionFirst || this.soulSiphonEvolutionSecond) return false;
      if (this.level !== 16) return false;
      return this.openSoulSiphonEvolutionPrompt({
        type: "soulSiphonSecond",
        title: "Soul Siphon - Final Evolution",
        subtitle: "Choose how Soul Siphon finishes evolving."
      }, getSoulSiphonSecondEvolutionOptions(this.soulSiphonEvolutionFirst));
    },

    delayTier2Evolution() {
      this.tier2EvolutionPending = true;
      this.tier2DelayRemaining = 3;
      closeLevelUpOverlay(this);
      this.recalculateStats();
      this.updateXpUI();
      if (this.buildLogRefresh) this.buildLogRefresh();
      this.checkLevelUp();
    },

    maybeOpenTier1EvolutionPrompt() {
      if (this.attackType === "soulSiphon") return false;
      if (this.attackType === "projectile") return false;
      if (this.attackType === "bladeBlast") return false;
      if (this.tier1EvolutionId || this.level !== 7) return false;
      const choices = this.getTier1EvolutionChoiceDefs();
      return this.openEvolutionPrompt({
        type: "tier1",
        title: "Tier 1 Evolution",
        subtitle: "Your opening build has converged. Choose how your basic attack evolves."
      }, choices);
    },

    maybeOpenTier2EvolutionPrompt(options = {}) {
      if (this.attackType === "projectile") return false;
      if (this.attackType === "bladeBlast") return false;
      if (!this.tier1EvolutionId || this.tier2EvolutionId) return false;
      const choices = this.getTier2EvolutionChoiceDefs();
      if (choices.length === 0) return false;
      const forced = !!options.forced;
      const canDelay = !forced && !this.tier2EvolutionPending;
      return this.openEvolutionPrompt({
        type: "tier2",
        title: forced ? "Tier 2 Evolution" : "Tier 2 Evolution Ready",
        subtitle: forced
          ? "Your delay window has ended. Choose your final evolution."
          : "A final evolution is available. Choose it now or delay for up to 3 more levels."
      }, choices, { delayAllowed: canDelay });
    },

    finalizeLevelUpState() {
      this.recalculateStats();
      this.updateXpUI();
      if (this.buildLogRefresh) this.buildLogRefresh();
    },

    checkLevelUp() {
      if (this.levelUpChoices) return;
      let leveled = false;
      while (!this.levelUpChoices) {
        const nextThreshold = getXpForLevel(this.level + 1);
        if (this.xp < nextThreshold) break;

        this.level++;
        leveled = true;
        this.runAttributePoints = Math.max(0, Number(this.runAttributePoints) || 0) + 1;
        onRingLevelUp(this);
        this.triggerEquipmentModifierEvent?.("level_up", {
          level: this.level,
          previousLevel: this.level - 1
        });
        if (typeof playSfx === "function") playSfx("levelUp");
        this.levelUpVfxStartTime = this.time;
        this.updateXpUI();

        if (this.maybeOpenElementalShotFirstEvolutionPrompt()) break;
        if (this.maybeOpenElementalShotSecondEvolutionPrompt()) break;
        if (this.maybeOpenBladeBlastFirstEvolutionPrompt()) break;
        if (this.maybeOpenBladeBlastSecondEvolutionPrompt()) break;
        if (this.maybeOpenSoulSiphonFirstEvolutionPrompt()) break;
        if (this.maybeOpenSoulSiphonSecondEvolutionPrompt()) break;

        if (this.maybeOpenTier1EvolutionPrompt()) {
          break;
        }

        if (!this.tier2EvolutionId && this.level === 13) {
          if (this.maybeOpenTier2EvolutionPrompt({ forced: false })) {
            break;
          }
          continue;
        }

        // Elemental Shot evolutions consume the level-up at 9 and 16 (no upgrade granted).
        if ((this.attackType === "projectile" && this.level === 9) || (this.attackType === "projectile" && this.level === 16)) {
          this.finalizeLevelUpState();
          continue;
        }
        if ((this.attackType === "bladeBlast" && this.level === 9) || (this.attackType === "bladeBlast" && this.level === 16)) {
          this.finalizeLevelUpState();
          continue;
        }
        if ((this.attackType === "soulSiphon" && this.level === 9) || (this.attackType === "soulSiphon" && this.level === 16)) {
          this.finalizeLevelUpState();
          continue;
        }

        const grantedUpgrade = this.grantRandomSelectedUpgrade();
        if (this.tier2EvolutionPending && !this.tier2EvolutionId) {
          this.tier2DelayRemaining--;
        }

        if (!grantedUpgrade) {
          this.finalizeLevelUpState();
          continue;
        }

        if (this.attackType === "projectile") {
          if (typeof this.getElementalShotEvolutionTrace === "function" && (this.level === 9 || this.level === 16)) {
            const trace = this.getElementalShotEvolutionTrace();
            if (trace) console.log("[Elemental Shot evolution]", trace);
          }
        }

        if (this.shouldForceTier2EvolutionPrompt()) {
          this.finalizeLevelUpState();
          if (this.maybeOpenTier2EvolutionPrompt({ forced: true })) {
            break;
          }
        } else if (
          !this.tier2EvolutionId &&
          !this.tier2EvolutionPending &&
          this.level > 13 &&
          this.getUnlockedTier2Categories().length > 0
        ) {
          this.finalizeLevelUpState();
          if (this.maybeOpenTier2EvolutionPrompt({ forced: false })) {
            break;
          }
        } else {
          this.finalizeLevelUpState();
        }
      }

      if (leveled && !this.levelUpChoices) {
        this.finalizeLevelUpState();
      }
    },

    buildLevelUpCards() {
      return [];
    },

    showLevelUpChoices() {
      this.levelUpChoices = null;
      this.levelUpChoiceContext = null;
    },

    applyLevelUpChoice(choice, cardEl) {
      if (choice?.type !== "evolution" && Array.isArray(choice?.upgrades)) {
        const pickState = this.levelUpPickState || {
          pickCount: 1,
          picksRemaining: 1,
          resolvedPicks: 0,
          effectiveness: [1],
          chosen: []
        };
        const currentPickIndex = Math.max(
          0,
          Math.min(Number(pickState.pickCount || 1) - 1, Number(pickState.resolvedPicks || 0))
        );
        const effectiveness = Number(pickState.effectiveness?.[currentPickIndex] ?? 1) || 1;
        for (const upgrade of choice.upgrades) {
          const appliedUpgrade = { ...upgrade };
          if (Number.isFinite(Number(appliedUpgrade.value))) {
            appliedUpgrade.value = Math.round(Number(appliedUpgrade.value) * effectiveness * 10000) / 10000;
          }
          this.runAttackUpgrades = this.runAttackUpgrades || [];
          this.runAttackUpgrades.push(appliedUpgrade);
          this.addUpgradeOnlyStatsFromLevelUpUpgrade(appliedUpgrade);
        }
        if (choice.penalty) {
          this.runAttackPenalties = this.runAttackPenalties || [];
          this.runAttackPenalties.push({ ...choice.penalty });
        }
        pickState.resolvedPicks = Math.max(0, Number(pickState.resolvedPicks || 0)) + 1;
        pickState.picksRemaining = Math.max(0, Number(pickState.picksRemaining || 0) - 1);
        pickState.chosen = Array.isArray(pickState.chosen) ? pickState.chosen : [];
        pickState.chosen.push({
          name: choice.upgrades?.[0]?.name || "Upgrade",
          scale: effectiveness
        });
        this.levelUpPickState = pickState;
        this.refreshAscendedGrowthRuntimeState();
        if (pickState.picksRemaining <= 0) {
          this.levelUpPickState = null;
          this.refreshAscendedGrowthRuntimeState();
        }
        this.finalizeLevelUpState();
        return;
      }

      if (choice?.type === "elementalShotEvolution") {
        const cat = choice.category;
        if (!["damage", "rhythm", "control", "elemental"].includes(cat)) return;
        if (choice.stage === "first") {
          this.elementalShotEvolutionFirst = cat;
          this.elementalShotEvolutionSecond = null;
        } else if (choice.stage === "second") {
          this.elementalShotEvolutionSecond = cat;
        } else {
          return;
        }
        // Re-sync immediate combat state from profile.
        this._elementalShotSurgeSynced = false;
        const profile = getElementalShotProfile(getElementalShotEvolutionState(this));
        if (this.time >= (this.elementalSurgeEndTime || 0)) {
          this.elementalState = profile?.defaultElement ?? "fire";
        }
        const sb = profile?.surgeBehavior?.elements;
        if (Array.isArray(sb) && sb[0]) this.nextElementalSurge = sb[0];

        if (cardEl) cardEl.classList.add("level-up-card-selected");
        setTimeout(() => {
          closeLevelUpOverlay(this);
          this.finalizeLevelUpState();
          this.checkLevelUp();
        }, cardEl ? 220 : 0);
        return;
      }

      if (choice?.type === "soulSiphonEvolution") {
        const cat = choice.category;
        if (!["damage", "rhythm", "control", "spiritcraft"].includes(cat)) return;
        if (choice.stage === "first") {
          this.soulSiphonEvolutionFirst = cat;
          this.soulSiphonEvolutionSecond = null;
        } else if (choice.stage === "second") {
          this.soulSiphonEvolutionSecond = cat;
        } else {
          return;
        }
        if (cardEl) cardEl.classList.add("level-up-card-selected");
        setTimeout(() => {
          closeLevelUpOverlay(this);
          this.finalizeLevelUpState();
          this.checkLevelUp();
        }, cardEl ? 220 : 0);
        return;
      }

      if (choice?.type !== "evolution" || !choice.evolutionId) return;
      this.applyTransformChoice({
        baseWeaponId: choice.baseWeaponId || this.levelUpChoiceContext?.baseWeaponId || PROJECTILE_BASE_WEAPON_ID,
        evolutionId: choice.evolutionId
      });

      if (cardEl) {
        cardEl.classList.add("level-up-card-selected");
      }

      setTimeout(() => {
        closeLevelUpOverlay(this);
        this.finalizeLevelUpState();
        this.checkLevelUp();
      }, cardEl ? 220 : 0);
    }
  });
}
