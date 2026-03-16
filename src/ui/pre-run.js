// -------- Pre-Run & Skill Select Screens --------

import { escapeHtml } from '../utils.js';
import {
  DIFFICULTY_CONDITION_COUNTS,
  DIFFICULTY_STAT_MULTIPLIER,
  SHOW_DEV_CONTROLS,
  getSelectedRunSkills
} from '../data/constants.js';
import { pickRandomConditions, ATTACK_TYPES } from '../data/conditions.js';
import {
  BUILD_UPGRADE_RARITY_QUOTA,
  createSelectedUpgradeState,
  getAttackUpgradeDefById,
  getBuildUpgradePoolForAttackType,
  getBuildUpgradeQuotaForAttack,
  getBuildUpgradeQuotaTotalForAttack,
  getBuildUpgradeRarity,
  UPGRADE_CATEGORIES
} from '../data/level-up-data.js';
import { getAllPillars } from '../data/pillars.js';
import { hasTalent, getPurchasedTalents } from '../data/talents.js';
import { loadPillarProgressState } from '../systems/pillar-progress.js';
import { getFriendsState, canSelectCompanion, setSelectedCompanion, saveFriendsState } from '../systems/friends-system.js';
import { FRIENDS_CATALOG, FRIEND_IDS } from '../data/friends-data.js';
import { getFriendSpriteHtml } from './friends-ui.js';
import { loadSavedCharacters } from './save-system.js';
import { SNACK_TYPES, getSnackById } from '../data/snack.js';
import { PLAYABLE_CHARACTERS, getPlayableCharacterOrDefault, DEFAULT_PLAYABLE_CHARACTER_ID, DEFAULT_STAT_BASELINE } from '../data/playable-characters.js';
import { getSkillById } from '../data/skills.js';

let preRunDifficulty = 1;
let pendingCharacterIndex = null;
let pendingPlayableCharacterId = DEFAULT_PLAYABLE_CHARACTER_ID;
let preRunConditions = [];
let preRunRerollUsed = 0;
let preRunRerollMax = 1;
let pendingLegacyItems = [];
let pendingCompanionId = null;
let pendingSelectedLureIds = [];
let pendingSnackId = null;

let pendingSkillsForRun = [null, null, null, null];
let pendingAttackType = "projectile";
let pendingSecondaryAttackType = "bladeBlast";
let dualTechniqueActiveForRun = false;
let pendingSelectedUpgradeIds = [];

let _onStartGame = null;
let _pendingDevMode = false;
let _skillSelectBackTarget = "pre-run";
const ATTACK_PREFS_KEY = "spaceShooter_selectedBasicAttacks";
const BUILD_PREFS_KEY = "spaceShooter_selectedBuildUpgrades";
const SELECTED_HERO_STORAGE_KEY = "selectedPlayableCharacterId";

export function getSelectedPlayableCharacterIdFromStorage() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SELECTED_HERO_STORAGE_KEY) : null;
    if (!raw) return DEFAULT_PLAYABLE_CHARACTER_ID;
    const id = String(raw).trim();
    const valid = (PLAYABLE_CHARACTERS || []).some((c) => c.id === id);
    return valid ? id : DEFAULT_PLAYABLE_CHARACTER_ID;
  } catch {
    return DEFAULT_PLAYABLE_CHARACTER_ID;
  }
}

function saveSelectedPlayableCharacterIdToStorage(id) {
  try {
    if (typeof localStorage !== "undefined" && id) localStorage.setItem(SELECTED_HERO_STORAGE_KEY, id);
  } catch (_) {}
}

function getAttackTypeIdSet() {
  return new Set((ATTACK_TYPES || []).map((entry) => String(entry?.id || "")));
}

function getDefaultAttackType() {
  return ATTACK_TYPES?.[0]?.id || "projectile";
}

function getDefaultSecondaryAttackType(primary) {
  const firstDifferent = (ATTACK_TYPES || []).find((entry) => entry?.id && entry.id !== primary);
  return firstDifferent?.id || primary;
}

function sanitizeAttackType(rawValue, fallback) {
  const next = String(rawValue || "");
  const valid = getAttackTypeIdSet();
  return valid.has(next) ? next : fallback;
}

