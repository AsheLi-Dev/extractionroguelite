// -------- Game UI Methods Mixin --------
// UI updates, tooltips, notifications
// This module adds methods to Game.prototype when imported

import { getXpForLevel, getAffixDef } from '../entities/enemy.js';
import { SKILL_DEFS, getModsForSkillSlot } from '../data/skills.js';
import { getAvailableSkillSlots, SKILL_SLOT_UNLOCK } from '../data/constants.js';
import { BLESSING_DEFS } from '../data/cubes-data.js';
import { getRingTempBuffs } from './ring-effects.js';

export function applyGameUIMixin(Game) {
  Object.assign(Game.prototype, {
    showNotification(title, message) {
      const overlay = document.getElementById("notification-overlay");
      const titleEl = document.getElementById("notification-title");
      const messageEl = document.getElementById("notification-message");
      const closeBtn = document.getElementById("notification-close");
      
      if (!overlay || !titleEl || !messageEl || !closeBtn) return;
      
      titleEl.textContent = title;
      messageEl.textContent = message;
      overlay.classList.remove("hidden");
      this.paused = true;
      
      const handleClose = () => {
        overlay.classList.add("hidden");
        this.paused = false;
        closeBtn.removeEventListener("click", handleClose);
      };
      
      closeBtn.addEventListener("click", handleClose);
    },

    updateMapUI() {
      if (!this.mapNameEl) return;
      this.mapNameEl.textContent = `${this.currentMap.name} (Map ${this.currentMap.number})`;
      const goldEl = document.getElementById("gold-display");
      if (goldEl) goldEl.textContent = `Gold: ${this.gold ?? 0}`;
      this.updateEnemyCountUI();
      const soulsEl = document.getElementById("souls-display");
      if (soulsEl) {
        const souls = this.runSoulsTotal ?? 0;
        const spirit = this.cuteSpiritCompanion;
        if (souls > 0 || spirit) {
          soulsEl.classList.remove("hidden");
          const chargeThreshold = spirit && spirit.stage >= 3 ? 2 : 3;
          soulsEl.textContent = spirit
            ? `Souls: ${souls} | Spirit S${spirit.stage} Charge: ${spirit.charge}/${chargeThreshold}`
            : `Souls: ${souls}`;
        } else {
          soulsEl.classList.add("hidden");
        }
      }
      this.updateEscortQuestUI();
    },

    updateEscortQuestUI() {
      if (!this.escortQuestIndicatorEl) return;
      if (this.escortQuest?.active) {
        this.escortQuestIndicatorEl.classList.remove("hidden");
      } else {
        this.escortQuestIndicatorEl.classList.add("hidden");
      }
    },

    updateEnemyCountUI() {
      if (!this.enemyCountEl) return;
      const es = this.enemySystem;
      const count = es.enemies.length + (es.boss ? 1 : 0);
      this.enemyCountEl.textContent = `Enemies: ${count}`;
      this.enemyCountEl.classList.toggle("hidden", this.currentMap?.id === 4 && !es.boss);
    },

    updateXpUI() {
      const threshold = getXpForLevel(this.level + 1);
      const prevThreshold = getXpForLevel(this.level);
      const xpInLevel = this.xp - prevThreshold;
      const xpNeeded = threshold - prevThreshold;
      const pct = this.level >= 99 ? 1 : xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 0;

      if (this.xpBarFillEl) this.xpBarFillEl.style.width = `${Math.round(pct * 100)}%`;
      if (this.xpLabelEl) this.xpLabelEl.textContent = this.level >= 99 ? "MAX" : `${Math.floor(xpInLevel)} / ${Math.floor(xpNeeded)} XP`;
      if (this.playerLevelEl) this.playerLevelEl.textContent = `Level ${this.level}`;
    },

    updateBossHealthBar() {
      // Boss health bar is now drawn on canvas, so hide the DOM element
      if (this.bossHealthBarEl) {
        this.bossHealthBarEl.classList.add("hidden");
      }
    },

    updateSkillUI() {
      const keys = ["1", "2", "3", "4"];
      for (let i = 0; i < 4; i++) {
        const iconEl = document.getElementById(`skill-icon-${i}`);
        const nameEl = document.getElementById(`skill-name-${i}`);
        const cdEl = document.getElementById(`skill-cd-${i}`);
        const slotEl = document.querySelector(`.skill-slot[data-slot="${i}"]`);
        if (!slotEl) continue;
        const skillId = this.skills[i];
        const def = skillId ? SKILL_DEFS.find((s) => s.id === skillId) : null;
        // In tutorial mode, unlock all 4 skill slots
        const availableSlots = this.tutorialMode ? 4 : getAvailableSkillSlots();
        if (i >= availableSlots) {
          slotEl.classList.add("locked");
          slotEl.title = "";
          if (iconEl) {
            iconEl.innerHTML = "";
            iconEl.textContent = "LOCK";
          }
          if (nameEl) nameEl.textContent = `Beat Diff ${SKILL_SLOT_UNLOCK[i + 1]}`;
        } else {
          slotEl.classList.remove("locked");
          if (iconEl) {
            iconEl.innerHTML = "";
            if (def?.illustration) {
              const img = document.createElement("img");
              img.className = "skill-slot-icon-img";
              img.src = def.illustration;
              img.alt = `${def.name} icon`;
              iconEl.appendChild(img);
            } else {
              iconEl.textContent = "";
            }
          }
          let nameText = def ? def.name : "Empty";
          const tagsLine = def?.tags?.length ? `Tags: ${def.tags.join("  ")}` : "";
          slotEl.title = def ? `${def.name}\n${def.desc || ""}${tagsLine ? `\n${tagsLine}` : ""}` : "";
          if (def && def.category === "aura" && this.activeAuras.has(skillId)) {
            nameText += ` (ON)`;
            if (def.auraUpkeep) nameText += ` -${(def.auraUpkeep * 100).toFixed(1)}% HP/s`;
          }
          if (nameEl) nameEl.textContent = nameText;
          const empowerStacks = this.empowerStacks?.[i] || 0;
          const cascadeFlash = this.skillCascadeFlashUntil?.[i] != null && this.time < this.skillCascadeFlashUntil[i];
          slotEl.classList.toggle("skill-cascade-flash", !!cascadeFlash);
          const stackEl = slotEl.querySelector(".skill-empower-stacks");
          if (stackEl) {
            stackEl.textContent = empowerStacks > 0 ? String(empowerStacks) : "";
            stackEl.style.display = empowerStacks > 0 ? "block" : "none";
          }
        }
        const isCharging = this.skillChargeSlot === i;
        slotEl.classList.toggle("skill-slot-charging", isCharging);
        const cd = this.skillCooldowns[i] || 0;
        const baseCd = def ? def.baseCd : 1;
        const isAura = def && def.category === "aura";
        let pct = 0;
        if (isCharging && this.skillChargeStartTime != null) {
          const chargeDur = Math.min(2, this.time - this.skillChargeStartTime);
          pct = chargeDur / 2;
          if (cdEl) {
            cdEl.style.background = `conic-gradient(#eab308 0deg, #f59e0b ${pct * 360}deg, transparent ${pct * 360}deg)`;
          }
        } else {
          const mods = getModsForSkillSlot(this, i);
          const effectiveBaseCd = baseCd + (mods.includes("amplify") ? 0.5 : 0);
          pct = !isAura && effectiveBaseCd > 0 ? Math.min(1, cd / (effectiveBaseCd * this.getSkillCooldownMult(skillId))) : 0;
          if (cdEl) {
            cdEl.style.background = pct > 0 ? `conic-gradient(#374151 0deg, #374151 ${pct * 360}deg, transparent ${pct * 360}deg)` : "none";
          }
        }
        slotEl.classList.toggle("aura-active", isAura && this.activeAuras.has(skillId));
      }
    },

    updateHealthBar() {
      const bar = document.getElementById("player-health-fill");
      const label = document.getElementById("player-health-label");
      if (!bar || !label) return;
      const pct = this.currentStats.maxHealth > 0
        ? Math.max(0, this.currentHealth / this.currentStats.maxHealth)
        : 0;
      bar.style.width = `${Math.round(pct * 100)}%`;
      label.textContent = `${Math.round(this.currentHealth)} / ${this.currentStats.maxHealth}`;
      bar.style.backgroundColor =
        pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";

      const shieldWrap = document.getElementById("player-shield-bar-wrap");
      const shieldFill = document.getElementById("player-shield-fill");
      const shield = typeof this.getPlayerShield === "function" ? this.getPlayerShield() : Math.max(0, this.immortalShield || 0);
      if (shieldWrap && shieldFill) {
        if (shield > 0) {
          shieldWrap.classList.remove("hidden");
          const maxShield = Math.max(30, Math.round((this.currentStats?.maxHealth || 100) * 0.3));
          const shieldPct = Math.min(1, shield / maxShield);
          shieldFill.style.width = `${Math.round(shieldPct * 100)}%`;
        } else {
          shieldWrap.classList.add("hidden");
          shieldFill.style.width = "0%";
        }
      }
    },

    updateDashUI() {
      const fill = document.getElementById("dash-cooldown-fill");
      const label = document.getElementById("dash-label");
      if (!fill || !label) return;
      const maxCharges = Math.max(1, this.dashMaxCharges || 2);
      const charges = Math.max(0, Math.min(maxCharges, this.dashCharges ?? maxCharges));
      const partial = charges < maxCharges && this.dashCooldownTime > 0
        ? (1 - Math.max(0, this.dashCooldown) / this.dashCooldownTime)
        : 0;
      const pct = Math.max(0, Math.min(1, (charges + partial) / maxCharges));
      fill.style.width = `${Math.round(pct * 100)}%`;
      label.textContent = charges >= maxCharges
        ? `${charges}/${maxCharges}`
        : `${charges}/${maxCharges} (${Math.round(this.dashCooldown * 10) / 10}s)`;
    },

    updateVictoryPortalUI() {
      const el = document.getElementById("victory-portal-countdown");
      if (!el) return;
      if (this.bossExtractionActive && !this.victoryPortal) {
        el.classList.remove("hidden");
        el.textContent = `Extraction portal in: ${Math.ceil(this.bossExtractionTimeLeft)}s`;
        return;
      }
      if (!this.victoryPortal) {
        el.classList.add("hidden");
        return;
      }
      if (this.playerInVictoryPortal()) {
        el.classList.remove("hidden");
        el.textContent = `Entering portal... ${Math.ceil(this.victoryPortalTimer)}s`;
      } else {
        el.classList.remove("hidden");
        el.textContent = "Portal ready - stand in it to escape";
      }
    },

    updateBlessingsUI() {
      const el = document.getElementById("blessings-bar");
      if (!el) return;
      const active = this.activeBlessings.filter((b) => b.until > this.time);
      const ringBuffs = getRingTempBuffs(this);
      if (active.length === 0 && ringBuffs.length === 0) {
        el.classList.add("hidden");
        return;
      }
      el.classList.remove("hidden");
      el.innerHTML = "";
      for (const b of active) {
        const def = BLESSING_DEFS.find((d) => d.id === b.id);
        if (!def) continue;
        const div = document.createElement("div");
        div.className = "blessing-item";
        div.innerHTML = `<span class="blessing-icon">${def.icon}</span><span class="blessing-name">${def.name}</span>`;
        el.appendChild(div);
      }
      for (const buff of ringBuffs) {
        const div = document.createElement("div");
        div.className = "blessing-item";
        div.innerHTML = `<span class="blessing-icon">${buff.icon}</span><span class="blessing-name">${buff.name}</span>`;
        el.appendChild(div);
      }
    },

    updateAffixTooltip(clientX, clientY) {
      const tt = document.getElementById("affix-tooltip");
      if (!tt || !this.lastMouseWorld || !this.enemySystem) return;
      const viewX = this.lastMouseWorld.x - this.camera.position.x;
      const viewY = this.lastMouseWorld.y - this.camera.position.y;
      let hitEnemy = null;
      for (const enemy of this.enemySystem.enemies) {
        if (enemy.isDead) continue;
        const sx = enemy.position.x - this.camera.position.x;
        const sy = enemy.position.y - this.camera.position.y;
        const pad = 30;
        if (viewX >= sx - 5 && viewX <= sx + enemy.size + 5 &&
            viewY >= sy - pad && viewY <= sy + enemy.size + 5) {
          hitEnemy = enemy;
          break;
        }
      }
      if (hitEnemy && hitEnemy.affixes?.length > 0) {
        const names = hitEnemy.affixes.map((id) => (getAffixDef(id).name)).join(", ");
        tt.textContent = names;
        tt.classList.remove("hidden");
        tt.style.left = (clientX + 12) + "px";
        tt.style.top = (clientY + 12) + "px";
      } else {
        tt.classList.add("hidden");
      }
    },

    hideAffixTooltip() {
      const tt = document.getElementById("affix-tooltip");
      if (tt) tt.classList.add("hidden");
    }
  });
}
