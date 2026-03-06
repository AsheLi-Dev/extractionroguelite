// -------- Pre-Run & Skill Select Screens --------

import { escapeHtml } from '../utils.js';
import { DIFFICULTY_CONDITION_COUNTS, DIFFICULTY_STAT_MULTIPLIER, getSelectedRunSkills } from '../data/constants.js';
import { pickRandomConditions, ATTACK_TYPES } from '../data/conditions.js';
import { hasTalent } from '../data/talents.js';
import { getFriendsState, canSelectCompanion, setSelectedCompanion, saveFriendsState } from '../systems/friends-system.js';
import { FRIENDS_CATALOG, FRIEND_IDS } from '../data/friends-data.js';

let preRunDifficulty = 1;
let preRunConditions = [];
let preRunRerollUsed = 0;
let preRunRerollMax = 1;
let pendingLegacyItems = [];
let pendingCompanionId = null;

let pendingSkillsForRun = [null, null, null, null];
let pendingAttackType = "projectile";

let _onStartGame = null;

export function setStartGameCallback(fn) {
  _onStartGame = fn;
}

export function showPreRunScreen(legacyItems = []) {
  // Merge friends stash into legacy items
  const friendsState = getFriendsState();
  const stashItems = friendsState.stash || [];
  pendingLegacyItems = [...legacyItems, ...stashItems];
  friendsState.stash = []; // Clear stash after merging
  saveFriendsState(friendsState);
  
  preRunDifficulty = 1;
  preRunRerollUsed = 0;
  preRunRerollMax = hasTalent("daredevil") ? 2 : 1;
  rollPreRunConditions();
  
  // Load current companion selection
  pendingCompanionId = friendsState.selectedCompanionId;

  const overlay = document.getElementById("pre-run-overlay");
  const mainMenu = document.getElementById("main-menu");
  if (overlay) overlay.classList.remove("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");

  renderPreRunScreen();
}

export function rollPreRunConditions() {
  const count = DIFFICULTY_CONDITION_COUNTS[preRunDifficulty] ?? 0;
  preRunConditions = pickRandomConditions(count);
}

export function renderPreRunScreen() {
  const count = DIFFICULTY_CONDITION_COUNTS[preRunDifficulty] ?? 0;
  const diffLabel = document.getElementById("pre-run-diff-label");
  if (diffLabel) {
    diffLabel.textContent = count === 0
      ? "Difficulty 1 \u2014 No conditions"
      : `Difficulty ${preRunDifficulty} \u2014 ${count} conditions`;
  }

  const diffMultEl = document.getElementById("pre-run-diff-mult");
  if (diffMultEl) {
    const mult = (DIFFICULTY_STAT_MULTIPLIER[preRunDifficulty] ?? 1) * 100;
    diffMultEl.textContent = `Enemy stats & XP: ${Math.round(mult)}%`;
  }

  const list = document.getElementById("pre-run-conditions-list");
  if (list) {
    list.innerHTML = "";
    if (preRunConditions.length === 0) {
      const p = document.createElement("p");
      p.className = "pre-run-no-conditions";
      p.textContent = "No conditions this run.";
      list.appendChild(p);
    } else {
      for (const c of preRunConditions) {
        const div = document.createElement("div");
        div.className = "pre-run-condition-item";
        div.innerHTML = `<span class="pre-run-condition-icon">${c.icon}</span><div><strong>${escapeHtml(c.name)}</strong><br><span class="pre-run-condition-desc">${escapeHtml(c.desc)}</span></div>`;
        list.appendChild(div);
      }
    }
  }

  const rerollBtn = document.getElementById("pre-run-reroll");
  if (rerollBtn) {
    rerollBtn.disabled = preRunRerollUsed >= preRunRerollMax || count === 0;
    rerollBtn.textContent = preRunRerollUsed >= preRunRerollMax
      ? `Reroll used (${preRunRerollUsed}/${preRunRerollMax})`
      : `Reroll Conditions (${preRunRerollMax - preRunRerollUsed} left)`;
  }

  const diff6Btn = document.querySelector(".pre-run-diff-6");
  if (diff6Btn) {
    diff6Btn.classList.toggle("visible", hasTalent("legend"));
  }

  document.querySelectorAll(".pre-run-diff-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.diff) === preRunDifficulty);
  });

  // Render companion selection
  const companionEl = document.getElementById("pre-run-companion");
  if (companionEl) {
    const friendsState = getFriendsState();
    companionEl.innerHTML = "";
    
    const noneBtn = document.createElement("button");
    noneBtn.className = "pre-run-companion-btn" + (pendingCompanionId === null ? " selected" : "");
    noneBtn.textContent = "None";
    noneBtn.addEventListener("click", () => {
      pendingCompanionId = null;
      renderPreRunScreen();
    });
    companionEl.appendChild(noneBtn);

    for (const friendId of FRIEND_IDS) {
      const friendDef = FRIENDS_CATALOG[friendId];
      const friend = friendsState.friends[friendId];
      if (!friend || !canSelectCompanion(friendsState, friendId)) continue;

      const btn = document.createElement("button");
      btn.className = "pre-run-companion-btn" + (pendingCompanionId === friendId ? " selected" : "");
      const iconPart = friendDef.spritePath
        ? `<img src="${escapeHtml(friendDef.spritePath)}" alt="${escapeHtml(friendDef.displayName)}" class="pre-run-companion-sprite" width="32" height="32" style="width: 32px; height: 32px; max-width: 32px; max-height: 32px;" />`
        : `<span class="pre-run-companion-icon">${friendDef.iconKey}</span>`;
      btn.innerHTML = `${iconPart} ${escapeHtml(friendDef.displayName)} (Lv${friend.level})`;
      btn.addEventListener("click", () => {
        pendingCompanionId = friendId;
        renderPreRunScreen();
      });
      companionEl.appendChild(btn);
    }
  }
}