function loadAttackSelectionPrefs() {
  const primaryFallback = getDefaultAttackType();
  try {
    const raw = localStorage.getItem(ATTACK_PREFS_KEY);
    if (!raw) {
      return {
        primary: primaryFallback,
        secondary: getDefaultSecondaryAttackType(primaryFallback)
      };
    }
    const parsed = JSON.parse(raw);
    const primary = sanitizeAttackType(parsed?.primary, primaryFallback);
    const secondaryFallback = getDefaultSecondaryAttackType(primary);
    const secondary = sanitizeAttackType(parsed?.secondary, secondaryFallback);
    return {
      primary,
      secondary: secondary === primary ? secondaryFallback : secondary
    };
  } catch {
    return {
      primary: primaryFallback,
      secondary: getDefaultSecondaryAttackType(primaryFallback)
    };
  }
}

function saveAttackSelectionPrefs(primary, secondary) {
  const safePrimary = sanitizeAttackType(primary, getDefaultAttackType());
  const secondaryFallback = getDefaultSecondaryAttackType(safePrimary);
  const safeSecondary = sanitizeAttackType(secondary, secondaryFallback);
  localStorage.setItem(ATTACK_PREFS_KEY, JSON.stringify({
    primary: safePrimary,
    secondary: safeSecondary === safePrimary ? secondaryFallback : safeSecondary
  }));
}

function sanitizeBuildUpgradeIds(rawIds, attackType) {
  const poolIds = new Set(getBuildUpgradePoolForAttackType(attackType).map((entry) => entry.id));
  const quota = getBuildUpgradeQuotaForAttack(attackType);
  const counts = { common: 0, uncommon: 0, rare: 0 };
  const totalAllowed = getBuildUpgradeQuotaTotalForAttack(attackType);
  const out = [];
  for (const rawId of rawIds || []) {
    const id = String(rawId || "");
    if (!poolIds.has(id)) continue;
    const rarity = getBuildUpgradeRarity(attackType, id);
    const maxForRarity = quota[rarity] || 0;
    if (maxForRarity > 0 && counts[rarity] >= maxForRarity) continue;
    out.push(id);
    counts[rarity]++;
    if (out.length >= totalAllowed) break;
  }
  return out;
}

