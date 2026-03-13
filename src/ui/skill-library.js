// -------- Skill Library UI --------

import { escapeHtml } from '../utils.js';
import { SKILL_DEFS, MODIFICATION_CARD_DEFS, MODIFICATION_CARD_CATEGORIES } from '../data/skills.js';
import {
  getXpForSkillLevel, getSkillLevels, getSkillLevel, getSkillXp,
  SKILL_MAX_LEVEL, getModSlotsForSkillLevel,
  getSkillModSockets, setSkillModSockets,
  getSelectedRunSkills, setSelectedRunSkills,
  getAvailableSkillSlots,
} from '../data/constants.js';
const SKILL_SLOT_UNLOCK = { 1: 0, 2: 1, 3: 3, 4: 5 };

let skillLibraryPickerTarget = null;
let selectedRunSlot = -1;

function isHubActive() {
  return document.body.classList.contains("home-base-active");
}

const BUILD_PATHS = [
  {
    name: "Storm Gunner",
    fantasy: "Proc engine that chains free casts off kills.",
    skills: ["rapidFire", "lightningBolt", "stormCall", "thunderAura"],
    cards: ["onKill", "cooldownCascade", "echo", "chainCast", "volley"],
    pivot: "If you're dying, replace one slot with Heal Pulse + Lifesteal."
  },
  {
    name: "Siege Caster",
    fantasy: "Slow, deliberate burst windows for elites and bosses.",
    skills: ["meteor", "lightningSpear", "voidRift", "earthquake"],
    cards: ["charged", "amplify", "void", "shock"],
    pivot: "If setup feels unsafe, add Chill or Barrier Aura."
  },
  {
    name: "Plague Controller",
    fantasy: "Damage-over-time and space denial through slows/pulls.",
    skills: ["fireball", "iceRain", "voidRift", "flameAura"],
    cards: ["ignite", "toxic", "chill", "homing", "orbiting"],
    pivot: "If clear speed lags, socket Cooldown Cascade."
  },
  {
    name: "Blade Dancer",
    fantasy: "Aggressive melee momentum with mobility and sustain.",
    skills: ["bladeDash", "whirlwind", "groundSlam", "bladeStorm"],
    cards: ["adrenaline", "lifesteal", "empower", "recoil"],
    pivot: "If ranged pressure is too high, swap one slot to Ice Shard + Piercing."
  },
  {
    name: "Ricochet Trickster",
    fantasy: "Map-geometry build with wall bounces and return hits.",
    skills: ["iceShard", "bladeStorm", "fireball"],
    cards: ["bouncing", "boomerang", "rebound", "piercing"],
    pivot: "Add Volley for room clear or Charged for elite burst."
  },
  {
    name: "Juggernaut Monk",
    fantasy: "High-uptime sustain and control over raw speed clears.",
    skills: ["barrierAura", "frostAura", "healPulse", "shieldBash"],
    cards: ["lifesteal", "chill", "shock", "cooldownCascade"],
    pivot: "If damage is too low, swap Shield Bash to Lightning Bolt."
  }
];

