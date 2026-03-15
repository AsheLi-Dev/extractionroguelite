// -------- Hall of Champions --------

import { escapeHtml } from '../utils.js';
import { loadSavedCharacters, SAVE_KEY, updateSavedCharacter } from './save-system.js';
import {
  META_ATTRIBUTES,
  getDefaultAttributes,
  getAttributePointsForLevel,
  getAvailableAttributePoints
} from '../data/character-attributes.js';
import { openTalentTree } from './talent-tree-ui.js';

export function renderHallOfChampions() {
  const container = document.getElementById("hall-of-champions");
  if (!container) return;
  const saved = loadSavedCharacters();
  container.innerHTML = "";
  if (saved.length === 0) {
    const p = document.createElement("p");
    p.className = "hall-empty";
    p.textContent = "No champions yet. Extract after defeating the boss to save your character!";
    container.appendChild(p);
    return;
  }
  for (let i = 0; i < saved.length; i++) {
    const char = saved[i];
    const card = buildChampionCard(char, i);
    container.appendChild(card);
  }
}

function normalizeAttributes(char) {
  const def = getDefaultAttributes();
  if (!char.attributes || typeof char.attributes !== "object") return { ...def };
  return {
    brutality: Number(char.attributes.brutality) || 0,
    agility: Number(char.attributes.agility) || 0,
    vitality: Number(char.attributes.vitality) || 0,
    luck: Number(char.attributes.luck) || 0
  };
}

function buildChampionCard(char, index) {
  const card = document.createElement("div");
  card.className = "champion-card";
  card.dataset.charIndex = String(index);

  const stats = char.stats || {};
  const level = char.level || 1;
  const diff = char.difficulty || 1;
  const attrs = normalizeAttributes(char);
  const pointsTotal = getAttributePointsForLevel(level);
  const pointsAvailable = getAvailableAttributePoints({ ...char, attributes: attrs });

  const attrLine = META_ATTRIBUTES.map(
    (a) => `${a.name}: ${attrs[a.id]}`
  ).join(" \u00b7 ");
  const pointsLine = `Attribute points: ${pointsAvailable} of ${pointsTotal} to allocate`;
  const wounds = Math.max(0, Number(char.wounds) || 0);
  const woundsLine = char.dead
    ? "Dead"
    : wounds > 0
      ? `${wounds} Wound${wounds !== 1 ? "s" : ""}`
      : "";
  const woundsClass = "champion-wounds" + (char.dead ? " champion-wounds-dead" : "");

  card.innerHTML = `
    <div class="champion-card-content">
      <div class="champion-name">${escapeHtml(char.name)} <span class="champion-level">Lv.${level}</span> <span class="champion-difficulty">Diff.${diff}</span></div>
      <div class="champion-stats">HP: ${stats.maxHealth || "?"} | Def: ${stats.defense || 0} | Spd: ${stats.speed || "?"} | Atk: ${stats.attack || "?"}</div>
      ${woundsLine ? `<div class="${woundsClass}">${escapeHtml(woundsLine)}</div>` : ""}
      <div class="champion-attributes">${escapeHtml(attrLine)}</div>
      <div class="champion-attribute-points">${escapeHtml(pointsLine)}</div>
      <div class="champion-equipment">
        ${formatEquipment(char.equipment)}
      </div>
      <div class="champion-cards">
        ${formatCards(char.activeUpgradeCards || [])}
      </div>
      <div class="champion-card-actions">
        <button type="button" class="champion-talent-tree-btn" aria-label="Open talent tree">Talent Tree</button>
        <button type="button" class="champion-allocate-btn" aria-label="Allocate attributes">Allocate Attributes</button>
        <button type="button" class="champion-delete-btn" aria-label="Delete character">Delete</button>
      </div>
    </div>
    <div class="champion-allocate-panel hidden" id="champion-allocate-panel-${index}">
      <div class="champion-allocate-available">Available: <span class="champion-allocate-available-num">${pointsAvailable}</span></div>
      <div class="champion-allocate-stats"></div>
      <div class="champion-allocate-panel-actions">
        <button type="button" class="champion-allocate-save-btn">Save</button>
      </div>
    </div>
  `;

  const deleteBtn = card.querySelector(".champion-delete-btn");
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteCharacter(index);
  });

  const talentTreeBtn = card.querySelector(".champion-talent-tree-btn");
  if (talentTreeBtn) {
    talentTreeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTalentTree();
    });
  }

  const allocateBtn = card.querySelector(".champion-allocate-btn");
  const panel = card.querySelector(".champion-allocate-panel");
  allocateBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !panel.classList.contains("hidden");
    document.querySelectorAll(".champion-allocate-panel").forEach((p) => p.classList.add("hidden"));
    if (!isOpen) {
      panel.classList.remove("hidden");
      const saved = loadSavedCharacters();
      const currentChar = saved[index] != null ? saved[index] : { ...char, attributes: attrs };
      renderAllocatePanel(panel, index, currentChar);
    }
  });

  return card;
}