function loadBuildSelectionPrefs(attackType) {
  try {
    const raw = localStorage.getItem(BUILD_PREFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeBuildUpgradeIds(parsed?.[attackType], attackType);
  } catch {
    return [];
  }
}

function saveBuildSelectionPrefs(attackType, upgradeIds) {
  let next = {};
  try {
    next = JSON.parse(localStorage.getItem(BUILD_PREFS_KEY) || "{}") || {};
  } catch {
    next = {};
  }
  next[attackType] = sanitizeBuildUpgradeIds(upgradeIds, attackType);
  localStorage.setItem(BUILD_PREFS_KEY, JSON.stringify(next));
}

function getPendingSelectedUpgrades() {
  return sanitizeBuildUpgradeIds(pendingSelectedUpgradeIds, pendingAttackType)
    .map((upgradeId) => createSelectedUpgradeState(getAttackUpgradeDefById(pendingAttackType, upgradeId)))
    .filter(Boolean)
    .slice(0, getBuildUpgradeQuotaTotalForAttack(pendingAttackType));
}

function hasDualTechniqueAllocated() {
  try {
    const allPillarIds = getAllPillars().map((pillar) => pillar.id);
    const state = loadPillarProgressState(allPillarIds);
    const allocated = Array.isArray(state?.allocatedBlessingIds) ? state.allocatedBlessingIds : [];
  return allocated.includes("pillar.weapon_master.dual_technique");
  } catch {
    return false;
  }
}

function normalizeLureIds(rawIds) {
  if (!Array.isArray(rawIds)) return [];
  const normalized = [];
  for (const rawId of rawIds) {
    const id = String(rawId || "");
    if (!id || normalized.includes(id)) continue;
    normalized.push(id);
    if (normalized.length >= 2) break;
  }
  return normalized;
}

export function setStartGameCallback(fn) {
  _onStartGame = fn;
}

export function showPreRunScreen(legacyItems = [], options = {}) {
  // Merge friends stash into legacy items
  const friendsState = getFriendsState();
  const stashItems = friendsState.stash || [];
  pendingLegacyItems = [...legacyItems, ...stashItems];
  pendingSelectedLureIds = normalizeLureIds(options?.selectedLureIds);
  friendsState.stash = []; // Clear stash after merging
  saveFriendsState(friendsState);
  
  preRunDifficulty = 1;
  preRunRerollUsed = 0;
  pendingCharacterIndex = null;
  pendingPlayableCharacterId = options?.playableCharacterId ?? getSelectedPlayableCharacterIdFromStorage();
  preRunRerollMax = 1;
  rollPreRunConditions();
  
  // Load current companion selection
  pendingCompanionId = friendsState.selectedCompanionId;
  pendingSnackId = null;

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
  const saved = loadSavedCharacters();
  const preRunChar = pendingCharacterIndex != null ? saved[pendingCharacterIndex] : null;
  preRunRerollMax = 1;

  const charListEl = document.getElementById("pre-run-character-list");
  if (charListEl) {
    charListEl.innerHTML = "";
    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "pre-run-character-btn" + (pendingCharacterIndex === null ? " selected" : "");
    newBtn.textContent = "New character";
    newBtn.addEventListener("click", () => {
      pendingCharacterIndex = null;
      renderPreRunScreen();
    });
    charListEl.appendChild(newBtn);
    for (let i = 0; i < saved.length; i++) {
      const char = saved[i];
      if (char.dead) continue;
      const name = char.name || "Unnamed";
      const level = char.level ?? 1;
      const diff = char.difficulty ?? 1;
      const wounds = Math.max(0, Number(char.wounds) || 0);
      const woundLabel = wounds > 0 ? ` · ${wounds} Wound${wounds !== 1 ? "s" : ""}` : "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pre-run-character-btn" + (pendingCharacterIndex === i ? " selected" : "");
      btn.textContent = `${name} (Lv.${level}, Diff.${diff})${woundLabel}`;
      btn.addEventListener("click", () => {
        pendingCharacterIndex = i;
        renderPreRunScreen();
      });
      charListEl.appendChild(btn);
    }
  }

  const heroListEl = document.getElementById("pre-run-hero-list");
  if (heroListEl) {
    heroListEl.innerHTML = "";
    for (const hero of PLAYABLE_CHARACTERS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pre-run-hero-btn" + (pendingPlayableCharacterId === hero.id ? " selected" : "");
      btn.title = hero.description;
      btn.innerHTML = `<span class="pre-run-hero-name">${escapeHtml(hero.name)}</span><span class="pre-run-hero-desc">${escapeHtml(hero.passive?.name || "")} — ${escapeHtml((hero.passive?.description || "").slice(0, 50))}${(hero.passive?.description || "").length > 50 ? "…" : ""}</span>`;
      btn.addEventListener("click", () => {
        setPendingPlayableCharacterId(hero.id);
        renderPreRunScreen();
      });
      heroListEl.appendChild(btn);
    }
  }

  const selectedHero = getPlayableCharacterOrDefault(pendingPlayableCharacterId);
  const detailsPanel = document.getElementById("pre-run-hero-details");
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
    diff6Btn.classList.remove("visible");
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
      const iconPart = getFriendSpriteHtml(friendDef, 32, "pre-run-companion-sprite");
      btn.innerHTML = `${iconPart} ${escapeHtml(friendDef.displayName)} (Lv${friend.level})`;
      btn.addEventListener("click", () => {
        pendingCompanionId = friendId;
        renderPreRunScreen();
      });
      companionEl.appendChild(btn);
    }
  }

  const snackEl = document.getElementById("pre-run-snack");
  if (snackEl) {
    snackEl.innerHTML = "";

    const noneBtn = document.createElement("button");
    noneBtn.className = "pre-run-snack-btn" + (pendingSnackId === null ? " selected" : "");
    noneBtn.type = "button";
    noneBtn.innerHTML = `
      <span class="pre-run-snack-icon">-</span>
      <span class="pre-run-snack-copy">
        <span class="pre-run-snack-name">None</span>
        <span class="pre-run-snack-desc">Start the run without a snack.</span>
      </span>
    `;
    noneBtn.addEventListener("click", () => {
      pendingSnackId = null;
      renderPreRunScreen();
    });
    snackEl.appendChild(noneBtn);

    for (const snack of SNACK_TYPES) {
      const btn = document.createElement("button");
      btn.className = "pre-run-snack-btn" + (pendingSnackId === snack.id ? " selected" : "");
      btn.type = "button";
      btn.innerHTML = `
        <span class="pre-run-snack-icon">${escapeHtml(snack.icon || "?")}</span>
        <span class="pre-run-snack-copy">
          <span class="pre-run-snack-name">${escapeHtml(snack.name)}</span>
          <span class="pre-run-snack-desc">${escapeHtml(snack.description || "")}</span>
        </span>
      `;
      btn.addEventListener("click", () => {
        pendingSnackId = snack.id;
        renderPreRunScreen();
      });
      snackEl.appendChild(btn);
    }
  }

  const selectedSnackEl = document.getElementById("pre-run-snack-selected");
  if (selectedSnackEl) {
    const selectedSnack = getSnackById(pendingSnackId);
    selectedSnackEl.textContent = `Selected snack: ${selectedSnack?.name || "None"}`;
  }
}

