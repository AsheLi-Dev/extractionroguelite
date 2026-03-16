// -------- Game UI Methods Mixin --------
// UI updates, tooltips, notifications
// This module adds methods to Game.prototype when imported

import { getXpForLevel, getAffixDef } from '../entities/enemy.js';
import { SKILL_DEFS, getModsForSkillSlot, getSkillById } from '../data/skills.js';
import { getAvailableSkillSlots, SKILL_SLOT_UNLOCK } from '../data/constants.js';
import { BLESSING_DEFS } from '../data/cubes-data.js';
import { getRingTempBuffs } from './ring-effects.js';
import { getSkillModById } from '../data/skill-mods.js';

export function applyGameUIMixin(Game) {
  Object.assign(Game.prototype, {
    consumeSnack() {
      if (!this.runSnackId) return false;
      const uses = Math.max(0, Number(this.snackUsesRemaining) || 0);
      if (uses <= 0) return false;
      const px = (this.player?.position?.x || 0) + (this.player?.size || 0) / 2;
      const py = (this.player?.position?.y || 0) + (this.player?.size || 0) / 2;
      this.snackUsesRemaining = uses - 1;
      if (this.runSnackId === "bread" && typeof this.healPlayer === "function") {
        const maxHp = Math.max(1, Number(this.currentStats?.maxHealth) || 1);
        this.healPlayer(Math.max(1, Math.round(maxHp * 0.1)));
      } else if (this.runSnackId === "espresso") {
        this.snackEspressoUntil = (this.time || 0) + 10;
        if (typeof this.addFloatingText === "function") {
          this.addFloatingText(px, py, "Espresso!", "skill");
        }
      } else if (this.runSnackId === "herbal_tea") {
        this.snackHerbalTeaUntil = (this.time || 0) + 10;
        if (typeof this.addFloatingText === "function") {
          this.addFloatingText(px, py, "Herbal Tea!", "skill");
        }
      }
      this.updateMapUI();
      return true;
    },

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
      const snackEl = document.getElementById("snack-display");
      if (snackEl) {
        if (this.runSnackId) {
          const label = String(this.runSnackId)
            .split("_")
            .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : "")
            .join(" ");
          const uses = Math.max(0, Number(this.snackUsesRemaining) || 0);
          const isEspressoActive = this.runSnackId === "espresso" && (this.snackEspressoUntil || 0) > this.time;
          const isHerbalTeaActive = this.runSnackId === "herbal_tea" && (this.snackHerbalTeaUntil || 0) > this.time;
          const activeSuffix = isEspressoActive || isHerbalTeaActive ? " [Active]" : "";
          snackEl.textContent = `Snack: ${label} (${uses})${activeSuffix}`;
          snackEl.classList.remove("hidden");
        } else {
          snackEl.textContent = "Snack: None";
          snackEl.classList.add("hidden");
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
      if (this.playerLevelEl) {
        const attributePoints = Math.max(0, Number(this.runAttributePoints) || 0);
        this.playerLevelEl.textContent = attributePoints > 0
          ? `Level ${this.level} | AP ${attributePoints}`
          : `Level ${this.level}`;
      }
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
    },

    showModScreen() {
      if (this.gameOver || this.levelUpChoices) return;
      this.modScreenOpen = true;
      this.paused = true;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Resume";
        this.pauseToggleEl.classList.add("paused");
      }
      const overlay = document.getElementById("mod-screen-overlay");
      if (overlay) overlay.classList.remove("hidden");
      this.renderModScreen();
    },

    hideModScreen() {
      this.modScreenOpen = false;
      this.paused = false;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Pause";
        this.pauseToggleEl.classList.remove("paused");
      }
      const overlay = document.getElementById("mod-screen-overlay");
      if (overlay) overlay.classList.add("hidden");
    },

    renderModScreen() {
      const shardsEl = document.getElementById("mod-screen-shards");
      if (shardsEl) shardsEl.textContent = String(this.runModShardCurrency ?? 0);

      const skillsListEl = document.getElementById("mod-screen-skills-list");
      const packListEl = document.getElementById("mod-screen-pack-list");
      if (!skillsListEl || !packListEl) return;

      skillsListEl.innerHTML = "";
      const selected = this.modScreenSelectedSocket || null;

      for (let slot = 0; slot < 4; slot++) {
        const skillId = this.skills?.[slot];
        const def = skillId ? getSkillById(skillId) : null;
        if (!def) continue;
        const maxSockets = typeof this.getMaxModSocketsForSkill === "function" ? this.getMaxModSocketsForSkill(skillId) : 2;
        const socketMods = (this.runSkillMods && this.runSkillMods[skillId]) || [];
        const row = document.createElement("div");
        row.className = "mod-screen-skill-row";
        row.innerHTML = `<span class="mod-screen-skill-name">${def.name}</span>`;
        const socketsWrap = document.createElement("div");
        socketsWrap.className = "mod-screen-sockets";
        for (let s = 0; s < maxSockets; s++) {
          const modId = socketMods[s] || null;
          const mod = modId ? getSkillModById(modId) : null;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "mod-screen-socket" + (selected && selected.skillId === skillId && selected.socketIndex === s ? " selected" : "");
          btn.title = mod ? `${mod.name} (${mod.rarity})` : "Empty — click to equip";
          btn.textContent = mod ? mod.name.slice(0, 8) : "—";
          btn.dataset.skillId = skillId;
          btn.dataset.socketIndex = String(s);
          btn.addEventListener("click", () => {
            this.modScreenSelectedSocket = { skillId, socketIndex: s };
            this.renderModScreen();
          });
          socketsWrap.appendChild(btn);
        }
        row.appendChild(socketsWrap);
        skillsListEl.appendChild(row);
      }

      packListEl.innerHTML = "";
      const pack = this.runModInventory || [];
      if (selected) {
        const compatible = typeof this.getModsCompatibleWithSkill === "function" ? this.getModsCompatibleWithSkill(selected.skillId) : [];
        const compatibleSet = new Set(compatible);
        const currentModId = (this.runSkillMods && this.runSkillMods[selected.skillId] && this.runSkillMods[selected.skillId][selected.socketIndex]) || null;
        for (const modId of pack) {
          if (!compatibleSet.has(modId)) continue;
          const mod = getSkillModById(modId);
          if (!mod) continue;
          const row = document.createElement("div");
          row.className = "mod-screen-pack-item-row";
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "mod-screen-pack-item";
          btn.textContent = `${mod.name} (${mod.rarity})`;
          btn.title = mod.description || mod.name;
          btn.addEventListener("click", () => {
            if (typeof this.equipModToSkill === "function") {
              this.equipModToSkill(modId, selected.skillId, selected.socketIndex);
              this.renderModScreen();
            }
          });
          const salvageBtn = document.createElement("button");
          salvageBtn.type = "button";
          salvageBtn.className = "mod-screen-salvage-btn";
          salvageBtn.textContent = "Salvage";
          salvageBtn.title = "Convert to Mod Shards";
          salvageBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof this.salvageMod === "function") {
              this.salvageMod(modId);
              this.renderModScreen();
            }
          });
          const rerollBtn = document.createElement("button");
          rerollBtn.type = "button";
          rerollBtn.className = "mod-screen-reroll-btn";
          rerollBtn.textContent = "Reroll";
          rerollBtn.title = "Cost: 2 Mod Shards";
          rerollBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof this.rerollModInPack === "function" && this.rerollModInPack(modId)) {
              this.renderModScreen();
            }
          });
          row.appendChild(btn);
          row.appendChild(salvageBtn);
          row.appendChild(rerollBtn);
          packListEl.appendChild(row);
        }
        if (currentModId) {
          const unequipBtn = document.createElement("button");
          unequipBtn.type = "button";
          unequipBtn.className = "mod-screen-pack-item mod-screen-unequip";
          unequipBtn.textContent = "Unequip socket";
          unequipBtn.addEventListener("click", () => {
            if (typeof this.unequipModFromSkill === "function") {
              this.unequipModFromSkill(selected.skillId, selected.socketIndex);
              this.renderModScreen();
            }
          });
          packListEl.appendChild(unequipBtn);
        }
      } else {
        packListEl.innerHTML = "<p class=\"mod-screen-hint\">Click a skill socket above to equip a mod from your pack. Salvage mods for Mod Shards.</p>";
        for (const modId of pack) {
          const mod = getSkillModById(modId);
          if (!mod) continue;
          const row = document.createElement("div");
          row.className = "mod-screen-pack-item-row";
          const label = document.createElement("span");
          label.className = "mod-screen-pack-row";
          label.textContent = `${mod.name} (${mod.rarity})`;
          const salvageBtn = document.createElement("button");
          salvageBtn.type = "button";
          salvageBtn.className = "mod-screen-salvage-btn";
          salvageBtn.textContent = "Salvage";
          salvageBtn.addEventListener("click", () => {
            if (typeof this.salvageMod === "function") {
              this.salvageMod(modId);
              this.renderModScreen();
            }
          });
          const rerollBtn = document.createElement("button");
          rerollBtn.type = "button";
          rerollBtn.className = "mod-screen-reroll-btn";
          rerollBtn.textContent = "Reroll";
          rerollBtn.title = "Cost: 2 Mod Shards";
          rerollBtn.addEventListener("click", () => {
            if (typeof this.rerollModInPack === "function" && this.rerollModInPack(modId)) {
              this.renderModScreen();
            }
          });
          row.appendChild(label);
          row.appendChild(salvageBtn);
          row.appendChild(rerollBtn);
          packListEl.appendChild(row);
        }
      }
    }
  });
}
