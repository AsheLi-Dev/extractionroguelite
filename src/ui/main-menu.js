// -------- Main Menu helpers --------

import { DEMO_BUILD, DEMO_VERSION_LABEL } from "../data/constants.js";
import { loadGlobalPlayerProfile, restoreEternalItemsFromDefeat, saveGlobalPlayerProfile } from './save-system.js';

const DEMO_MAIN_MENU_HIDE_IDS = [
  "main-menu-select-hero",
  "main-menu-tutorial",
  "main-menu-instructions",
  "main-menu-options",
  "main-menu-pillars",
  "main-menu-friends",
  "main-menu-return-hub"
];

/**
 * Demo builds: only New Game, Legacy Vault, Talents, Weapon Arts, Skill Library + Demo version label.
 */
export function applyDemoMainMenuLayout() {
  if (!DEMO_BUILD) return;
  const inner = document.querySelector("#main-menu .main-menu-inner");
  const root = document.getElementById("main-menu");
  if (inner) inner.classList.add("main-menu-inner--demo");
  if (root) root.classList.add("main-menu--demo");

  const badge = document.getElementById("main-menu-demo-badge");
  if (badge) {
    badge.textContent = DEMO_VERSION_LABEL;
    badge.classList.remove("hidden");
    badge.setAttribute("aria-hidden", "false");
  }

  for (const id of DEMO_MAIN_MENU_HIDE_IDS) {
    document.getElementById(id)?.classList.add("hidden");
  }

  const weaponArts = document.getElementById("main-menu-basic-attack-tree");
  if (weaponArts) weaponArts.textContent = "Weapon Arts";
}

const RESOLUTION_STORAGE_KEY = "game_resolution_preset";
const RESOLUTION_PRESETS = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "2k": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 }
};

export function refreshMainMenuLP() {
  restoreEternalItemsFromDefeat();
}

export function initOptionsSettings() {
  let presetId = "1080p";
  try {
    const raw = localStorage.getItem(RESOLUTION_STORAGE_KEY);
    if (raw && RESOLUTION_PRESETS[raw]) presetId = raw;
  } catch {}
  applyResolutionPreset(presetId);
  renderResolutionSelection(presetId);
}

export function applyResolutionPreset(presetId) {
  const cap = RESOLUTION_PRESETS[presetId] || RESOLUTION_PRESETS["1080p"];
  window.__gameResolutionPresetId = presetId;
  window.__gameResolutionCap = { width: cap.width, height: cap.height };
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, presetId);
  } catch {}
  renderResolutionSelection(presetId);
  if (window.currentGame && typeof window.currentGame.resizeCanvas === "function") {
    window.currentGame.resizeCanvas();
  }
}

function renderResolutionSelection(selectedId) {
  document.querySelectorAll(".options-resolution-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.resolution === selectedId);
  });
  const current = document.getElementById("options-current-resolution");
  if (current) {
    current.textContent = selectedId.toUpperCase();
  }
}

export function openOptions() {
  const overlay = document.getElementById("options-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
  const selected = window.__gameResolutionPresetId || "1080p";
  renderResolutionSelection(selected);
}

export function closeOptions() {
  const overlay = document.getElementById("options-overlay");
  if (overlay) overlay.classList.add("hidden");
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) mainMenu.classList.remove("hidden");
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

/** Dev: set unspent talent points override to 999 for the global profile. */
export function giveAllCharacters999Crystals() {
  const profile = loadGlobalPlayerProfile();
  saveGlobalPlayerProfile({
    ...profile,
    unspentTalentPoints: 999
  });
  return { total: 1, updated: 1 };
}