export function showSkillSelectScreen() {
  const overlay = document.getElementById("skill-select-overlay");
  const preRun = document.getElementById("pre-run-overlay");
  if (overlay) overlay.classList.remove("hidden");
  if (preRun) preRun.classList.add("hidden");
  pendingSkillsForRun = [null, null, null, null];
  const prefs = loadAttackSelectionPrefs();
  pendingAttackType = sanitizeAttackType(prefs.primary, getDefaultAttackType());
  pendingSecondaryAttackType = sanitizeAttackType(
    prefs.secondary,
    getDefaultSecondaryAttackType(pendingAttackType)
  );
  pendingSelectedUpgradeIds = loadBuildSelectionPrefs(pendingAttackType);
  dualTechniqueActiveForRun = hasDualTechniqueAllocated();
  if (!dualTechniqueActiveForRun) {
    pendingSecondaryAttackType = pendingAttackType;
  } else if (pendingSecondaryAttackType === pendingAttackType) {
    pendingSecondaryAttackType = getDefaultSecondaryAttackType(pendingAttackType);
  }
  renderSkillSelectScreen();
}

export function renderSkillSelectScreen() {
  const attackTypeEl = document.getElementById("skill-select-attack-type");
  const upgradeSlotsEl = document.getElementById("skill-select-upgrade-slots");
  const upgradePoolEl = document.getElementById("skill-select-upgrade-pool");
  const upgradeHelpEl = document.getElementById("skill-select-upgrade-help");
  const confirmBtn = document.getElementById("skill-select-confirm");
  const clearUpgradesBtn = document.getElementById("skill-select-clear-upgrades");
  if (!attackTypeEl) return;
  const subtitle = document.querySelector("#skill-select-overlay .skill-select-subtitle");
  if (subtitle) {
    subtitle.textContent = dualTechniqueActiveForRun
      ? "Choose your primary and secondary basic attacks."
      : "Choose your basic attack.";
  }

  const section = attackTypeEl.closest(".skill-select-attack-type-section");
  if (!section) return;

  let secondaryLabel = document.getElementById("skill-select-attack-label-secondary");
  let secondaryContainer = document.getElementById("skill-select-attack-type-secondary");
  if (!secondaryLabel || !secondaryContainer) {
    secondaryLabel = document.createElement("label");
    secondaryLabel.id = "skill-select-attack-label-secondary";
    secondaryLabel.className = "skill-select-attack-label";
    secondaryLabel.textContent = "Secondary Basic Attack";
    secondaryContainer = document.createElement("div");
    secondaryContainer.id = "skill-select-attack-type-secondary";
    secondaryContainer.className = "skill-select-attack-type";
    section.appendChild(secondaryLabel);
    section.appendChild(secondaryContainer);
  }

  secondaryLabel.classList.toggle("hidden", !dualTechniqueActiveForRun);
  secondaryContainer.classList.toggle("hidden", !dualTechniqueActiveForRun);
  attackTypeEl.innerHTML = "";
  secondaryContainer.innerHTML = "";
  if (upgradeSlotsEl) upgradeSlotsEl.innerHTML = "";
  if (upgradePoolEl) upgradePoolEl.innerHTML = "";

  pendingSelectedUpgradeIds = sanitizeBuildUpgradeIds(pendingSelectedUpgradeIds, pendingAttackType);

  if (clearUpgradesBtn) {
    clearUpgradesBtn.disabled = pendingSelectedUpgradeIds.length === 0;
  }

  const renderAttackButton = (atk, selectedId, onSelect, options = {}) => {
    const btn = document.createElement("button");
    btn.className = "skill-select-attack-btn" + (selectedId === atk.id ? " selected" : "");
    btn.dataset.attackType = atk.id;
    if (options.disabled) btn.disabled = true;
    const iconPart = atk.illustration
      ? `<img class="skill-select-attack-icon" src="${escapeHtml(atk.illustration)}" alt="">`
      : "";
    const tagsPart = Array.isArray(atk.tags) && atk.tags.length > 0
      ? `<span class="skill-select-attack-desc">Tags: ${escapeHtml(atk.tags.join("  "))}</span>`
      : "";
    btn.innerHTML = `${iconPart}<span class="skill-select-attack-name">${escapeHtml(atk.name)}</span><span class="skill-select-attack-desc">${escapeHtml(atk.desc)}</span>${tagsPart}`;
    btn.addEventListener("click", onSelect);
    return btn;
  };

  for (const atk of ATTACK_TYPES) {
    attackTypeEl.appendChild(renderAttackButton(atk, pendingAttackType, () => {
      pendingAttackType = atk.id;
      pendingSelectedUpgradeIds = loadBuildSelectionPrefs(pendingAttackType);
      if (dualTechniqueActiveForRun && pendingSecondaryAttackType === pendingAttackType) {
        pendingSecondaryAttackType = getDefaultSecondaryAttackType(pendingAttackType);
      }
      renderSkillSelectScreen();
    }));
  }

  if (dualTechniqueActiveForRun) {
    for (const atk of ATTACK_TYPES) {
      secondaryContainer.appendChild(renderAttackButton(atk, pendingSecondaryAttackType, () => {
        if (atk.id === pendingAttackType) return;
        pendingSecondaryAttackType = atk.id;
        renderSkillSelectScreen();
      }, { disabled: atk.id === pendingAttackType }));
    }
  }

  const buildPool = getBuildUpgradePoolForAttackType(pendingAttackType);
  const selectedUpgrades = getPendingSelectedUpgrades();
  const quota = getBuildUpgradeQuotaForAttack(pendingAttackType);
  const totalRequired = getBuildUpgradeQuotaTotalForAttack(pendingAttackType);
  if (upgradeHelpEl) {
    if (quota.uncommon > 0 || quota.rare > 0) {
      upgradeHelpEl.textContent =
        `Choose ${totalRequired} upgrades for this run` +
        ` (${selectedUpgrades.length}/${totalRequired} selected).` +
        ` Requires ${quota.common} Common, ${quota.uncommon} Uncommon, ${quota.rare} Rare.`;
    } else {
      upgradeHelpEl.textContent =
        `Choose ${totalRequired} upgrades for this run (${selectedUpgrades.length}/${totalRequired} selected). Each level-up randomly improves one of your picks.`;
    }
  }
  if (upgradeSlotsEl) {
    const slotRarities = [];
    for (let i = 0; i < (quota.common || 0); i++) slotRarities.push("common");
    for (let i = 0; i < (quota.uncommon || 0); i++) slotRarities.push("uncommon");
    for (let i = 0; i < (quota.rare || 0); i++) slotRarities.push("rare");
    const idList = sanitizeBuildUpgradeIds(pendingSelectedUpgradeIds, pendingAttackType);
    const byRarity = { common: [], uncommon: [], rare: [] };
    for (const id of idList) {
      const rarity = getBuildUpgradeRarity(pendingAttackType, id);
      byRarity[rarity].push(id);
    }

    for (let i = 0; i < slotRarities.length; i++) {
      const slotBtn = document.createElement("button");
      slotBtn.type = "button";
      const rarity = slotRarities[i] || "common";
      const sourceList = byRarity[rarity] || [];
      const upgradeId = sourceList.shift() || null;
      const selected = upgradeId
        ? createSelectedUpgradeState(getAttackUpgradeDefById(pendingAttackType, upgradeId))
        : null;
      slotBtn.className = "skill-select-upgrade-slot" + (selected ? " filled" : "");
      if (selected) {
        const def = getAttackUpgradeDefById(pendingAttackType, selected.id);
        const rarityLabel = String(def?.rarity || "Common");
        slotBtn.innerHTML = `
          <span class="skill-select-upgrade-slot-label">Slot ${i + 1}</span>
          <span class="skill-select-upgrade-slot-name">${escapeHtml(selected.name)}</span>
          <span class="skill-select-upgrade-slot-cat">${escapeHtml(rarityLabel)}</span>
        `;
        slotBtn.addEventListener("click", () => {
          const idx = pendingSelectedUpgradeIds.indexOf(selected.id);
          if (idx >= 0) pendingSelectedUpgradeIds.splice(idx, 1);
          renderSkillSelectScreen();
        });
      } else {
        slotBtn.innerHTML = `
          <span class="skill-select-upgrade-slot-label">Slot ${i + 1}</span>
          <span class="skill-select-upgrade-slot-name">Empty</span>
          <span class="skill-select-upgrade-slot-cat">${rarity.charAt(0).toUpperCase() + rarity.slice(1)} slot</span>
        `;
      }
      upgradeSlotsEl.appendChild(slotBtn);
    }
  }
  if (upgradePoolEl) {
    const categoryLabel = (cat) => ({
      damage: "Damage",
      rhythm: "Rhythm",
      control: "Control",
      onhit: "On Hit",
      power: "Power",
      tempo: "Tempo",
      spiritcraft: "Spiritcraft"
    }[cat] || cat);
    const byCategory = {};
    for (const u of buildPool) {
      const c = u.category || "damage";
      if (!byCategory[c]) byCategory[c] = [];
      byCategory[c].push(u);
    }
    const orderedCategories = [...UPGRADE_CATEGORIES].filter((c) => byCategory[c]?.length);

    const renderCategoryGroup = (cat) => {
      const group = document.createElement("div");
      group.className = "skill-select-upgrade-category";
      const heading = document.createElement("div");
      heading.className = "skill-select-upgrade-category-heading";
      heading.textContent = categoryLabel(cat);
      group.appendChild(heading);
      const currentIds = sanitizeBuildUpgradeIds(pendingSelectedUpgradeIds, pendingAttackType);
      const currentCounts = { common: 0, uncommon: 0, rare: 0 };
      for (const id of currentIds) {
        const r = getBuildUpgradeRarity(pendingAttackType, id);
        currentCounts[r] = (currentCounts[r] || 0) + 1;
      }

      for (const upgrade of byCategory[cat]) {
        const btn = document.createElement("button");
        btn.type = "button";
        const selectedCount = currentIds.filter((id) => id === upgrade.id).length;
        const rarityKey = String(upgrade.rarity || "").toLowerCase();
        let className = "skill-select-upgrade-btn";
        if (selectedCount > 0) className += " selected";
        if (rarityKey) className += ` rarity-${rarityKey}`;
        btn.className = className;
        const rarity = getBuildUpgradeRarity(pendingAttackType, upgrade.id);
        const maxForRarity = quota[rarity] || 0;
        const canPickMoreOfRarity = maxForRarity === 0 ? false : (currentCounts[rarity] || 0) < maxForRarity;
        const totalSelected = currentIds.length;
        const canPickAny = totalSelected < totalRequired;
        btn.disabled = !canPickAny || !canPickMoreOfRarity;
        const rarityLabel = upgrade.rarity
          ? String(upgrade.rarity).charAt(0).toUpperCase() + String(upgrade.rarity).slice(1)
          : "";
        btn.innerHTML = `
          <span class="skill-select-upgrade-name">${escapeHtml(upgrade.name)}</span>
          ${rarityLabel ? `<span class="skill-select-upgrade-meta">${escapeHtml(rarityLabel)}</span>` : ""}
          <span class="skill-select-upgrade-desc">${escapeHtml(upgrade.description || "")}</span>
        `;
        btn.addEventListener("click", () => {
          if (btn.disabled) return;
          pendingSelectedUpgradeIds.push(upgrade.id);
          renderSkillSelectScreen();
        });
        group.appendChild(btn);
      }
      return group;
    };

    upgradePoolEl.innerHTML = "";

    // For four-category builds (e.g. Soul Siphon), use a 2x2 grid layout.
    if (orderedCategories.length === 4) {
      upgradePoolEl.className = "skill-select-upgrade-pool skill-select-upgrade-pool-grid-2x2";
      for (const cat of orderedCategories) {
        upgradePoolEl.appendChild(renderCategoryGroup(cat));
      }
    } else {
      const mid = Math.ceil(orderedCategories.length / 2);
      const leftColCats = orderedCategories.slice(0, mid);
      const rightColCats = orderedCategories.slice(mid);
      upgradePoolEl.className = "skill-select-upgrade-pool skill-select-upgrade-pool-two-col";

      const renderColumn = (categories) => {
        const col = document.createElement("div");
        col.className = "skill-select-upgrade-pool-col";
        for (const cat of categories) {
          col.appendChild(renderCategoryGroup(cat));
        }
        return col;
      };

      if (leftColCats.length) upgradePoolEl.appendChild(renderColumn(leftColCats));
      if (rightColCats.length) upgradePoolEl.appendChild(renderColumn(rightColCats));
    }
  }
  if (confirmBtn) {
    confirmBtn.disabled = selectedUpgrades.length !== totalRequired;
  }
}