export function openSkillLibrary() {
  renderSkillLibrary();
  const overlay = document.getElementById("skill-library-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

export function closeSkillLibrary() {
  const overlay = document.getElementById("skill-library-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  if (isHubActive()) {
    if (mainMenu) mainMenu.classList.add("hidden");
    document.querySelector(".game-root")?.classList.remove("hidden");
  } else if (mainMenu) {
    mainMenu.classList.remove("hidden");
  }
}

export function openInstructions() {
  const overlay = document.getElementById("instructions-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
}

export function closeInstructions() {
  const overlay = document.getElementById("instructions-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) mainMenu.classList.remove("hidden");
}

function renderSkillLibrarySlotsPanel() {
  const slotsEl = document.getElementById("skill-library-slots");
  if (!slotsEl) return;
  const availableSlots = getAvailableSkillSlots();
  const selectedSkills = getSelectedRunSkills();
  slotsEl.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const div = document.createElement("div");
    const locked = i >= availableSlots;
    div.className = "skill-library-slot" + (selectedSkills[i] ? " filled" : "") + (selectedRunSlot === i ? " selected" : "") + (locked ? " locked" : "");
    div.dataset.runSlot = String(i);
    const skillId = selectedSkills[i];
    const skillDef = skillId ? SKILL_DEFS.find((s) => s.id === skillId) : null;
    const iconContent = skillDef && skillDef.illustration
      ? `<img class="skill-library-slot-illustration" src="${escapeHtml(skillDef.illustration)}" alt="">`
      : skillDef ? `<span style="font-size:20px">${skillDef.icon}</span>` : null;
    div.innerHTML = locked
      ? `<span style="font-size:16px">\ud83d\udd12</span><span style="font-size:9px">Diff ${SKILL_SLOT_UNLOCK[i + 1]}</span>`
      : skillDef ? `${iconContent}<span class="skill-library-slot-name">${escapeHtml(skillDef.name)}</span>` : `<span style="font-size:10px;color:#64748b">${i + 1}</span>`;
    if (!locked) {
      div.addEventListener("click", () => {
        selectedRunSlot = selectedRunSlot === i ? -1 : i;
        renderSkillLibrary();
      });
    }
    slotsEl.appendChild(div);
  }
}

function renderSkillLibraryCardsPanel() {
  const titleEl = document.getElementById("skill-library-cards-title");
  const listEl = document.getElementById("skill-library-cards-list");
  if (!titleEl || !listEl) return;

  const target = skillLibraryPickerTarget;

  if (target) {
    const def = SKILL_DEFS.find((s) => s.id === target.skillId);
    const skillName = def ? def.name : target.skillId;
    titleEl.textContent = `Choose card to socket \u2192 ${escapeHtml(skillName)} (slot ${target.slotIndex + 1})`;
  } else {
    titleEl.textContent = "Modification cards \u2014 click a + slot on a skill to socket";
  }

  listEl.innerHTML = "";
  
  // Get currently equipped cards for the target skill (to prevent duplicates)
  let equippedCardIds = new Set();
  if (target) {
    const socketsData = getSkillModSockets();
    const slotCards = socketsData[target.skillId] || [];
    // Get all equipped cards except the one in the current slot (since we're replacing it)
    slotCards.forEach((cardId, idx) => {
      if (cardId !== null && idx !== target.slotIndex) {
        equippedCardIds.add(cardId);
      }
    });
  }
  
  // Group cards by category
  const cardsByCategory = {};
  MODIFICATION_CARD_DEFS.forEach((cardDef) => {
    const category = cardDef.category || "other";
    if (!cardsByCategory[category]) {
      cardsByCategory[category] = [];
    }
    cardsByCategory[category].push(cardDef);
  });
  
  // Define category order
  const categoryOrder = ["delivery", "trigger", "element", "self"];
  
  // Render cards grouped by category
  categoryOrder.forEach((categoryKey) => {
    const cards = cardsByCategory[categoryKey];
    if (!cards || cards.length === 0) return;
    
    const categoryName = MODIFICATION_CARD_CATEGORIES[categoryKey] || categoryKey;
    const cardCount = cards.length;
    
    // Create category header
    const categoryHeader = document.createElement("div");
    categoryHeader.className = "skill-library-category-header";
    categoryHeader.textContent = `${categoryName} (${cardCount} card${cardCount !== 1 ? "s" : ""})`;
    listEl.appendChild(categoryHeader);
    
    // Create category container
    const categoryContainer = document.createElement("div");
    categoryContainer.className = "skill-library-category-group";
    listEl.appendChild(categoryContainer);
    
    // Render cards in this category
    cards.forEach((cardDef) => {
      if (target) {
        const isAlreadyEquipped = equippedCardIds.has(cardDef.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "skill-library-picker-btn";
        if (isAlreadyEquipped) {
          btn.classList.add("skill-library-picker-btn-disabled");
          btn.disabled = true;
        }
        btn.textContent = cardDef.name;
        btn.title = isAlreadyEquipped 
          ? `${cardDef.desc} (Already equipped on this skill)` 
          : cardDef.desc;
        btn.addEventListener("click", () => {
          // Double-check to prevent duplicates
          if (isAlreadyEquipped) return;
          
          const socketsData = getSkillModSockets();
          if (!socketsData[target.skillId]) socketsData[target.skillId] = [];
          const slotCards = socketsData[target.skillId];
          // Check again if this card is already equipped in another slot
          const alreadyEquipped = slotCards.some((cardId, idx) => 
            cardId === cardDef.id && idx !== target.slotIndex
          );
          if (alreadyEquipped) return;
          
          // No need to remove from inventory - cards are infinite
          while (slotCards.length <= target.slotIndex) slotCards.push(null);
          slotCards[target.slotIndex] = cardDef.id;
          setSkillModSockets(socketsData);
          skillLibraryPickerTarget = null;
          renderSkillLibrary();
        });
        categoryContainer.appendChild(btn);
      } else {
        const span = document.createElement("span");
        span.className = "skill-library-picker-btn";
        span.style.pointerEvents = "none";
        span.textContent = cardDef.name;
        span.title = cardDef.desc;
        categoryContainer.appendChild(span);
      }
    });
  });
}

function getSkillNameById(id) {
  const def = SKILL_DEFS.find((s) => s.id === id);
  return def ? def.name : id;
}

function getCardNameById(id) {
  const def = MODIFICATION_CARD_DEFS.find((c) => c.id === id);
  return def ? def.name : id;
}

function renderSkillLibraryBuildPathsPanel() {
  const el = document.getElementById("skill-library-build-paths");
  if (!el) return;

  const html = BUILD_PATHS.map((path) => {
    const skills = path.skills.map((id) => escapeHtml(getSkillNameById(id))).join(", ");
    const cards = path.cards.map((id) => escapeHtml(getCardNameById(id))).join(", ");
    return `<article class="skill-library-build-card">
      <h3 class="skill-library-build-name">${escapeHtml(path.name)}</h3>
      <p class="skill-library-build-fantasy">${escapeHtml(path.fantasy)}</p>
      <p class="skill-library-build-line"><strong>Core Skills:</strong> ${skills}</p>
      <p class="skill-library-build-line"><strong>Core Cards:</strong> ${cards}</p>
      <p class="skill-library-build-pivot"><strong>Pivot:</strong> ${escapeHtml(path.pivot)}</p>
    </article>`;
  }).join("");

  el.innerHTML = `<h2 class="skill-library-build-title">Build Paths</h2>${html}`;
}

export function renderSkillLibrary() {
  renderSkillLibrarySlotsPanel();
  const skillsPanel = document.getElementById("skill-library-skills-panel");
  if (!skillsPanel) return;

  const levels = getSkillLevels();
  const sockets = getSkillModSockets();
  const skillIds = SKILL_DEFS.map((s) => s.id);

  let html = '<div class="skill-library-list">';
  for (const skillId of skillIds) {
    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (!def) continue;
    const level = getSkillLevel(skillId);
    const xp = getSkillXp(skillId);
    const xpForCurrent = getXpForSkillLevel(level);
    const xpForNext = getXpForSkillLevel(level + 1);
    const xpInLevel = level >= SKILL_MAX_LEVEL ? 0 : xp - xpForCurrent;
    const xpNeeded = level >= SKILL_MAX_LEVEL ? 1 : xpForNext - xpForCurrent;
    const pct = level >= SKILL_MAX_LEVEL ? 1 : xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 0;

    const maxSlots = getModSlotsForSkillLevel(level);
    let slotCards = sockets[skillId];
    if (!Array.isArray(slotCards)) slotCards = [];
    while (slotCards.length < maxSlots) slotCards.push(null);
    slotCards = slotCards.slice(0, maxSlots);

      const hasEquippedMods = slotCards.some(card => card !== null);
      const tagsText = Array.isArray(def.tags) && def.tags.length > 0
        ? `Tags: ${def.tags.join("  ")}`
        : "";
      const iconContent = def.illustration
        ? `<img class="skill-library-card-illustration" src="${escapeHtml(def.illustration)}" alt="">`
        : `<span class="skill-library-card-icon">${escapeHtml(def.icon)}</span>`;
      html += `<div class="skill-library-card" data-skill-id="${escapeHtml(skillId)}">
      <div class="skill-library-card-header">
        ${iconContent}
        <span class="skill-library-card-name">${escapeHtml(def.name)}</span>
        <span class="skill-library-card-level">Lv.${level}${level >= SKILL_MAX_LEVEL ? " (max)" : ""}</span>
      </div>
      <div class="skill-library-xp-label">${level >= SKILL_MAX_LEVEL ? "Max level" : `${xpInLevel} / ${xpNeeded} XP`}</div>
      <div class="skill-library-xp-bar"><div class="skill-library-xp-fill" style="width:${Math.round(pct * 100)}%"></div></div>
      ${tagsText ? `<div class="skill-library-card-tags">${escapeHtml(tagsText)}</div>` : ""}
      <div class="skill-library-mods">`;

    for (let i = 0; i < maxSlots; i++) {
      const cardId = slotCards[i];
      const cardDef = cardId ? MODIFICATION_CARD_DEFS.find((c) => c.id === cardId) : null;
      const filled = !!cardId;
      html += `<div class="skill-library-mod-slot ${filled ? "filled" : ""}" data-skill-id="${escapeHtml(skillId)}" data-slot-index="${i}" title="${cardDef ? escapeHtml(cardDef.desc) + " (Click to remove)" : "Click to socket a modification card"}">${cardDef ? escapeHtml(cardDef.name) : "+"}</div>`;
    }
    html += `</div>`;
    if (hasEquippedMods) {
      html += `<button class="skill-library-remove-all-btn" data-skill-id="${escapeHtml(skillId)}" title="Remove all equipped modifications">Remove All</button>`;
    }
    html += `</div>`;
  }
  html += "</div>";
  skillsPanel.innerHTML = html;

  skillsPanel.querySelectorAll(".skill-library-card").forEach((cardEl) => {
    cardEl.addEventListener("click", (e) => {
      if (e.target.closest(".skill-library-mod-slot") || e.target.closest(".skill-library-remove-all-btn")) return;
      if (selectedRunSlot < 0) return;
      const skillId = cardEl.dataset.skillId;
      if (!skillId) return;
      const skills = getSelectedRunSkills();
      if (skills[selectedRunSlot] === skillId) {
        skills[selectedRunSlot] = null;
      } else {
        skills[selectedRunSlot] = skillId;
      }
      setSelectedRunSkills(skills);
      selectedRunSlot = -1;
      renderSkillLibrary();
    });
  });

  skillsPanel.querySelectorAll(".skill-library-mod-slot").forEach((el) => {
    el.addEventListener("click", () => {
      const skillId = el.dataset.skillId;
      const slotIndex = parseInt(el.dataset.slotIndex, 10);
      const socketsData = getSkillModSockets();
      if (!socketsData[skillId]) socketsData[skillId] = [];
      const slotCards = socketsData[skillId];
      const cardId = slotCards[slotIndex];

      if (cardId) {
        // Free removal - no cost or confirmation needed
        // No need to add back to inventory - cards are infinite
        slotCards[slotIndex] = null;
        setSkillModSockets(socketsData);
        renderSkillLibrary();
        return;
      }

      // All cards are available - always show picker
      showSkillLibraryCardPicker(skillId, slotIndex);
    });
  });

  // Add click handlers for "Remove All" buttons
  skillsPanel.querySelectorAll(".skill-library-remove-all-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const skillId = btn.dataset.skillId;
      const socketsData = getSkillModSockets();
      if (!socketsData[skillId]) return;
      
      const slotCards = socketsData[skillId];
      // Remove all equipped modifications (no need to return to inventory - cards are infinite)
      for (let i = 0; i < slotCards.length; i++) {
        slotCards[i] = null;
      }
      setSkillModSockets(socketsData);
      renderSkillLibrary();
    });
  });

  renderSkillLibraryCardsPanel();
  renderSkillLibraryBuildPathsPanel();
}

function showSkillLibraryCardPicker(skillId, slotIndex) {
  skillLibraryPickerTarget = { skillId, slotIndex };
  renderSkillLibraryCardsPanel();
}
