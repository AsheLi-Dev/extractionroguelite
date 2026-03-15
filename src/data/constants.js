// -------- Difficulty & Run Conditions --------

export const DIFFICULTY_CONDITION_COUNTS = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 8, 6: 10 };
export const DIFFICULTY_STAT_MULTIPLIER = { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.4, 5: 1.6, 6: 1.8 };

export const APP_TITLE = "Extract Da Panda";
export const APP_SUBTITLE = "Fight through shifting biomes, grow stronger, and escape alive.";
export const BUILD_CHANNEL = "main";
export const DEMO_BUILD = BUILD_CHANNEL === "demo";
export const SHOW_DEV_CONTROLS = !DEMO_BUILD;
export const SHOW_DEV_MENU = !DEMO_BUILD;

export const TALENTS_KEY = "spaceShooter_talents";
export const SKILL_UNLOCKS_KEY = "spaceShooter_skillUnlocks";
export const SKILL_LEVELS_KEY = "spaceShooter_skillLevels";
export const SKILL_MOD_SOCKETS_KEY = "spaceShooter_skillModSockets";
export const MOD_CARDS_INVENTORY_KEY = "spaceShooter_modCardsInventory";
export const SELECTED_RUN_SKILLS_KEY = "spaceShooter_selectedRunSkills";

export const SKILL_XP_CURVE = [0, 0, 500, 1500, 3500, 7000, 12000, 20000, 32000, 50000, 75000];
export const SKILL_MAX_LEVEL = 10;

export const SKILL_SLOT_UNLOCK = { 1: 0, 2: 1, 3: 3, 4: 5 };

export const DEV_MODE_ENABLED = SHOW_DEV_CONTROLS;

/** Inset from player's nominal size when testing vs walls/obstacles so the character can get closer (sprite often doesn't fill full box). */
export const PLAYER_WALL_COLLISION_INSET = 10;

/** Scale factor for player collision rect (width/height). 1 = original size, 0.7 = 30% smaller. */
export const PLAYER_HITBOX_SCALE = 0.7;

export function getXpForSkillLevel(level) {
  if (level <= 1) return 0;
  return SKILL_XP_CURVE[Math.min(level, SKILL_XP_CURVE.length - 1)] ?? 75000;
}

export function getSkillLevels() {
  try {
    const raw = localStorage.getItem(SKILL_LEVELS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setSkillLevels(data) {
  localStorage.setItem(SKILL_LEVELS_KEY, JSON.stringify(data));
}

export function getSkillLevel(skillId) {
  const data = getSkillLevels();
  const entry = data[skillId];
  return entry ? Math.min(SKILL_MAX_LEVEL, entry.level ?? 1) : 1;
}

export function getSkillXp(skillId) {
  const data = getSkillLevels();
  const entry = data[skillId];
  return entry ? (entry.xp ?? 0) : 0;
}

export function markSkillEncountered(skillId) {
  const data = getSkillLevels();
  if (!data[skillId]) data[skillId] = { xp: 0, level: 1, encountered: true };
  else data[skillId].encountered = true;
  setSkillLevels(data);
}

export function addSkillXp(skillId, amount) {
  if (!skillId || amount <= 0) return null;
  const data = getSkillLevels();
  if (!data[skillId]) data[skillId] = { xp: 0, level: 1, encountered: true };
  else data[skillId].encountered = true;
  const prevLevel = data[skillId].level || 1;
  data[skillId].xp = (data[skillId].xp || 0) + amount;
  let level = prevLevel;
  while (level < SKILL_MAX_LEVEL && data[skillId].xp >= getXpForSkillLevel(level + 1)) {
    level++;
  }
  data[skillId].level = level;
  setSkillLevels(data);
  return { level, leveledUp: level > prevLevel };
}

export function getModSlotsForSkillLevel(level) {
  if (level <= 2) return 0;
  if (level <= 4) return 1;
  if (level <= 7) return 2;
  if (level <= 9) return 3;
  return 4;
}


export function getSkillModSockets() {
  try {
    const raw = localStorage.getItem(SKILL_MOD_SOCKETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setSkillModSockets(data) {
  localStorage.setItem(SKILL_MOD_SOCKETS_KEY, JSON.stringify(data));
}

export function getSelectedRunSkills() {
  try {
    const raw = localStorage.getItem(SELECTED_RUN_SKILLS_KEY);
    if (!raw) return [null, null, null, null];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 4) : [null, null, null, null];
  } catch {
    return [null, null, null, null];
  }
}

export function setSelectedRunSkills(skills) {
  const arr = Array.isArray(skills) ? skills.slice(0, 4) : [null, null, null, null];
  while (arr.length < 4) arr.push(null);
  localStorage.setItem(SELECTED_RUN_SKILLS_KEY, JSON.stringify(arr.slice(0, 4)));
}

export function getModCardInventory() {
  try {
    const raw = localStorage.getItem(MOD_CARDS_INVENTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addModCardToInventory(cardId) {
  const inv = getModCardInventory();
  inv.push(cardId);
  localStorage.setItem(MOD_CARDS_INVENTORY_KEY, JSON.stringify(inv));
}

export function removeModCardFromInventoryAtIndex(index) {
  const inv = getModCardInventory();
  if (index < 0 || index >= inv.length) return null;
  const cardId = inv.splice(index, 1)[0];
  localStorage.setItem(MOD_CARDS_INVENTORY_KEY, JSON.stringify(inv));
  return cardId;
}

export function getSkillUnlocks() {
  try {
    const raw = localStorage.getItem(SKILL_UNLOCKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setSkillUnlock(key, value = true) {
  const u = getSkillUnlocks();
  u[key] = value;
  localStorage.setItem(SKILL_UNLOCKS_KEY, JSON.stringify(u));
}

export function getHighestCompletedDifficulty() {
  const u = getSkillUnlocks();
  let max = 0;
  for (let d = 1; d <= 6; d++) {
    if (u[`diff${d}`]) max = Math.max(max, d);
  }
  return max;
}

export function markDifficultyCompleted(diff) {
  for (let d = 1; d <= diff; d++) {
    setSkillUnlock(`diff${d}`, true);
  }
}

export function getAvailableSkillSlots() {
  const max = getHighestCompletedDifficulty();
  if (max >= 5) return 4;
  if (max >= 3) return 3;
  if (max >= 1) return 2;
  return 1;
}