export function clearSkillSelectUpgrades() {
  pendingSelectedUpgradeIds = [];
  renderSkillSelectScreen();
}

export function confirmSkillSelectAndStart() {
  const selectedUpgrades = getPendingSelectedUpgrades();
  if (selectedUpgrades.length !== getBuildUpgradeQuotaTotalForAttack(pendingAttackType)) return;
  const vaultLocked = preRunConditions.some((c) => c.id === "vaultLocked");
  const legacyItems = vaultLocked ? [] : pendingLegacyItems;

  const overlay = document.getElementById("skill-select-overlay");
  const mainMenu = document.getElementById("main-menu");
  const gameRoot = document.querySelector(".game-root");
  if (overlay) overlay.classList.add("hidden");
  if (mainMenu) mainMenu.classList.add("hidden");
  if (gameRoot) gameRoot.classList.remove("hidden");
  document.getElementById("pause-toggle")?.classList.remove("hidden");
  if (SHOW_DEV_CONTROLS) {
    document.getElementById("dev-toggle")?.classList.remove("hidden");
  }
  document.getElementById("inventory-button")?.classList.remove("hidden");

  // Save companion selection
  const friendsState = getFriendsState();
  setSelectedCompanion(friendsState, pendingCompanionId);
  saveFriendsState(friendsState);

  let skills = getSelectedRunSkills();
  const hero = getPlayableCharacterOrDefault(pendingPlayableCharacterId);
  if (hero?.uniqueSkill) {
    skills = [...skills];
    skills[hero.uniqueSkill.slot] = hero.uniqueSkill.skillId;
  }
  saveAttackSelectionPrefs(
    pendingAttackType,
    dualTechniqueActiveForRun ? pendingSecondaryAttackType : pendingAttackType
  );
  saveBuildSelectionPrefs(pendingAttackType, pendingSelectedUpgradeIds);
  const saved = loadSavedCharacters();
  const selectedCharacter = pendingCharacterIndex != null && saved[pendingCharacterIndex] != null
    ? saved[pendingCharacterIndex]
    : null;
  const selectedSnack = getSnackById(pendingSnackId);

  if (_onStartGame) {
    const runConfig = {
      difficulty: preRunDifficulty,
      conditions: preRunConditions,
      skills,
      attackType: pendingAttackType,
      secondaryAttackType: dualTechniqueActiveForRun ? pendingSecondaryAttackType : pendingAttackType,
      selectedUpgrades,
      companionId: pendingCompanionId,
      snackId: selectedSnack?.id || null,
      selectedLureIds: pendingSelectedLureIds.slice(),
      selectedCharacterIndex: pendingCharacterIndex,
      selectedCharacter,
      playableCharacterId: pendingPlayableCharacterId || DEFAULT_PLAYABLE_CHARACTER_ID
    };
    if (_pendingDevMode) {
      runConfig.devMode = true;
      _pendingDevMode = false;
    }
    _onStartGame(legacyItems, runConfig);
  }
}

export function acceptPreRunAndStart() {
  _skillSelectBackTarget = "pre-run";
  showSkillSelectScreen();
}

export function setPendingDevMode(value) {
  _pendingDevMode = !!value;
}

export function setSkillSelectBackTarget(target) {
  _skillSelectBackTarget = target === "menu" ? "menu" : "pre-run";
}

export function getSkillSelectBackTarget() {
  return _skillSelectBackTarget;
}

export function setPreRunStateForDevMode() {
  preRunDifficulty = 1;
  preRunConditions = [];
  pendingLegacyItems = [];
  pendingCharacterIndex = 0;
  pendingCompanionId = null;
  pendingSelectedLureIds = [];
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

export function getPendingPlayableCharacterId() {
  return pendingPlayableCharacterId ?? DEFAULT_PLAYABLE_CHARACTER_ID;
}

export function setPendingPlayableCharacterId(id) {
  const valid = (PLAYABLE_CHARACTERS || []).some((c) => c.id === id);
  if (valid) {
    pendingPlayableCharacterId = id;
    saveSelectedPlayableCharacterIdToStorage(id);
  }
}
