// -------- Hall of Champions --------

import { escapeHtml } from '../utils.js';
import { loadSavedCharacters, SAVE_KEY } from './save-system.js';

export function renderHallOfChampions() {
  const container = document.getElementById("hall-of-champions");
  if (!container) return;
  const saved = loadSavedCharacters();
  container.innerHTML = "";
  if (saved.length === 0) {
    const p = document.createElement("p");
    p.className = "hall-empty";
    p.textContent = "No champions yet. Defeat the boss to save your character!";
    container.appendChild(p);
    return;
  }
  for (let i = 0; i < saved.length; i++) {
    const char = saved[i];
    const card = document.createElement("div");
    card.className = "champion-card";
    const stats = char.stats || {};
    const level = char.level || 1;
    const diff = char.difficulty || 1;
    card.innerHTML = `
      <div class="champion-card-content">
        <div class="champion-name">${escapeHtml(char.name)} <span class="champion-level">Lv.${level}</span> <span class="champion-difficulty">Diff.${diff}</span></div>
        <div class="champion-stats">HP: ${stats.maxHealth || "?"} | Def: ${stats.defense || 0} | Spd: ${stats.speed || "?"} | Atk: ${stats.attack || "?"}</div>
        <div class="champion-equipment">
          ${formatEquipment(char.equipment)}
        </div>
        <div class="champion-cards">
          ${formatCards(char.activeUpgradeCards || [])}
        </div>
      </div>
      <button class="champion-delete-btn" aria-label="Delete character">Delete</button>
    `;
    const deleteBtn = card.querySelector(".champion-delete-btn");
    deleteBtn.addEventListener("click", () => deleteCharacter(i));
    container.appendChild(card);
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
