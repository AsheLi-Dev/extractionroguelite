import { ATTACK_TYPES } from "./conditions.js";
import { getDemoProgressionMult } from "./constants.js";
import { PLAYABLE_CHARACTERS, getPlayableCharacterOrDefault } from "./playable-characters.js";
import { getAttackUpgradeDefsForType, getAttackUpgradeDefById } from "./level-up-data.js";

export const BASIC_ATTACK_PROGRESSION_KEY = "spaceShooter_basicAttackProgression";
export const WEAPON_ART_TOKENS_KEY = "spaceShooter_weaponArtTokens";

export const WEAPON_ART_TOKENS = Object.freeze({
  refresh: { id: "refresh", name: "Refresh Token" },
  insight: { id: "insight", name: "Insight Token" },
  expansion: { id: "expansion", name: "Expansion Token" },
  precision: { id: "precision", name: "Precision Token" }
});

const CATEGORY_LABELS = Object.freeze({
  damage: "Damage",
  rhythm: "Rhythm",
  control: "Control",
  elemental: "Elemental",
  onhit: "On Hit",
  spiritcraft: "Spiritcraft"
});

const CATEGORY_COLORS = Object.freeze({
  damage: "#f97316",
  rhythm: "#22c55e",
  control: "#3b82f6",
  elemental: "#facc15",
  onhit: "#f472b6",
  spiritcraft: "#a855f7"
});

const CATEGORY_LAYOUTS = Object.freeze({
  projectile: ["damage", "rhythm", "control", "elemental"],
  windVolley: ["damage", "rhythm", "control", "onhit"],
  bladeBlast: ["damage", "rhythm", "control", "onhit"],
  soulSiphon: ["damage", "rhythm", "control", "spiritcraft"],
  guardCombo: ["damage", "rhythm", "control", "onhit"]
});

