// -------- Game Level Up Methods Mixin --------
// XP, level up, upgrade choices
// This module adds methods to Game.prototype when imported

import { getXpForLevel } from '../entities/enemy.js';
import { markSkillEncountered, addSkillXp } from '../data/constants.js';
import { hasTalent } from '../data/talents.js';
import { ATTACK_UPGRADE_DEFS, CONTRADICTORY_UPGRADE_PENALTY, getUpgradeDisplayDescription, getPenaltyDisplayDescription, rollUpgradeValue } from '../data/level-up-data.js';
import { getAttackEvolutionsForWeapon, getAttackEvolutionById, getEvolutionUnlockProgress } from '../data/attack-evolutions.js';
import { onRingLevelUp } from './ring-effects.js';

export function applyGameLevelUpMixin(Game) {
  Object.assign(Game.prototype, {
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
    },

    getSelectedAttackEvolution(baseWeaponId) {
      if (!this.weaponEvolutions || !baseWeaponId) return null;
      const evoId = this.weaponEvolutions[baseWeaponId];
      if (!evoId) return null;
      return getAttackEvolutionById(evoId);
    },

    buildTransformCardsForCurrentAttack() {
      if (this.attackType !== "projectile") return [];
      const baseWeaponId = "ProjectileShot";
      const evolutions = getAttackEvolutionsForWeapon(baseWeaponId);
      if (!evolutions.length) return [];

      this.ensureUpgradeOnlyStats();
      this.weaponEvolutions = this.weaponEvolutions || {};
      this.evolutionGroupSelections = this.evolutionGroupSelections || {};
      this.loggedEvolutionAvailability = this.loggedEvolutionAvailability || {};

      const out = [];
      for (const evo of evolutions) {
        if (this.evolutionGroupSelections[evo.groupId]) continue;
        if (this.weaponEvolutions[baseWeaponId] === evo.id) continue;

        const progress = getEvolutionUnlockProgress(evo, this.upgradeOnlyStats);
        if (!progress.unlocked) continue;

        if (!this.loggedEvolutionAvailability[evo.id]) {
          this.loggedEvolutionAvailability[evo.id] = true;
          console.info(`[Evolution] Available: ${evo.id} (unlock ${progress.currentPct.toFixed(1)} / ${progress.requiredPct}%)`);
        }

        const description = `${evo.summary}<br>(${progress.label}: ${progress.currentPct.toFixed(1)} / ${progress.requiredPct}%)`;
        const transformOption = {
          id: evo.transformChoiceId,
          type: "transform",
          name: evo.transformName,
          description,
          icon: evo.icon || null,
          baseWeaponId,
          evolutionId: evo.id,
          evolutionGroupId: evo.groupId
        };
        out.push({
          type: "transform",
          transform: transformOption,
          upgrades: [transformOption],
          penalty: null,
          isUnique: true
        });
      }

      return out;
    },

    applyTransformChoice(transformOption) {
      const baseWeaponId = transformOption?.baseWeaponId;
      const evolutionId = transformOption?.evolutionId;
      if (!baseWeaponId || !evolutionId) return;

      const evoDef = getAttackEvolutionById(evolutionId);
      if (!evoDef) return;

      this.weaponEvolutions = this.weaponEvolutions || {};
      this.evolutionGroupSelections = this.evolutionGroupSelections || {};

      const groupId = evoDef.groupId;
      const alreadyChosen = this.evolutionGroupSelections[groupId];
      if (alreadyChosen && alreadyChosen !== evolutionId) return;

      this.weaponEvolutions[baseWeaponId] = evolutionId;
      this.evolutionGroupSelections[groupId] = evolutionId;
      console.info(`[Evolution] Chosen: ${evolutionId} for ${baseWeaponId}`);
    },

    grantXP(amount) {
      let mult = this.equipmentXpGainedMult ?? 1;
      // Frenzy buff: 20% XP gained
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

    checkLevelUp() {
      if (this.levelUpChoices) return;
      const nextThreshold = getXpForLevel(this.level + 1);
      if (this.xp >= nextThreshold) {
        this.level++;
        this.levelUpRerollsRemaining = typeof this.getPillarLevelUpRerolls === "function"
          ? this.getPillarLevelUpRerolls()
          : 0;
        this.showLevelUpChoices();
      }
    },

    buildLevelUpCards() {
      const defs = ATTACK_UPGRADE_DEFS[this.attackType];
      if (!defs) return [];
      const takenUpgrades = new Set((this.runAttackUpgrades || []).map((u) => u.id));
      const takenPenalties = new Set((this.runAttackPenalties || []).map((p) => p.id));

      const pickUniquePenalty = (excludeIds = []) => {
        const pool = (defs.uniquePenalties || []).filter(
          (p) => !takenPenalties.has(p.id) && !excludeIds.includes(p.id)
        );
        if (pool.length === 0) return null;
        const def = pool[Math.floor(Math.random() * pool.length)];
        return { id: def.id, name: def.name, description: def.description, value: undefined };
      };

      const cards = [];
      const usedInOfferUp = new Set();
      const usedInOfferPen = new Set();
      for (let i = 0; i < 2; i++) {
        const upgrades = [];
        for (let j = 0; j < 2; j++) {
          const poolUp = (defs.standardUpgrades || []).filter((u) => !usedInOfferUp.has(u.id));
          if (poolUp.length === 0) break;
          const defUp = poolUp[Math.floor(Math.random() * poolUp.length)];
          const upgrade = { id: defUp.id, name: defUp.name, description: defUp.description, value: rollUpgradeValue(defUp), percent: !!defUp.valueRange?.percent };
          upgrades.push(upgrade);
          usedInOfferUp.add(upgrade.id);
        }
        const poolPen = (defs.standardPenalties || []).filter((p) => !usedInOfferPen.has(p.id));
        if (upgrades.length < 2 || poolPen.length === 0) break;
        const defPen = poolPen[Math.floor(Math.random() * poolPen.length)];
        const penalty = { id: defPen.id, name: defPen.name, description: defPen.description, value: rollUpgradeValue(defPen), percent: !!defPen.valueRange?.percent };
        cards.push({ upgrades, penalty, isUnique: false });
        usedInOfferPen.add(penalty.id);
      }

      const uUpgrades = [];
      const showUniqueCard = this.level === 5 || this.level === 10;
      if (showUniqueCard) {
        const usedUniqueUp = new Set();
        for (let j = 0; j < 1; j++) {
          const poolU = (defs.uniqueUpgrades || []).filter((u) => !takenUpgrades.has(u.id) && !usedUniqueUp.has(u.id));
          if (poolU.length === 0) break;
          const defU = poolU[Math.floor(Math.random() * poolU.length)];
          uUpgrades.push({ id: defU.id, name: defU.name, description: defU.description, value: undefined });
          usedUniqueUp.add(defU.id);
        }
        let blockedPenalties = [];
        for (const u of uUpgrades) {
          blockedPenalties = blockedPenalties.concat(CONTRADICTORY_UPGRADE_PENALTY[u.id] || []);
        }
        const uPen = pickUniquePenalty(blockedPenalties);
        if (uUpgrades.length === 1 && uPen) {
          cards.push({ upgrades: uUpgrades, penalty: uPen, isUnique: true });
        }
      }

      const poolUpOnly = (defs.standardUpgrades || []).filter((u) => !usedInOfferUp.has(u.id));
      if (poolUpOnly.length > 0) {
        const defUp = poolUpOnly[Math.floor(Math.random() * poolUpOnly.length)];
        const upgrade = { id: defUp.id, name: defUp.name, description: defUp.description, value: rollUpgradeValue(defUp), percent: !!defUp.valueRange?.percent };
        cards.push({ upgrades: [upgrade], penalty: null, isUnique: false });
      }

      const transformCards = this.buildTransformCardsForCurrentAttack();
      if (transformCards.length > 0) {
        const maxCardsInOffer = 3;
        const keptNonTransform = cards.slice(0, Math.max(0, maxCardsInOffer - transformCards.length));
        const shownTransforms = transformCards.slice(0, maxCardsInOffer);
        return keptNonTransform.concat(shownTransforms);
      }

      return cards;
    },

    showLevelUpChoices() {
      this.levelUpChoices = this.buildLevelUpCards();
      if (!this.levelUpChoices || this.levelUpChoices.length === 0) {
        this.levelUpChoices = null;
        return;
      }
      
      const overlay = document.getElementById("level-up-overlay");
      const choicesEl = document.getElementById("level-up-choices");
      const rerollBtn = document.getElementById("level-up-reroll");
      if (!overlay || !choicesEl) return;

      choicesEl.innerHTML = "";
      for (const card of this.levelUpChoices) {
        const btn = document.createElement("button");
        btn.className = "level-up-card" + (card.isUnique ? " level-up-card-unique" : "");
        const star = card.isUnique ? '<span class="level-up-card-star">spr_ui_star</span>' : "";
        const upgradeBlocks = (card.upgrades || []).map(
          (u, idx) => `<div class="level-up-card-upgrade">${idx === 0 ? star : ""}<strong>${u.name}</strong><br><span class="level-up-card-desc">${getUpgradeDisplayDescription(u)}</span></div>`
        ).join("");
        const penaltyBlock = card.penalty
          ? `<div class="level-up-card-divider"></div><div class="level-up-card-penalty"><strong>${card.penalty.name}</strong><br><span class="level-up-card-desc">${getPenaltyDisplayDescription(card.penalty)}</span></div>`
          : `<div class="level-up-card-no-penalty">No penalty</div>`;
        btn.innerHTML = `<div class="level-up-card-inner">${upgradeBlocks}${penaltyBlock}</div>`;
        btn.addEventListener("click", () => this.applyLevelUpChoice(card, btn));
        choicesEl.appendChild(btn);
      }
      if (rerollBtn) {
        const pillarRerollsLeft = Math.max(0, Number(this.levelUpRerollsRemaining) || 0);
        const canUseWildCard = hasTalent("wildCard") && !this.wildCardRerollUsed;
        const canReroll = canUseWildCard || pillarRerollsLeft > 0;
        rerollBtn.classList.toggle("hidden", !canReroll);
        if (canReroll) {
          rerollBtn.textContent = pillarRerollsLeft > 0
            ? `Reroll (${pillarRerollsLeft} left)`
            : "Reroll (Wild Card)";
        }
        rerollBtn.onclick = canReroll ? () => {
          if ((this.levelUpRerollsRemaining || 0) > 0) {
            this.levelUpRerollsRemaining = Math.max(0, this.levelUpRerollsRemaining - 1);
          } else {
            this.wildCardRerollUsed = true;
          }
          this.showLevelUpChoices();
        } : null;
      }
      overlay.classList.remove("hidden");
      const buildLogPanel = document.getElementById("build-log-panel");
      if (buildLogPanel) {
        buildLogPanel.classList.remove("hidden");
        if (this.buildLogRefresh) this.buildLogRefresh();
      }
      this.paused = true;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Resume";
        this.pauseToggleEl.classList.add("paused");
      }
    },

    applyLevelUpChoice(card, cardEl) {
      if (card?.type === "transform" && card.transform) {
        this.applyTransformChoice(card.transform);
      } else {
        for (const u of (card.upgrades || [])) {
          this.runAttackUpgrades.push(u);
          this.addUpgradeOnlyStatsFromLevelUpUpgrade(u);
        }
        if (card.penalty) this.runAttackPenalties.push(card.penalty);
      }
      onRingLevelUp(this);
      this.levelUpChoices = null;
      
      if (cardEl) {
        cardEl.classList.add("level-up-card-selected");
        setTimeout(() => {
          const overlay = document.getElementById("level-up-overlay");
          if (overlay) overlay.classList.add("hidden");
          this.paused = false;
          if (this.pauseToggleEl) {
            this.pauseToggleEl.textContent = "Pause";
            this.pauseToggleEl.classList.remove("paused");
          }
          this.recalculateStats();
          this.updateXpUI();
          this.checkLevelUp();
          if (this.buildLogRefresh) this.buildLogRefresh();
        }, 320);
      } else {
        const overlay = document.getElementById("level-up-overlay");
        if (overlay) overlay.classList.add("hidden");
        this.paused = false;
        if (this.pauseToggleEl) {
          this.pauseToggleEl.textContent = "Pause";
          this.pauseToggleEl.classList.remove("paused");
        }
        this.recalculateStats();
        this.updateXpUI();
        this.checkLevelUp();
        if (this.buildLogRefresh) this.buildLogRefresh();
      }
    }
  });
}
