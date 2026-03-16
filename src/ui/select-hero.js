// -------- Select Hero screen (standalone from main menu) --------

import { escapeHtml } from '../utils.js';
import { PLAYABLE_CHARACTERS, getPlayableCharacterOrDefault, DEFAULT_STAT_BASELINE } from '../data/playable-characters.js';
import { getSkillById } from '../data/skills.js';
import { getPendingPlayableCharacterId, setPendingPlayableCharacterId, getSelectedPlayableCharacterIdFromStorage } from './pre-run.js';

let _selectHeroBackTarget = "menu"; // "menu" | "hub"

export function setSelectHeroBackTarget(target) {
  _selectHeroBackTarget = target === "hub" ? "hub" : "menu";
}

export function showSelectHeroScreen(backTarget = "menu") {
  _selectHeroBackTarget = backTarget === "hub" ? "hub" : "menu";
  const overlay = document.getElementById("select-hero-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (_selectHeroBackTarget === "menu" && mainMenu) mainMenu.classList.add("hidden");
  setPendingPlayableCharacterId(getSelectedPlayableCharacterIdFromStorage());
  renderSelectHeroScreen();
}

export function hideSelectHeroScreen() {
  const overlay = document.getElementById("select-hero-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.add("hidden");
  if (_selectHeroBackTarget === "menu" && mainMenu) mainMenu.classList.remove("hidden");
}

export function renderSelectHeroScreen() {
  const currentId = getPendingPlayableCharacterId();

  const heroListEl = document.getElementById("select-hero-list");
  if (heroListEl) {
    heroListEl.innerHTML = "";
    for (const hero of PLAYABLE_CHARACTERS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pre-run-hero-btn" + (currentId === hero.id ? " selected" : "");
      btn.title = hero.description;
      btn.innerHTML = `<span class="pre-run-hero-name">${escapeHtml(hero.name)}</span><span class="pre-run-hero-desc">${escapeHtml(hero.passive?.name || "")} — ${escapeHtml((hero.passive?.description || "").slice(0, 50))}${(hero.passive?.description || "").length > 50 ? "…" : ""}</span>`;
      btn.addEventListener("click", () => {
        setPendingPlayableCharacterId(hero.id);
        renderSelectHeroScreen();
      });
      heroListEl.appendChild(btn);
    }
  }

  const selectedHero = getPlayableCharacterOrDefault(currentId);
  const detailsPanel = document.getElementById("select-hero-details");
  if (detailsPanel && selectedHero) {
    const titleEl = detailsPanel.querySelector(".pre-run-hero-details-title");
    if (titleEl) titleEl.textContent = selectedHero.name;
    const baseline = DEFAULT_STAT_BASELINE;
    const mods = selectedHero.statModifiers || {};
    const statsEl = detailsPanel.querySelector(".pre-run-hero-details-stats");
    if (statsEl) {
      const hp = Math.round((baseline.maxHealth || 100) * (mods.maxHealth ?? 1));
      const def = Math.round((baseline.defense || 0) * (mods.defense ?? 1));
      const spd = Math.round((baseline.speed || 220) * (mods.speed ?? 1));
      const atk = Math.round((baseline.attack || 20) * (mods.attack ?? 1));
      const hazard = (mods.hazardDamageReduction ?? 1) * 100;
      statsEl.innerHTML = `<h4>Stats</h4><ul class="pre-run-hero-stats-list"><li>HP: ${hp}</li><li>Defense: ${def}</li><li>Speed: ${spd}</li><li>Attack: ${atk}</li><li>Hazard reduction: ${hazard}%</li></ul>`;
    }
    const passiveEl = detailsPanel.querySelector(".pre-run-hero-details-passive");
    if (passiveEl) {
      const p = selectedHero.passive;
      if (p) {
        passiveEl.innerHTML = `<h4>Passive</h4><p class="pre-run-hero-passive-name">${escapeHtml(p.name)}</p><p class="pre-run-hero-passive-desc">${escapeHtml(p.description || "")}</p>`;
      } else {
        passiveEl.innerHTML = `<h4>Passive</h4><p class="pre-run-hero-passive-desc">None</p>`;
      }
    }
    const skillsEl = detailsPanel.querySelector(".pre-run-hero-details-skills");
    if (skillsEl) {
      skillsEl.innerHTML = "<h4>Skill</h4>";
      if (selectedHero.uniqueSkill) {
        const skillDef = getSkillById(selectedHero.uniqueSkill.skillId);
        if (skillDef) {
          skillsEl.innerHTML += `<p class="pre-run-hero-skill-name">${escapeHtml(skillDef.name)}</p><p class="pre-run-hero-skill-desc">${escapeHtml(skillDef.desc || "")}</p>`;
        } else {
          skillsEl.innerHTML += `<p class="pre-run-hero-skill-desc">${escapeHtml(selectedHero.uniqueSkill.skillId)}</p>`;
        }
      } else {
        skillsEl.innerHTML += `<p class="pre-run-hero-skill-desc">No unique skill</p>`;
      }
    }
  }
}