function renderAllocatePanel(panel, charIndex, char) {
  const attrs = normalizeAttributes(char);
  const level = char.level || 1;
  const pointsTotal = getAttributePointsForLevel(level);
  const totalAllocated = Object.values(attrs).reduce((s, n) => s + n, 0);
  let pointsAvailable = pointsTotal - totalAllocated;

  const availableNumEl = panel.querySelector(".champion-allocate-available-num");
  const statsContainer = panel.querySelector(".champion-allocate-stats");
  statsContainer.innerHTML = "";
  const rowUpdateCallbacks = [];

  function getAvailable() {
    const total = Object.values(attrs).reduce((s, n) => s + n, 0);
    return Math.max(0, pointsTotal - total);
  }

  function updateAvailable() {
    pointsAvailable = getAvailable();
    if (availableNumEl) availableNumEl.textContent = pointsAvailable;
    rowUpdateCallbacks.forEach((cb) => cb());
  }

  function saveAndRefresh() {
    updateSavedCharacter(charIndex, { attributes: { ...attrs } });
    pointsAvailable = getAvailable();
    if (availableNumEl) availableNumEl.textContent = pointsAvailable;
    rowUpdateCallbacks.forEach((cb) => cb());
    const card = panel.closest(".champion-card");
    if (card) {
      const idx = parseInt(card.dataset.charIndex, 10);
      const saved = loadSavedCharacters();
      const updatedChar = saved[idx];
      if (updatedChar) {
        const attrLine = META_ATTRIBUTES.map((a) => `${a.name}: ${attrs[a.id]}`).join(" \u00b7 ");
        const pointsLine = `Attribute points: ${pointsAvailable} of ${pointsTotal} to allocate`;
        const attrEl = card.querySelector(".champion-attributes");
        const pointsEl = card.querySelector(".champion-attribute-points");
        if (attrEl) attrEl.textContent = attrLine;
        if (pointsEl) pointsEl.textContent = pointsLine;
      }
    }
  }

  for (const meta of META_ATTRIBUTES) {
    const row = document.createElement("div");
    row.className = "champion-allocate-row";
    const value = attrs[meta.id] || 0;
    row.innerHTML = `
      <span class="champion-allocate-label">${escapeHtml(meta.name)}</span>
      <div class="champion-allocate-controls">
        <button type="button" class="champion-allocate-minus" data-attr="${meta.id}" aria-label="Decrease ${meta.name}">−</button>
        <span class="champion-allocate-value">${value}</span>
        <button type="button" class="champion-allocate-plus" data-attr="${meta.id}" aria-label="Increase ${meta.name}">+</button>
      </div>
    `;
    const minusBtn = row.querySelector(".champion-allocate-minus");
    const plusBtn = row.querySelector(".champion-allocate-plus");
    const valueEl = row.querySelector(".champion-allocate-value");

    function updateButtons() {
      const avail = getAvailable();
      plusBtn.disabled = avail <= 0;
      minusBtn.disabled = (attrs[meta.id] || 0) <= 0;
    }
    rowUpdateCallbacks.push(updateButtons);
    updateButtons();

    minusBtn.addEventListener("click", () => {
      if (attrs[meta.id] > 0) {
        attrs[meta.id]--;
        valueEl.textContent = attrs[meta.id];
        saveAndRefresh();
      }
    });
    plusBtn.addEventListener("click", () => {
      if (getAvailable() > 0) {
        attrs[meta.id]++;
        valueEl.textContent = attrs[meta.id];
        saveAndRefresh();
      }
    });

    statsContainer.appendChild(row);
  }
  if (availableNumEl) availableNumEl.textContent = pointsAvailable;

  const saveBtn = panel.querySelector(".champion-allocate-save-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => saveAndRefresh());
  }
}

function deleteCharacter(index) {
  if (!confirm("Are you sure you want to delete this character? This cannot be undone.")) return;
  const saved = loadSavedCharacters();
  saved.splice(index, 1);
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  renderHallOfChampions();
}

function formatEquipment(equipment) {
  if (!equipment) return "\u2014";
  const parts = [];
  for (const [slot, item] of Object.entries(equipment)) {
    parts.push(`${slot}: ${item ? item.name : "None"}`);
  }
  return parts.join(" \u00b7 ");
}

function formatCards(cards) {
  if (!cards || cards.length === 0) return "No cards";
  return cards.map((c) => c.name).join(", ");
}