export function showSkillSelectScreen() {
  const overlay = document.getElementById("skill-select-overlay");
  const preRun = document.getElementById("pre-run-overlay");
  if (overlay) overlay.classList.remove("hidden");
  if (preRun) preRun.classList.add("hidden");
  pendingSkillsForRun = [null, null, null, null];
  renderSkillSelectScreen();
}

export function renderSkillSelectScreen() {
  const attackTypeEl = document.getElementById("skill-select-attack-type");
  if (!attackTypeEl) return;

  attackTypeEl.innerHTML = "";
  for (const atk of ATTACK_TYPES) {
    const btn = document.createElement("button");
    btn.className = "skill-select-attack-btn" + (pendingAttackType === atk.id ? " selected" : "");
    btn.dataset.attackType = atk.id;
    const iconPart = atk.illustration
      ? `<img class="skill-select-attack-icon" src="${escapeHtml(atk.illustration)}" alt="">`
      : "";
    const tagsPart = Array.isArray(atk.tags) && atk.tags.length > 0
      ? `<span class="skill-select-attack-desc">Tags: ${escapeHtml(atk.tags.join("  "))}</span>`
      : "";
    btn.innerHTML = `${iconPart}<span class="skill-select-attack-name">${escapeHtml(atk.name)}</span><span class="skill-select-attack-desc">${escapeHtml(atk.desc)}</span>${tagsPart}`;
    btn.addEventListener("click", () => {
      pendingAttackType = atk.id;
      renderSkillSelectScreen();
    });
    attackTypeEl.appendChild(btn);
  }
}

export function confirmSkillSelectAndStart() {
  const vaultLocked = preRunConditions.some((c) => c.id === "vaultLocked");
  const legacyItems = vaultLocked ? [] : pendingLegacyItems;

  const overlay = document.getElementById("skill-select-overlay");
  const mainMenu = document.getElementById("main-menu");
  const gameRoot = document.querySelector(".game-root");
  if (overlay) overlay.classList.add("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
  if (gameRoot) gameRoot.classList.remove("hidden");
  document.getElementById("pause-toggle")?.classList.remove("hidden");
  document.getElementById("dev-toggle")?.classList.remove("hidden");
  document.getElementById("inventory-button")?.classList.remove("hidden");

  // Save companion selection
  const friendsState = getFriendsState();
  setSelectedCompanion(friendsState, pendingCompanionId);
  saveFriendsState(friendsState);

  const skills = getSelectedRunSkills();
  if (_onStartGame) {
    _onStartGame(legacyItems, {
      difficulty: preRunDifficulty,
      conditions: preRunConditions,
      skills,
      attackType: pendingAttackType,
      companionId: pendingCompanionId
    });
  }
}

export function acceptPreRunAndStart() {
  showSkillSelectScreen();
}

export function setPreRunDifficulty(d) {
  preRunDifficulty = d;
  rollPreRunConditions();
  renderPreRunScreen();
}

export function rerollPreRunConditions() {
  preRunRerollUsed++;
  rollPreRunConditions();
  renderPreRunScreen();
}