const BOARD_MASKS = Object.freeze({
  projectile: [
    [7, 0],
    [7, 1], [8, 1],
    [7, 2], [8, 2], [9, 2],
    [6, 3], [7, 3], [8, 3], [9, 3],
    [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
    [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5],
    [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6],
    [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7],
    [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8],
    [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [12, 9], [13, 9],
    [1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10],
    [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11], [11, 11], [12, 11], [13, 11],
    [2, 12], [3, 12], [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12], [12, 12],
    [3, 13], [4, 13], [5, 13], [6, 13], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13],
    [4, 14], [5, 14], [6, 14], [7, 14], [8, 14], [9, 14], [10, 14]
  ],
  soulSiphon: [
    [5, 0], [6, 0],
    [4, 1], [5, 1], [6, 1], [7, 1],
    [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
    [3, 3], [4, 3], [5, 3], [6, 3],
    [4, 4], [5, 4], [6, 4],
    [5, 5], [6, 5],
    [5, 6], [6, 6],
    [4, 7], [5, 7],
    [3, 8], [4, 8],
    [2, 9], [3, 9],
    [1, 10], [2, 10]
  ],
  bladeBlast: [
    [3, 0],
    [2, 1], [3, 1], [4, 1],
    [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4],
    [3, 5],
    [2, 6], [4, 6],
    [1, 7], [5, 7],
    [0, 8], [6, 8]
  ],
  windVolley: [
    [4, 0],
    [3, 1], [4, 1], [5, 1],
    [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
    [3, 5], [4, 5], [5, 5],
    [4, 6]
  ],
  guardCombo: [
    [1, 0], [2, 0], [3, 0],
    [1, 1], [2, 1], [3, 1],
    [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4], [5, 4],
    [3, 5], [4, 5], [5, 5],
    [4, 6], [5, 6]
  ]
});

const BOARD_SEEDS = Object.freeze({
  projectile: [[6, 11], [7, 11], [8, 11], [7, 12]],
  soulSiphon: [[5, 3], [5, 4], [4, 4], [6, 4]],
  bladeBlast: [[3, 2], [3, 3], [2, 3], [4, 3]],
  windVolley: [[4, 2], [4, 3], [3, 3], [5, 3]],
  guardCombo: [[2, 2], [3, 2], [2, 3], [3, 3]]
});

const BOARD_ART = Object.freeze({
  projectile: "assets/images/fire.png"
});

const SHARED_CATEGORY_SHAPES = Object.freeze({
  damage: [[0, 0], [1, 0], [2, 0], [1, 1]],
  rhythm: [[0, 0], [1, 0], [1, 1], [2, 1]],
  control: [[0, 0], [0, 1], [0, 2], [1, 2]]
});

const UNIQUE_CATEGORY_SHAPES = Object.freeze([
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]]
]);

const OFFER_BASE_WEIGHTS_BY_RARITY = Object.freeze({
  common: 60,
  uncommon: 30,
  rare: 10
});

const TOKEN_DROP_CHANCES = Object.freeze({
  refresh: 0.3,
  insight: 0.12,
  expansion: 0.06,
  precision: 0.02
});

const WEAPON_ART_SHARE_LEVEL = 20;
let _cachedBoardDefs = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toFiniteInt(value, fallback = 0) {
  const n = Math.floor(Number(value) || 0);
  return Number.isFinite(n) ? n : fallback;
}

function toCellKey(x, y) {
  return `${x},${y}`;
}

function fromCellKey(cellKey) {
  const [x, y] = String(cellKey || "").split(",").map((part) => Number(part));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function normalizeTokenType(tokenType) {
  const next = String(tokenType || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WEAPON_ART_TOKENS, next) ? next : null;
}

function getAttackTypeDef(attackType) {
  return ATTACK_TYPES.find((entry) => entry.id === attackType) || null;
}

function getAttackDisplayName(attackType) {
  return getAttackTypeDef(attackType)?.name || attackType;
}

function getBoardMask(attackType) {
  return BOARD_MASKS[attackType] || BOARD_MASKS.projectile;
}

function getBoardSeeds(attackType) {
  return BOARD_SEEDS[attackType] || BOARD_SEEDS.projectile;
}

function getLaneCategories(attackType) {
  return CATEGORY_LAYOUTS[attackType] || ["damage"];
}

export function getWeaponArtCategories(attackType) {
  return [...getLaneCategories(attackType)];
}

export function getWeaponArtCategoryLabel(category) {
  return CATEGORY_LABELS[String(category || "").toLowerCase()] || String(category || "");
}

function getFourthCategory(attackType) {
  const categories = getLaneCategories(attackType);
  return categories[3] || categories[categories.length - 1] || "damage";
}

function getCategoryColor(category) {
  return CATEGORY_COLORS[String(category || "").toLowerCase()] || "#94a3b8";
}

function normalizeOffsets(offsets) {
  const minX = Math.min(...offsets.map(([x]) => x));
  const minY = Math.min(...offsets.map(([, y]) => y));
  return offsets.map(([x, y]) => [x - minX, y - minY]);
}

function getPieceOffsetsForUpgrade(attackType, def, uniqueIndex = 0) {
  const category = String(def?.category || "damage");
  if (category === "damage" || category === "rhythm" || category === "control") {
    return normalizeOffsets(SHARED_CATEGORY_SHAPES[category] || SHARED_CATEGORY_SHAPES.damage);
  }
  if (category === getFourthCategory(attackType)) {
    return normalizeOffsets(UNIQUE_CATEGORY_SHAPES[uniqueIndex % UNIQUE_CATEGORY_SHAPES.length]);
  }
  return normalizeOffsets([[0, 0]]);
}

function getAllUpgradeDefsForAttack(attackType) {
  const defs = getAttackUpgradeDefsForType(attackType);
  return [...(defs?.standardUpgrades || []), ...(defs?.uniqueUpgrades || [])];
}

function createBoardDefinition(attackType) {
  const categories = getLaneCategories(attackType);
  const mask = getBoardMask(attackType);
  const allDefs = getAllUpgradeDefsForAttack(attackType);
  const upgradePieces = {};
  const nodes = [];
  const categoryMeta = {};

  categories.forEach((category, index) => {
    categoryMeta[category] = {
      id: category,
      label: getWeaponArtCategoryLabel(category),
      color: getCategoryColor(category),
      shapeType: index === 0 ? "t" : index === 1 ? "z" : index === 2 ? "l" : "unique"
    };
  });

  allDefs.forEach((def, index) => {
    upgradePieces[def.id] = {
      upgradeId: def.id,
      category: def.category,
      color: getCategoryColor(def.category),
      offsets: getPieceOffsetsForUpgrade(attackType, def, index)
    };
    nodes.push({
      id: `${attackType}:upgrade:${def.id}`,
      attackType,
      type: "upgrade",
      lane: def.category,
      rarity: String(def.rarity || "common").toLowerCase(),
      row: index,
      upgradeId: def.id,
      name: def.name,
      description: def.description || "",
      rankMax: Math.max(1, toFiniteInt(def.maxLevel, 1)),
      levelRequirement: 1,
      parents: [],
      parentMode: "all"
    });
  });

  const maskKeys = mask.map(([x, y]) => toCellKey(x, y));
  const seedKeys = getBoardSeeds(attackType).map(([x, y]) => toCellKey(x, y)).filter((key) => maskKeys.includes(key));
  const totalUnlockSteps = Math.max(0, maskKeys.length - seedKeys.length);

  return {
    attackType,
    boardId: `${attackType}:board:v1`,
    name: getAttackDisplayName(attackType),
    boardArt: BOARD_ART[attackType] || null,
    lanes: categories,
    categoryMeta,
    nodes,
    upgradePieces,
    mask,
    maskKeys,
    seedKeys,
    totalRankCount: totalUnlockSteps,
    maxLevel: 1 + Math.ceil(totalUnlockSteps / 2),
    maxSpentValue: allDefs.reduce((sum, def) => sum + Math.max(1, toFiniteInt(def.maxLevel, 1)), 0)
  };
}

export function getBasicAttackTreeDefinitions() {
  if (_cachedBoardDefs) return _cachedBoardDefs;
  const defs = {};
  for (const attack of ATTACK_TYPES) {
    defs[attack.id] = createBoardDefinition(attack.id);
  }
  _cachedBoardDefs = defs;
  return defs;
}

export function getWeaponArtBoardDefinition(attackType) {
  return getBasicAttackTreeDefinitions()[attackType] || null;
}

export const getBasicAttackTree = getWeaponArtBoardDefinition;

export function getBasicAttackNode(attackType, nodeId) {
  return getWeaponArtBoardDefinition(attackType)?.nodes.find((node) => node.id === nodeId) || null;
}

function createDefaultProgressForAttack(attackType) {
  const def = getWeaponArtBoardDefinition(attackType);
  return {
    attackType,
    boardId: def?.boardId || `${attackType}:board:v1`,
    xp: 0,
    level: 1,
    pendingUnlockCount: 0,
    unlockedCells: [...(def?.seedKeys || [])],
    placedUpgrades: [],
    selectedEvolutionIds: []
  };
}

function getPlacedUpgradeCounts(state) {
  const counts = {};
  for (const placement of state?.placedUpgrades || []) {
    counts[placement.upgradeId] = (counts[placement.upgradeId] || 0) + 1;
  }
  return counts;
}

function buildPurchasedRanksFromPlacements(state, attackType) {
  const ranks = {};
  for (const [upgradeId, count] of Object.entries(getPlacedUpgradeCounts(state))) {
    ranks[`${attackType}:upgrade:${upgradeId}`] = count;
  }
  return ranks;
}

function getLegacyPlacedUpgradeCounts(attackType, rawEntry) {
  const out = {};
  const rawRanks = rawEntry?.purchasedRanks && typeof rawEntry.purchasedRanks === "object" ? rawEntry.purchasedRanks : {};
  for (const [nodeId, count] of Object.entries(rawRanks)) {
    if (!nodeId.startsWith(`${attackType}:upgrade:`)) continue;
    const upgradeId = nodeId.slice(`${attackType}:upgrade:`.length);
    const n = Math.max(0, toFiniteInt(count, 0));
    if (n > 0) out[upgradeId] = n;
  }
  return out;
}

function getOccupiedCellMap(state) {
  const occupied = new Map();
  for (const placement of state?.placedUpgrades || []) {
    for (const key of placement.cells || []) {
      occupied.set(key, placement);
    }
  }
  return occupied;
}

function getPlacementCells(def, upgradeId, anchorCell) {
  const piece = def?.upgradePieces?.[upgradeId];
  const anchor = typeof anchorCell === "string" ? fromCellKey(anchorCell) : anchorCell;
  if (!piece || !anchor) return [];
  return piece.offsets.map(([dx, dy]) => toCellKey(anchor.x + dx, anchor.y + dy));
}

function canPlaceOnState(attackType, upgradeId, anchorCell, state, options = {}) {
  const def = getWeaponArtBoardDefinition(attackType);
  if (!def) return { ok: false, error: "unknown_attack_type" };
  const upgradeDef = getAttackUpgradeDefById(attackType, upgradeId);
  if (!upgradeDef) return { ok: false, error: "unknown_upgrade" };
  const ignoredInstanceId = options?.ignoreInstanceId ? String(options.ignoreInstanceId) : null;

  const counts = getPlacedUpgradeCounts(state);
  const maxLevel = Math.max(1, toFiniteInt(upgradeDef.maxLevel, 1));
  const effectiveCount = (counts[upgradeId] || 0) - (ignoredInstanceId
    ? (state?.placedUpgrades || []).filter((placement) => placement.upgradeId === upgradeId && placement.instanceId === ignoredInstanceId).length
    : 0);
  if (effectiveCount >= maxLevel) {
    return { ok: false, error: "maxed" };
  }

  const cells = getPlacementCells(def, upgradeId, anchorCell);
  if (cells.length === 0) return { ok: false, error: "invalid_anchor" };

  const mask = new Set(def.maskKeys);
  const unlocked = new Set(state?.unlockedCells || []);
  const occupied = getOccupiedCellMap(state);
  for (const key of cells) {
    if (!mask.has(key)) return { ok: false, error: "off_mask" };
    if (!unlocked.has(key)) return { ok: false, error: "locked_cell" };
    const occupyingPlacement = occupied.get(key);
    if (occupyingPlacement && (!ignoredInstanceId || occupyingPlacement.instanceId !== ignoredInstanceId)) {
      return { ok: false, error: "overlap" };
    }
  }

  return { ok: true, cells };
}

function findFirstValidPlacement(attackType, upgradeId, state) {
  const def = getWeaponArtBoardDefinition(attackType);
  if (!def) return null;
  for (const [x, y] of def.mask) {
    const cellKey = toCellKey(x, y);
    const result = canPlaceOnState(attackType, upgradeId, cellKey, state);
    if (result.ok) return { anchorCell: cellKey, cells: result.cells };
  }
  return null;
}

function migrateLegacyPlacements(attackType, entry, rawEntry) {
  if (Array.isArray(rawEntry?.placedUpgrades)) return entry;
  const legacyCounts = getLegacyPlacedUpgradeCounts(attackType, rawEntry);
  if (Object.keys(legacyCounts).length === 0) return entry;
  const next = clone(entry);
  next.unlockedCells = [...getWeaponArtBoardDefinition(attackType).maskKeys];
  next.pendingUnlockCount = 0;

  for (const [upgradeId, count] of Object.entries(legacyCounts)) {
    for (let i = 0; i < count; i += 1) {
      const found = findFirstValidPlacement(attackType, upgradeId, next);
      if (!found) break;
      next.placedUpgrades.push({
        instanceId: `${upgradeId}:${next.placedUpgrades.length}`,
        upgradeId,
        anchorCell: found.anchorCell,
        cells: found.cells
      });
    }
  }
  return next;
}

function sanitizeProgressEntry(attackType, rawEntry) {
  const def = getWeaponArtBoardDefinition(attackType);
  const entry = createDefaultProgressForAttack(attackType);
  entry.xp = Math.max(0, Number(rawEntry?.xp) || 0);
  entry.level = getLevelForXp(def, entry.xp);

  const mask = new Set(def.maskKeys);
  const unlockedCells = Array.isArray(rawEntry?.unlockedCells)
    ? rawEntry.unlockedCells.map((key) => String(key)).filter((key) => mask.has(key))
    : [];
  entry.unlockedCells = unlockedCells.length > 0 ? Array.from(new Set(unlockedCells)) : [...def.seedKeys];

  const placedUpgrades = Array.isArray(rawEntry?.placedUpgrades) ? rawEntry.placedUpgrades : [];
  const seenCells = new Set();
  for (const placement of placedUpgrades) {
    const upgradeId = String(placement?.upgradeId || "");
    if (!upgradeId) continue;
    const anchorCell = String(placement?.anchorCell || "");
    const check = canPlaceOnState(attackType, upgradeId, anchorCell, {
      unlockedCells: entry.unlockedCells,
      placedUpgrades: []
    });
    if (!check.ok) continue;
    if (check.cells.some((cellKey) => seenCells.has(cellKey))) continue;
    check.cells.forEach((cellKey) => seenCells.add(cellKey));
    entry.placedUpgrades.push({
      instanceId: String(placement?.instanceId || `${upgradeId}:${entry.placedUpgrades.length}`),
      upgradeId,
      anchorCell,
      cells: check.cells
    });
  }

  const legacyPendingPicks = Math.max(0, (entry.level - 1) * 2 - Math.max(0, entry.unlockedCells.length - def.seedKeys.length));
  const rawPending = rawEntry?.pendingUnlockCount ?? rawEntry?.pendingPickCount;
  entry.pendingUnlockCount = rawPending == null ? legacyPendingPicks : Math.max(0, toFiniteInt(rawPending, 0));

  const migrated = migrateLegacyPlacements(attackType, entry, rawEntry);
  const lockedCount = Math.max(0, def.maskKeys.length - migrated.unlockedCells.length);
  migrated.pendingUnlockCount = Math.min(migrated.pendingUnlockCount, lockedCount);
  return migrated;
}

function loadRawProgress() {
  try {
    const raw = localStorage.getItem(BASIC_ATTACK_PROGRESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRawProgress(progressByAttack) {
  localStorage.setItem(BASIC_ATTACK_PROGRESSION_KEY, JSON.stringify(progressByAttack));
}

function saveProgressEntry(attackType, entry) {
  const raw = loadRawProgress();
  raw[attackType] = sanitizeProgressEntry(attackType, entry);
  saveRawProgress(raw);
  return {
    ...raw[attackType],
    pendingPickCount: raw[attackType].pendingUnlockCount,
    purchasedRanks: buildPurchasedRanksFromPlacements(raw[attackType], attackType)
  };
}

export function getAllBasicAttackProgress() {
  const raw = loadRawProgress();
  const out = {};
  for (const attack of ATTACK_TYPES) {
    out[attack.id] = sanitizeProgressEntry(attack.id, raw?.[attack.id]);
  }
  return out;
}

export function getWeaponArtBoardState(attackType) {
  const state = getAllBasicAttackProgress()[attackType] || createDefaultProgressForAttack(attackType);
  return {
    ...state,
    pendingPickCount: state.pendingUnlockCount,
    purchasedRanks: buildPurchasedRanksFromPlacements(state, attackType)
  };
}

export const getBasicAttackProgress = getWeaponArtBoardState;
export const getWeaponArtProgress = getWeaponArtBoardState;

export function getXpForBasicAttackLevel(level) {
  const safeLevel = Math.max(1, toFiniteInt(level, 1));
  if (safeLevel <= 1) return 0;
  let total = 0;
  for (let target = 2; target <= safeLevel; target += 1) {
    total += 250 + (50 * (target - 1)) + (10 * (target - 1) * (target - 1));
  }
  return total;
}

function getLevelForXp(def, xp) {
  let level = 1;
  while (level < (def?.maxLevel || 1) && xp >= getXpForBasicAttackLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function getWeaponArtKind(attackType) {
  const tags = new Set(getAttackTypeDef(attackType)?.tags || []);
  if (tags.has("hybrid")) return "hybrid";
  if (tags.has("melee")) return "melee";
  return "ranged";
}

export function getHeroDefaultWeaponArt(heroId) {
  return getPlayableCharacterOrDefault(heroId)?.defaultWeaponArt || null;
}

export function getHeroDefaultWeaponArtClass(heroId) {
  return getPlayableCharacterOrDefault(heroId)?.defaultWeaponArtClass || "melee";
}

export function getWeaponArtOwnerHeroId(attackType) {
  return PLAYABLE_CHARACTERS.find((hero) => hero?.ownsDefaultWeaponArt && hero.defaultWeaponArt === attackType)?.id || null;
}

export function isWeaponArtSharedUnlocked(attackType, progress = null) {
  const summary = progress || getWeaponArtBoardState(attackType);
  return Math.max(1, Number(summary?.level) || 1) >= WEAPON_ART_SHARE_LEVEL;
}

export function getWeaponArtShareLevelRequirement() {
  return WEAPON_ART_SHARE_LEVEL;
}

export function canHeroUseWeaponArt(heroId, attackType, options = {}) {
  const safeAttackType = String(attackType || "");
  if (!safeAttackType || !getAttackTypeDef(safeAttackType)) return false;

  const hero = getPlayableCharacterOrDefault(heroId);
  const heroDefaultWeaponArt = hero?.defaultWeaponArt || null;
  if (heroDefaultWeaponArt === safeAttackType) return true;

  const sharedUnlocked = options.sharedUnlocked ?? isWeaponArtSharedUnlocked(safeAttackType, options.progress || null);
  if (!sharedUnlocked) return false;

  const defaultClass = hero?.defaultWeaponArtClass || "melee";
  const weaponArtKind = getWeaponArtKind(safeAttackType);
  if (defaultClass === "hybrid" || weaponArtKind === "hybrid") return true;
  if (weaponArtKind === "melee") return defaultClass === "melee";
  return defaultClass === "ranged";
}

export function getHeroSelectableWeaponArts(heroId, options = {}) {
  return ATTACK_TYPES.map((entry) => entry.id).filter((attackType) => canHeroUseWeaponArt(heroId, attackType, options));
}

export function getHeroWeaponArtFallback(heroId, preferredAttackType = null, options = {}) {
  if (preferredAttackType && canHeroUseWeaponArt(heroId, preferredAttackType, options)) return preferredAttackType;
  const heroDefaultWeaponArt = getHeroDefaultWeaponArt(heroId);
  if (heroDefaultWeaponArt && canHeroUseWeaponArt(heroId, heroDefaultWeaponArt, options)) return heroDefaultWeaponArt;
  return getHeroSelectableWeaponArts(heroId, options)[0] || ATTACK_TYPES?.[0]?.id || "projectile";
}

function loadRawTokenInventory() {
  try {
    const raw = localStorage.getItem(WEAPON_ART_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sanitizeTokenInventory(rawInventory) {
  const next = {};
  for (const tokenId of Object.keys(WEAPON_ART_TOKENS)) {
    next[tokenId] = Math.max(0, toFiniteInt(rawInventory?.[tokenId], 0));
  }
  return next;
}

function saveTokenInventory(inventory) {
  const sanitized = sanitizeTokenInventory(inventory);
  localStorage.setItem(WEAPON_ART_TOKENS_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function getWeaponArtTokenInventory() {
  return sanitizeTokenInventory(loadRawTokenInventory());
}

function addWeaponArtTokens(grants = {}) {
  const current = getWeaponArtTokenInventory();
  for (const [tokenType, amount] of Object.entries(grants || {})) {
    const normalized = normalizeTokenType(tokenType);
    if (!normalized) continue;
    current[normalized] = Math.max(0, toFiniteInt(current[normalized], 0) + Math.max(0, toFiniteInt(amount, 0)));
  }
  return saveTokenInventory(current);
}

function consumeWeaponArtToken(tokenType, amount = 1) {
  const normalized = normalizeTokenType(tokenType);
  if (!normalized) return null;
  const current = getWeaponArtTokenInventory();
  const required = Math.max(1, toFiniteInt(amount, 1));
  if ((current[normalized] || 0) < required) return null;
  current[normalized] = Math.max(0, current[normalized] - required);
  return saveTokenInventory(current);
}

function isAdjacentToUnlocked(def, unlocked, x, y) {
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return deltas.some(([dx, dy]) => {
    const key = toCellKey(x + dx, y + dy);
    return def.maskKeys.includes(key) && unlocked.has(key);
  });
}

export function getUnlockableBoardCells(attackType, state = null) {
  const def = getWeaponArtBoardDefinition(attackType);
  const entry = state || getWeaponArtBoardState(attackType);
  const unlocked = new Set(entry.unlockedCells || []);
  return def.mask
    .filter(([x, y]) => {
      const key = toCellKey(x, y);
      return !unlocked.has(key) && isAdjacentToUnlocked(def, unlocked, x, y);
    })
    .map(([x, y]) => ({ x, y, key: toCellKey(x, y) }));
}

export function unlockWeaponArtBoardCell(attackType, cellKey) {
  const state = getWeaponArtBoardState(attackType);
  const def = getWeaponArtBoardDefinition(attackType);
  const key = String(cellKey || "");
  if ((state.pendingUnlockCount || 0) <= 0) return null;
  if (!def?.maskKeys.includes(key)) return null;
  if ((state.unlockedCells || []).includes(key)) return null;
  const unlockable = new Set(getUnlockableBoardCells(attackType, state).map((cell) => cell.key));
  if (!unlockable.has(key)) return null;

  const next = clone(state);
  next.unlockedCells.push(key);
  next.pendingUnlockCount = Math.max(0, next.pendingUnlockCount - 1);
  return saveProgressEntry(attackType, next);
}

function createPlacementResult(state, attackType) {
  return {
    ...state,
    pendingPickCount: state.pendingUnlockCount,
    purchasedRanks: buildPurchasedRanksFromPlacements(state, attackType)
  };
}

export function canPlaceUpgradePiece(attackType, upgradeId, anchorCell, state = null) {
  const entry = state || getWeaponArtBoardState(attackType);
  const result = canPlaceOnState(attackType, upgradeId, anchorCell, entry);
  return result.ok
    ? { ok: true, cells: result.cells, anchorCell: typeof anchorCell === "string" ? anchorCell : toCellKey(anchorCell.x, anchorCell.y) }
    : { ok: false, error: result.error };
}

export function canMoveWeaponArtUpgradePiece(attackType, instanceId, anchorCell, state = null) {
  const entry = state || getWeaponArtBoardState(attackType);
  const placement = (entry.placedUpgrades || []).find((item) => item.instanceId === instanceId);
  if (!placement) return { ok: false, error: "missing_instance" };
  const result = canPlaceOnState(attackType, placement.upgradeId, anchorCell, entry, {
    ignoreInstanceId: instanceId
  });
  return result.ok
    ? {
        ok: true,
        cells: result.cells,
        anchorCell: typeof anchorCell === "string" ? anchorCell : toCellKey(anchorCell.x, anchorCell.y),
        placement
      }
    : { ok: false, error: result.error };
}

export function removeWeaponArtUpgradePiece(attackType, instanceId) {
  const state = getWeaponArtBoardState(attackType);
  const idx = (state.placedUpgrades || []).findIndex((placement) => placement.instanceId === instanceId);
  if (idx < 0) return null;
  const next = clone(state);
  const [removed] = next.placedUpgrades.splice(idx, 1);
  const saved = saveProgressEntry(attackType, next);
  return {
    ...saved,
    removedPlacement: removed
  };
}

export function clearWeaponArtBoardPlacements(attackType) {
  const state = getWeaponArtBoardState(attackType);
  if (!Array.isArray(state.placedUpgrades) || state.placedUpgrades.length === 0) {
    return saveProgressEntry(attackType, state);
  }
  const next = clone(state);
  next.placedUpgrades = [];
  return saveProgressEntry(attackType, next);
}

export function placeWeaponArtUpgradePiece(attackType, upgradeId, anchorCell) {
  const state = getWeaponArtBoardState(attackType);
  const result = canPlaceOnState(attackType, upgradeId, anchorCell, state);
  if (!result.ok) return null;
  const next = clone(state);
  const normalizedAnchor = typeof anchorCell === "string" ? anchorCell : toCellKey(anchorCell.x, anchorCell.y);
  next.placedUpgrades.push({
    instanceId: `${upgradeId}:${Date.now()}:${next.placedUpgrades.length}`,
    upgradeId,
    anchorCell: normalizedAnchor,
    cells: result.cells
  });
  return saveProgressEntry(attackType, next);
}

export function moveWeaponArtUpgradePiece(attackType, instanceId, anchorCell) {
  const state = getWeaponArtBoardState(attackType);
  const idx = (state.placedUpgrades || []).findIndex((placement) => placement.instanceId === instanceId);
  if (idx < 0) return null;
  const placement = state.placedUpgrades[idx];
  const result = canPlaceOnState(attackType, placement.upgradeId, anchorCell, state, {
    ignoreInstanceId: instanceId
  });
  if (!result.ok) return null;
  const next = clone(state);
  const normalizedAnchor = typeof anchorCell === "string" ? anchorCell : toCellKey(anchorCell.x, anchorCell.y);
  next.placedUpgrades[idx] = {
    ...next.placedUpgrades[idx],
    anchorCell: normalizedAnchor,
    cells: result.cells
  };
  return saveProgressEntry(attackType, next);
}

function getAvailableBoardUpgrades(attackType, state = null) {
  const entry = state || getWeaponArtBoardState(attackType);
  const counts = getPlacedUpgradeCounts(entry);
  return getAllUpgradeDefsForAttack(attackType)
    .map((def) => {
      const placedCount = counts[def.id] || 0;
      const maxLevel = Math.max(1, toFiniteInt(def.maxLevel, 1));
      const firstPlacement = findFirstValidPlacement(attackType, def.id, entry);
      return {
        id: `${attackType}:upgrade:${def.id}`,
        attackType,
        upgradeId: def.id,
        name: def.name,
        description: def.description || "",
        category: def.category,
        lane: def.category,
        rarity: String(def.rarity || "common").toLowerCase(),
        rankMax: maxLevel,
        currentRank: placedCount,
        remaining: Math.max(0, maxLevel - placedCount),
        piece: getWeaponArtBoardDefinition(attackType)?.upgradePieces?.[def.id] || null,
        hasPlacement: !!firstPlacement,
        suggestedAnchorCell: firstPlacement?.anchorCell || null
      };
    })
    .filter((entryDef) => entryDef.remaining > 0 && entryDef.hasPlacement);
}

export function getLegalWeaponArtNodes(attackType, progress = null, options = {}) {
  const legal = getAvailableBoardUpgrades(attackType, progress);
  const allowedRarities = Array.isArray(options.allowedRarities) && options.allowedRarities.length > 0
    ? new Set(options.allowedRarities.map((rarity) => String(rarity || "").toLowerCase()))
    : null;
  return legal.filter((entry) => !allowedRarities || allowedRarities.has(entry.rarity));
}

function weightedSampleWithoutReplacement(entries, count, rng = Math.random) {
  const pool = entries
    .filter((entry) => entry && entry.item && Number(entry.weight) > 0)
    .map((entry) => ({ item: entry.item, weight: Number(entry.weight) }));
  const targetCount = Math.max(0, toFiniteInt(count, 0));
  const out = [];

  while (pool.length > 0 && out.length < targetCount) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (!(totalWeight > 0)) break;
    let roll = (rng?.() ?? Math.random()) * totalWeight;
    let chosenIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        chosenIndex = i;
        break;
      }
    }
    out.push(pool[chosenIndex].item);
    pool.splice(chosenIndex, 1);
  }

  return out;
}

export function rollWeaponArtOffers(attackType, draftContext = {}, options = {}) {
  const count = Math.max(1, toFiniteInt(options.count, 3));
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const recentSkipped = new Set((draftContext?.recentSkippedNodeIds || []).map((id) => String(id)));
  const rerolledAway = new Set((draftContext?.rerolledAwayNodeIds || []).map((id) => String(id)));
  const biasCategory = draftContext?.biasCategory ? String(draftContext.biasCategory) : null;
  const lastDraftedCategory = draftContext?.lastDraftedCategory ? String(draftContext.lastDraftedCategory) : null;
  const legal = getLegalWeaponArtNodes(attackType, options.progress, { allowedRarities: options.allowedRarities });
  const weighted = legal.map((entry) => {
    let weight = OFFER_BASE_WEIGHTS_BY_RARITY[entry.rarity] ?? 1;
    if (lastDraftedCategory && entry.category === lastDraftedCategory) weight *= 1.8;
    if (biasCategory && entry.category === biasCategory) weight *= 3;
    if (recentSkipped.has(entry.id)) weight *= 0.6;
    if (rerolledAway.has(entry.id)) weight *= 0.35;
    return { item: entry, weight };
  });
  return weightedSampleWithoutReplacement(weighted, count, rng);
}

function normalizeChoiceState(choiceState = {}) {
  return {
    attackType: String(choiceState.attackType || ""),
    offers: Array.isArray(choiceState.offers)
      ? choiceState.offers.map((offer) => String(offer?.id || offer)).filter(Boolean)
      : [],
    tokenUsed: !!choiceState.tokenUsed,
    tokenTypeUsed: normalizeTokenType(choiceState.tokenTypeUsed),
    directSelect: !!choiceState.directSelect,
    offerCount: Math.max(1, toFiniteInt(choiceState.offerCount, 3)),
    biasCategory: choiceState.biasCategory ? String(choiceState.biasCategory) : null,
    recentSkippedNodeIds: Array.isArray(choiceState.recentSkippedNodeIds)
      ? choiceState.recentSkippedNodeIds.map((id) => String(id)).filter(Boolean)
      : [],
    rerolledAwayNodeIds: Array.isArray(choiceState.rerolledAwayNodeIds)
      ? choiceState.rerolledAwayNodeIds.map((id) => String(id)).filter(Boolean)
      : [],
    lastDraftedCategory: choiceState.lastDraftedCategory ? String(choiceState.lastDraftedCategory) : null
  };
}

export function useWeaponArtToken(tokenType, currentChoiceState, params = {}) {
  const normalizedTokenType = normalizeTokenType(tokenType);
  const choiceState = normalizeChoiceState(currentChoiceState);
  const attackType = choiceState.attackType;
  if (!normalizedTokenType || !attackType) return { ok: false, error: "invalid_token" };
  if (choiceState.tokenUsed) return { ok: false, error: "token_already_used" };
  if (!(getWeaponArtTokenInventory()[normalizedTokenType] > 0)) return { ok: false, error: "token_unavailable" };

  const rerolledAwayNodeIds = choiceState.offers.slice();
  const rollContext = {
    recentSkippedNodeIds: choiceState.recentSkippedNodeIds,
    rerolledAwayNodeIds,
    lastDraftedCategory: choiceState.lastDraftedCategory
  };

  let offers = [];
  let directSelect = false;
  let offerCount = choiceState.offerCount;
  let biasCategory = null;

  if (normalizedTokenType === "refresh") {
    offers = rollWeaponArtOffers(attackType, rollContext, { count: 3, progress: getWeaponArtBoardState(attackType), rng: params?.rng });
    offerCount = 3;
  } else if (normalizedTokenType === "insight") {
    const category = String(params?.category || "");
    if (!getWeaponArtCategories(attackType).includes(category)) return { ok: false, error: "invalid_category" };
    biasCategory = category;
    offers = rollWeaponArtOffers(attackType, { ...rollContext, biasCategory }, { count: 3, progress: getWeaponArtBoardState(attackType), rng: params?.rng });
    offerCount = 3;
  } else if (normalizedTokenType === "expansion") {
    offers = rollWeaponArtOffers(attackType, rollContext, { count: 6, progress: getWeaponArtBoardState(attackType), rng: params?.rng });
    offerCount = 6;
  } else if (normalizedTokenType === "precision") {
    offers = getLegalWeaponArtNodes(attackType, getWeaponArtBoardState(attackType), { allowedRarities: ["common", "uncommon"] });
    directSelect = true;
    offerCount = offers.length;
  }

  if (offers.length === 0) return { ok: false, error: "no_legal_offers" };
  const inventory = consumeWeaponArtToken(normalizedTokenType);
  if (!inventory) return { ok: false, error: "token_unavailable" };

  return {
    ok: true,
    inventory,
    choiceState: {
      attackType,
      offers: offers.map((offer) => offer.id),
      tokenUsed: true,
      tokenTypeUsed: normalizedTokenType,
      directSelect,
      offerCount,
      biasCategory,
      recentSkippedNodeIds: choiceState.recentSkippedNodeIds,
      rerolledAwayNodeIds,
      lastDraftedCategory: choiceState.lastDraftedCategory
    },
    offers
  };
}

function extractUpgradeId(attackType, rawId) {
  const id = String(rawId || "");
  if (id.startsWith(`${attackType}:upgrade:`)) return id.slice(`${attackType}:upgrade:`.length);
  return id;
}

export function canPurchaseBasicAttackNode(attackType, nodeId, progress = null) {
  const entry = progress || getWeaponArtBoardState(attackType);
  const cell = fromCellKey(nodeId);
  if (cell) {
    return (entry.pendingUnlockCount || 0) > 0
      && getUnlockableBoardCells(attackType, entry).some((candidate) => candidate.key === String(nodeId));
  }
  const upgradeId = extractUpgradeId(attackType, nodeId);
  if (!getAttackUpgradeDefById(attackType, upgradeId)) return false;
  return !!findFirstValidPlacement(attackType, upgradeId, entry);
}

export function resolveWeaponArtDraftChoice(attackType, nodeId, choiceState = null) {
  const entry = getWeaponArtBoardState(attackType);
  const normalizedChoiceState = choiceState ? normalizeChoiceState(choiceState) : null;
  if (normalizedChoiceState && normalizedChoiceState.attackType && normalizedChoiceState.attackType !== attackType) return null;
  if (normalizedChoiceState && normalizedChoiceState.offers.length > 0 && !normalizedChoiceState.offers.includes(String(nodeId))) return null;

  const cell = fromCellKey(nodeId);
  if (cell) {
    const unlocked = unlockWeaponArtBoardCell(attackType, String(nodeId));
    return unlocked ? createPlacementResult(unlocked, attackType) : null;
  }

  const upgradeId = extractUpgradeId(attackType, nodeId);
  const placement = findFirstValidPlacement(attackType, upgradeId, entry);
  if (!placement) return null;
  const placed = placeWeaponArtUpgradePiece(attackType, upgradeId, placement.anchorCell);
  return placed ? createPlacementResult(placed, attackType) : null;
}

export function addBasicAttackXp(attackType, amount) {
  if (!attackType || amount <= 0) return getWeaponArtBoardState(attackType);
  const def = getWeaponArtBoardDefinition(attackType);
  if (!def) return null;
  const current = getWeaponArtBoardState(attackType);
  const next = clone(current);
  const previousLevel = current.level || 1;
  next.xp = Math.max(0, Number(next.xp || 0) + Number(amount || 0));
  next.level = getLevelForXp(def, next.xp);
  const levelsGained = Math.max(0, next.level - previousLevel);
  const lockedCount = Math.max(0, def.maskKeys.length - (next.unlockedCells?.length || 0));
  next.pendingUnlockCount = Math.min(
    lockedCount,
    Math.max(0, toFiniteInt(next.pendingUnlockCount, 0)) + (levelsGained * 2)
  );
  return saveProgressEntry(attackType, next);
}

export const addWeaponArtXp = addBasicAttackXp;

export function getPendingWeaponArtTypes() {
  const all = getAllBasicAttackProgress();
  return Object.keys(all).filter((attackType) => (all[attackType]?.pendingUnlockCount || 0) > 0);
}

export function hasPendingWeaponArtChoices() {
  return getPendingWeaponArtTypes().length > 0;
}

export function getBasicAttackSpentValue(attackType, progress = null) {
  const entry = progress || getWeaponArtBoardState(attackType);
  return (entry.placedUpgrades || []).length;
}

export function getBasicAttackNodeCost() {
  return 1;
}

export function getBasicAttackNodeMinSpentPoints() {
  return 0;
}

export function buildRunAttackStateFromProgress(attackType, progress = null) {
  const entry = progress || getWeaponArtBoardState(attackType);
  const runAttackUpgrades = [];
  const categoryCounts = {};

  for (const placement of entry.placedUpgrades || []) {
    const def = getAttackUpgradeDefById(attackType, placement.upgradeId);
    if (!def) continue;
    runAttackUpgrades.push({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      level: 1,
      maxLevel: def.maxLevel,
      value: def.valueRange?.max,
      percent: !!def.valueRange?.percent
    });
    categoryCounts[def.category] = (categoryCounts[def.category] || 0) + 1;
  }

  return {
    runAttackUpgrades,
    runAttackPenalties: [],
    categoryCounts,
    elementalShotEvolutionFirst: null,
    elementalShotEvolutionSecond: null,
    soulSiphonEvolutionFirst: null,
    soulSiphonEvolutionSecond: null,
    bladeBlastTier1EvolutionId: null,
    bladeBlastTier2EvolutionId: null,
    weaponEvolutionState: {},
    weaponEvolutions: {}
  };
}

export function getBasicAttackTreeSummary(attackType, progress = null) {
  const entry = progress || getWeaponArtBoardState(attackType);
  const def = getWeaponArtBoardDefinition(attackType);
  const xpInLevel = Math.max(0, entry.xp - getXpForBasicAttackLevel(entry.level));
  const xpToNext = entry.level >= (def?.maxLevel || 1)
    ? 0
    : Math.max(0, getXpForBasicAttackLevel(entry.level + 1) - getXpForBasicAttackLevel(entry.level));
  return {
    ...entry,
    pendingPickCount: entry.pendingUnlockCount,
    purchasedRanks: buildPurchasedRanksFromPlacements(entry, attackType),
    maxLevel: def?.maxLevel || 1,
    maxSpentValue: def?.maxSpentValue || 0,
    spentValue: getBasicAttackSpentValue(attackType, entry),
    placedUpgradeCount: (entry.placedUpgrades || []).length,
    unlockedCellCount: (entry.unlockedCells || []).length,
    totalCellCount: def?.maskKeys.length || 0,
    totalRankCount: def?.totalRankCount || 0,
    xpInLevel,
    xpToNext
  };
}

export const getWeaponArtProgressSummary = getBasicAttackTreeSummary;

export function rollWeaponArtTokenRewards(summary = {}, rng = Math.random) {
  const difficulty = Math.max(1, toFiniteInt(summary?.difficulty, 1));
  const mapsCleared = Math.max(0, toFiniteInt(summary?.mapsCleared, 0));
  const enemiesKilled = Math.max(0, toFiniteInt(summary?.enemiesKilled, 0));
  const victory = !!summary?.victory;
  const bossKill = !!summary?.bossKill;

  const difficultyBonus = Math.min(0.12, Math.max(0, difficulty - 1) * 0.015);
  const mapsBonus = Math.min(0.06, mapsCleared * 0.01);
  const killBonus = Math.min(0.04, Math.floor(enemiesKilled / 80) * 0.01);
  const victoryBonus = victory ? 0.05 : 0;
  const bossBonus = bossKill ? 0.03 : 0;
  const out = {};

  const demoMult = getDemoProgressionMult();
  for (const [tokenType, baseChance] of Object.entries(TOKEN_DROP_CHANCES)) {
    let chance = baseChance + difficultyBonus + mapsBonus + killBonus;
    if (tokenType === "precision") chance += victoryBonus + bossBonus;
    else if (tokenType === "expansion") chance += victoryBonus * 0.75;
    else chance += victoryBonus * 0.5;
    chance = Math.max(0, Math.min(0.95, chance * demoMult));
    if ((rng?.() ?? Math.random()) < chance) out[tokenType] = 1;
  }
  return out;
}

export function grantWeaponArtRunRewards(summary = {}, rng = Math.random) {
  const rewards = rollWeaponArtTokenRewards(summary, rng);
  if (Object.keys(rewards).length === 0) {
    return { rewards: {}, inventory: getWeaponArtTokenInventory() };
  }
  const inventory = addWeaponArtTokens(rewards);
  return { rewards, inventory };
}

export function purchaseBasicAttackNode(attackType, nodeId) {
  return !!resolveWeaponArtDraftChoice(attackType, nodeId);
}

export function refundBasicAttackTree(attackType) {
  const reset = createDefaultProgressForAttack(attackType);
  const current = getWeaponArtBoardState(attackType);
  reset.xp = current.xp;
  reset.level = current.level;
  reset.pendingUnlockCount = Math.max(0, (current.level - 1) * 2);
  saveProgressEntry(attackType, reset);
  return true;
}
