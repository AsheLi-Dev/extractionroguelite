import { ATTACK_TYPES } from "./conditions.js";
import { getDemoProgressionMult } from "./constants.js";
import { PLAYABLE_CHARACTERS, getPlayableCharacterOrDefault } from "./playable-characters.js";
import {
  getAttackUpgradeDefsForType,
  getAttackUpgradeDefById
} from "./level-up-data.js";
import {
  BLADE_BLAST_BASE_WEAPON_ID,
  BLADE_BLAST_TIER1_EVOLUTION_BY_CATEGORY,
  BLADE_BLAST_TIER2_EVOLUTION_MATRIX,
  getAttackEvolutionById
} from "./attack-evolutions.js";
import {
  SOUL_SIPHON_CATEGORIES,
  SOUL_SIPHON_FIRST_EVOLUTION_NAMES,
  SOUL_SIPHON_SECOND_EVOLUTION_NAMES
} from "./soul-siphon-evolution.js";

export const BASIC_ATTACK_PROGRESSION_KEY = "spaceShooter_basicAttackProgression";
export const WEAPON_ART_TOKENS_KEY = "spaceShooter_weaponArtTokens";

export const WEAPON_ART_TOKENS = Object.freeze({
  refresh: { id: "refresh", name: "Refresh Token" },
  insight: { id: "insight", name: "Insight Token" },
  expansion: { id: "expansion", name: "Expansion Token" },
  precision: { id: "precision", name: "Precision Token" }
});

const ATTACK_CATEGORY_LAYOUT = Object.freeze({
  projectile: ["damage", "rhythm", "control", "elemental"],
  windVolley: ["damage", "rhythm", "control", "onhit"],
  bladeBlast: ["damage", "rhythm", "control", "onhit"],
  soulSiphon: ["damage", "rhythm", "control", "spiritcraft"],
  guardCombo: ["damage", "rhythm", "control", "onhit"]
});

const CATEGORY_LABELS = Object.freeze({
  damage: "Damage",
  rhythm: "Rhythm",
  control: "Control",
  elemental: "Elemental",
  onhit: "On Hit",
  spiritcraft: "Spiritcraft"
});

const RARITY_ORDER = Object.freeze({
  common: 0,
  uncommon: 1,
  rare: 2
});

const NODE_COST_BY_RARITY = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 4
});

const MIN_SPENT_POINTS_BY_RARITY = Object.freeze({
  uncommon: 10,
  rare: 20
});

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

const ELEMENTAL_SHOT_FIRST_EVOLUTION_NAMES = Object.freeze({
  damage: "Inferno Core",
  rhythm: "Storm Engine",
  control: "Tempest Arc",
  elemental: "Prismatic Cycle"
});

const ELEMENTAL_SHOT_SECOND_EVOLUTION_NAMES = Object.freeze({
  damage: "Damage Path",
  rhythm: "Rhythm Path",
  control: "Control Path",
  elemental: "Elemental Path"
});

let _cachedTreeDefs = null;

const WEAPON_ART_SHARE_LEVEL = 20;

function getAttackTypeDef(attackType) {
  return ATTACK_TYPES.find((entry) => entry.id === attackType) || null;
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
  const summary = progress || getBasicAttackProgress(attackType);
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

  if (defaultClass === "hybrid") return true;
  if (weaponArtKind === "hybrid") return true;
  if (weaponArtKind === "melee") return defaultClass === "melee";
  return defaultClass === "ranged";
}

export function getHeroSelectableWeaponArts(heroId, options = {}) {
  return ATTACK_TYPES
    .map((entry) => entry.id)
    .filter((attackType) => canHeroUseWeaponArt(heroId, attackType, options));
}

export function getHeroWeaponArtFallback(heroId, preferredAttackType = null, options = {}) {
  if (preferredAttackType && canHeroUseWeaponArt(heroId, preferredAttackType, options)) {
    return preferredAttackType;
  }
  const heroDefaultWeaponArt = getHeroDefaultWeaponArt(heroId);
  if (heroDefaultWeaponArt && canHeroUseWeaponArt(heroId, heroDefaultWeaponArt, options)) {
    return heroDefaultWeaponArt;
  }
  return getHeroSelectableWeaponArts(heroId, options)[0] || ATTACK_TYPES?.[0]?.id || "projectile";
}

function getAttackDisplayName(attackType) {
  return ATTACK_TYPES.find((entry) => entry.id === attackType)?.name || attackType;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toFiniteInt(value, fallback = 0) {
  const n = Math.floor(Number(value) || 0);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTokenType(tokenType) {
  const next = String(tokenType || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WEAPON_ART_TOKENS, next) ? next : null;
}

function getLaneCategories(attackType) {
  return ATTACK_CATEGORY_LAYOUT[attackType] || ["damage"];
}

export function getWeaponArtCategories(attackType) {
  return [...getLaneCategories(attackType)];
}

export function getWeaponArtCategoryLabel(category) {
  return CATEGORY_LABELS[String(category || "").toLowerCase()] || String(category || "");
}

function getNodeRankCost(node) {
  const rarityCost = NODE_COST_BY_RARITY[String(node?.rarity || "common").toLowerCase()];
  const explicitCost = Number(node?.rankCost);
  if (Number.isFinite(explicitCost) && explicitCost > 0) {
    return Math.max(1, Math.floor(explicitCost));
  }
  return Math.max(1, rarityCost ?? 1);
}

function getRangeMax(valueRange) {
  if (!valueRange || typeof valueRange !== "object") return undefined;
  const max = Number(valueRange.max);
  return Number.isFinite(max) ? max : undefined;
}

function getDeterministicUpgradeValue(def) {
  const max = getRangeMax(def?.valueRange);
  return max == null ? undefined : max;
}

function createUpgradeNode(attackType, lane, def, row) {
  return {
    id: `${attackType}:upgrade:${def.id}`,
    type: "upgrade",
    attackType,
    lane,
    row,
    name: def.name,
    description: def.description || "",
    rarity: String(def.rarity || "common").toLowerCase(),
    upgradeId: def.id,
    rankMax: Math.max(1, toFiniteInt(def.maxLevel, 1)),
    levelRequirement: 1,
    parents: [],
    parentMode: "all"
  };
}

function createEvolutionNode(config) {
  return {
    rankMax: 1,
    rarity: "rare",
    parentMode: "all",
    ...config
  };
}

function compareUpgradeDefs(a, b) {
  const rarityDelta = (RARITY_ORDER[String(a?.rarity || "common").toLowerCase()] ?? 99)
    - (RARITY_ORDER[String(b?.rarity || "common").toLowerCase()] ?? 99);
  if (rarityDelta !== 0) return rarityDelta;
  return 0;
}

function buildProjectileEvolutionNodes(tree) {
  const nodes = [];
  let row = Math.max(...tree.nodes.filter((node) => node.type === "upgrade").map((node) => node.row), 0) + 2;
  for (const category of tree.lanes) {
    nodes.push(createEvolutionNode({
      id: `${tree.attackType}:evolution:first:${category}`,
      type: "evolution_first",
      attackType: tree.attackType,
      lane: category,
      row,
      name: ELEMENTAL_SHOT_FIRST_EVOLUTION_NAMES[category] || `${CATEGORY_LABELS[category] || category} Evolution`,
      description: `First evolution for the ${CATEGORY_LABELS[category] || category} path.`,
      levelRequirement: 9,
      evolutionStage: "first",
      evolutionCategory: category,
      parents: []
    }));
  }
  row += 2;
  for (const firstCategory of tree.lanes) {
    for (const secondCategory of tree.lanes) {
      nodes.push(createEvolutionNode({
        id: `${tree.attackType}:evolution:second:${firstCategory}:${secondCategory}`,
        type: "evolution_second",
        attackType: tree.attackType,
        lane: firstCategory,
        row,
        name: ELEMENTAL_SHOT_SECOND_EVOLUTION_NAMES[secondCategory] || `${CATEGORY_LABELS[secondCategory] || secondCategory} Path`,
        description: `Second evolution for ${ELEMENTAL_SHOT_FIRST_EVOLUTION_NAMES[firstCategory] || firstCategory}.`,
        levelRequirement: 16,
        evolutionStage: "second",
        firstCategory,
        secondCategory,
        parents: [`${tree.attackType}:evolution:first:${firstCategory}`]
      }));
      row += 1;
    }
    row += 1;
  }
  return nodes;
}

function buildSoulSiphonEvolutionNodes(tree) {
  const nodes = [];
  let row = Math.max(...tree.nodes.filter((node) => node.type === "upgrade").map((node) => node.row), 0) + 2;
  for (const category of SOUL_SIPHON_CATEGORIES) {
    nodes.push(createEvolutionNode({
      id: `${tree.attackType}:evolution:first:${category}`,
      type: "evolution_first",
      attackType: tree.attackType,
      lane: category,
      row,
      name: SOUL_SIPHON_FIRST_EVOLUTION_NAMES[category] || `${CATEGORY_LABELS[category] || category} Evolution`,
      description: `First evolution for the ${CATEGORY_LABELS[category] || category} path.`,
      levelRequirement: 9,
      evolutionStage: "first",
      evolutionCategory: category,
      parents: []
    }));
  }
  row += 2;
  for (const firstCategory of SOUL_SIPHON_CATEGORIES) {
    for (const secondCategory of SOUL_SIPHON_CATEGORIES) {
      nodes.push(createEvolutionNode({
        id: `${tree.attackType}:evolution:second:${firstCategory}:${secondCategory}`,
        type: "evolution_second",
        attackType: tree.attackType,
        lane: firstCategory,
        row,
        name: SOUL_SIPHON_SECOND_EVOLUTION_NAMES[secondCategory] || `${CATEGORY_LABELS[secondCategory] || secondCategory} Path`,
        description: `Second evolution for ${SOUL_SIPHON_FIRST_EVOLUTION_NAMES[firstCategory] || firstCategory}.`,
        levelRequirement: 16,
        evolutionStage: "second",
        firstCategory,
        secondCategory,
        parents: [`${tree.attackType}:evolution:first:${firstCategory}`]
      }));
      row += 1;
    }
    row += 1;
  }
  return nodes;
}

function buildBladeBlastEvolutionNodes(tree) {
  const nodes = [];
  let row = Math.max(...tree.nodes.filter((node) => node.type === "upgrade").map((node) => node.row), 0) + 2;
  for (const [category, evolutionId] of Object.entries(BLADE_BLAST_TIER1_EVOLUTION_BY_CATEGORY)) {
    const def = getAttackEvolutionById(evolutionId);
    nodes.push(createEvolutionNode({
      id: `${tree.attackType}:evolution:first:${evolutionId}`,
      type: "evolution_first",
      attackType: tree.attackType,
      lane: category,
      row,
      name: def?.name || evolutionId,
      description: def?.summary || "",
      levelRequirement: 9,
      evolutionStage: "first",
      evolutionId,
      evolutionCategory: category,
      parents: []
    }));
  }
  row += 2;
  for (const [parentEvolutionId, mapping] of Object.entries(BLADE_BLAST_TIER2_EVOLUTION_MATRIX)) {
    for (const [category, evolutionId] of Object.entries(mapping || {})) {
      const def = getAttackEvolutionById(evolutionId);
      nodes.push(createEvolutionNode({
        id: `${tree.attackType}:evolution:second:${parentEvolutionId}:${evolutionId}`,
        type: "evolution_second",
        attackType: tree.attackType,
        lane: getAttackEvolutionById(parentEvolutionId)?.sourceCategory || category,
        row,
        name: def?.name || evolutionId,
        description: def?.summary || "",
        levelRequirement: 16,
        evolutionStage: "second",
        firstEvolutionId: parentEvolutionId,
        evolutionId,
        secondCategory: category,
        parents: [`${tree.attackType}:evolution:first:${parentEvolutionId}`]
      }));
      row += 1;
    }
    row += 1;
  }
  return nodes;
}

function getTotalRankCountForTree(tree) {
  return (tree?.nodes || []).reduce((sum, node) => sum + Math.max(1, toFiniteInt(node.rankMax, 1)), 0);
}

function buildAttackTree(attackType) {
  const defs = getAttackUpgradeDefsForType(attackType);
  const lanes = getLaneCategories(attackType);
  const byLane = Object.fromEntries(lanes.map((lane) => [lane, []]));
  for (const def of [...(defs?.standardUpgrades || []), ...(defs?.uniqueUpgrades || [])]) {
    const lane = lanes.includes(def.category) ? def.category : lanes[0];
    byLane[lane].push(def);
  }
  for (const lane of lanes) {
    byLane[lane].sort(compareUpgradeDefs);
  }

  const tree = {
    attackType,
    name: getAttackDisplayName(attackType),
    lanes,
    nodes: []
  };

  for (const lane of lanes) {
    let row = 0;
    let prevId = null;
    for (const def of byLane[lane]) {
      const node = createUpgradeNode(attackType, lane, def, row);
      if (prevId) node.parents = [prevId];
      tree.nodes.push(node);
      prevId = node.id;
      row += 1;
    }
  }

  if (attackType === "projectile") {
    tree.nodes.push(...buildProjectileEvolutionNodes(tree));
  } else if (attackType === "soulSiphon") {
    tree.nodes.push(...buildSoulSiphonEvolutionNodes(tree));
  } else if (attackType === "bladeBlast") {
    tree.nodes.push(...buildBladeBlastEvolutionNodes(tree));
  }

  const upgradeNodes = tree.nodes.filter((node) => node.type === "upgrade");
  const hasFirstEvolution = tree.nodes.some((node) => node.type === "evolution_first");
  const hasSecondEvolution = tree.nodes.some((node) => node.type === "evolution_second");
  tree.totalRankCount = getTotalRankCountForTree({ nodes: upgradeNodes }) + (hasFirstEvolution ? 1 : 0) + (hasSecondEvolution ? 1 : 0);
  tree.maxLevel = 1 + tree.totalRankCount;
  tree.maxSpentValue = upgradeNodes.reduce((sum, node) => sum + (getNodeRankCost(node) * node.rankMax), 0)
    + (hasFirstEvolution ? NODE_COST_BY_RARITY.rare : 0)
    + (hasSecondEvolution ? NODE_COST_BY_RARITY.rare : 0);
  return tree;
}

export function getBasicAttackTreeDefinitions() {
  if (_cachedTreeDefs) return _cachedTreeDefs;
  const defs = {};
  for (const attack of ATTACK_TYPES) {
    defs[attack.id] = buildAttackTree(attack.id);
  }
  _cachedTreeDefs = defs;
  return defs;
}

export function getBasicAttackTree(attackType) {
  return getBasicAttackTreeDefinitions()[attackType] || null;
}

export function getBasicAttackNode(attackType, nodeId) {
  const tree = getBasicAttackTree(attackType);
  return tree?.nodes.find((node) => node.id === nodeId) || null;
}

export function getBasicAttackNodeCost(attackType, nodeId) {
  const node = getBasicAttackNode(attackType, nodeId);
  return node ? getNodeRankCost(node) : 0;
}

export function getBasicAttackNodeMinSpentPoints(attackType, nodeId) {
  const node = getBasicAttackNode(attackType, nodeId);
  if (!node) return 0;
  return MIN_SPENT_POINTS_BY_RARITY[String(node.rarity || "common").toLowerCase()] || 0;
}

export function getXpForBasicAttackLevel(level) {
  const safeLevel = Math.max(1, toFiniteInt(level, 1));
  if (safeLevel <= 1) return 0;
  let total = 0;
  for (let target = 2; target <= safeLevel; target += 1) {
    total += 250 + (50 * (target - 1)) + (10 * (target - 1) * (target - 1));
  }
  return total;
}

function getLevelForXp(tree, xp) {
  let level = 1;
  while (level < (tree?.maxLevel || 1) && xp >= getXpForBasicAttackLevel(level + 1)) {
    level += 1;
  }
  return level;
}

function createDefaultProgressForAttack(attackType) {
  return {
    attackType,
    xp: 0,
    level: 1,
    pendingPickCount: 0,
    purchasedRanks: {},
    selectedEvolutionIds: []
  };
}

function getPurchasedRank(progress, nodeId) {
  return Math.max(0, toFiniteInt(progress?.purchasedRanks?.[nodeId], 0));
}

function getTotalPurchasedRankCount(progress) {
  return Object.values(progress?.purchasedRanks || {}).reduce((sum, rank) => sum + Math.max(0, toFiniteInt(rank, 0)), 0);
}

export function getBasicAttackSpentValue(attackType, progress = null) {
  const entry = progress || getBasicAttackProgress(attackType);
  return Object.entries(entry?.purchasedRanks || {}).reduce((sum, [ownedNodeId, rank]) => {
    const ownedNode = getBasicAttackNode(attackType, ownedNodeId);
    if (!ownedNode) return sum;
    return sum + (Math.max(0, toFiniteInt(rank, 0)) * getNodeRankCost(ownedNode));
  }, 0);
}

function getRemainingRankSlots(attackType, progress) {
  const tree = getBasicAttackTree(attackType);
  return Math.max(0, (tree?.totalRankCount || 0) - getTotalPurchasedRankCount(progress));
}

function sanitizeProgressEntry(attackType, rawEntry) {
  const tree = getBasicAttackTree(attackType);
  const purchasedRanks = {};
  const rawRanks = rawEntry?.purchasedRanks && typeof rawEntry.purchasedRanks === "object"
    ? rawEntry.purchasedRanks
    : {};
  for (const node of tree?.nodes || []) {
    const rawRank = toFiniteInt(rawRanks[node.id], 0);
    if (rawRank > 0) {
      purchasedRanks[node.id] = Math.min(node.rankMax, rawRank);
    }
  }

  const entry = createDefaultProgressForAttack(attackType);
  entry.xp = Math.max(0, Number(rawEntry?.xp) || 0);
  entry.level = getLevelForXp(tree, entry.xp);
  entry.purchasedRanks = purchasedRanks;
  entry.selectedEvolutionIds = Array.isArray(rawEntry?.selectedEvolutionIds)
    ? rawEntry.selectedEvolutionIds.filter((id) => typeof id === "string" && purchasedRanks[id] > 0)
    : [];

  const purchasedRankCount = getTotalPurchasedRankCount(entry);
  const remainingRankSlots = getRemainingRankSlots(attackType, entry);
  const legacyPendingPicks = Math.max(0, entry.level - 1 - purchasedRankCount);
  const rawPendingPickCount = rawEntry?.pendingPickCount;
  const pendingPickCount = rawPendingPickCount == null
    ? legacyPendingPicks
    : Math.max(0, toFiniteInt(rawPendingPickCount, 0));
  entry.pendingPickCount = Math.min(remainingRankSlots, pendingPickCount);
  return entry;
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

export function getAllBasicAttackProgress() {
  const raw = loadRawProgress();
  const out = {};
  for (const attack of ATTACK_TYPES) {
    out[attack.id] = sanitizeProgressEntry(attack.id, raw?.[attack.id]);
  }
  return out;
}

export function getBasicAttackProgress(attackType) {
  return getAllBasicAttackProgress()[attackType] || createDefaultProgressForAttack(attackType);
}

export const getWeaponArtProgress = getBasicAttackProgress;

function saveProgressEntry(attackType, entry) {
  const raw = loadRawProgress();
  raw[attackType] = sanitizeProgressEntry(attackType, entry);
  saveRawProgress(raw);
  return raw[attackType];
}

function hasSelectedEvolution(progress, stagePrefix) {
  return (progress?.selectedEvolutionIds || []).some((nodeId) => nodeId.includes(stagePrefix));
}

function getNodeDraftCategory(node) {
  if (!node) return null;
  if (node.type === "upgrade") return node.lane || null;
  if (node.type === "evolution_first") return node.evolutionCategory || node.lane || null;
  if (node.type === "evolution_second") return node.secondCategory || node.lane || null;
  return node.lane || null;
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

export function canPurchaseBasicAttackNode(attackType, nodeId, progress = null) {
  const tree = getBasicAttackTree(attackType);
  const node = getBasicAttackNode(attackType, nodeId);
  if (!tree || !node) return false;
  const entry = progress || getBasicAttackProgress(attackType);
  const currentRank = getPurchasedRank(entry, nodeId);
  if (currentRank >= node.rankMax) return false;
  if ((entry.level || 1) < (node.levelRequirement || 1)) return false;
  const requiredSpentPoints = MIN_SPENT_POINTS_BY_RARITY[String(node.rarity || "common").toLowerCase()] || 0;
  if (requiredSpentPoints > 0 && getBasicAttackSpentValue(attackType, entry) < requiredSpentPoints) return false;

  for (const parentId of node.parents || []) {
    const parent = getBasicAttackNode(attackType, parentId);
    if (!parent) return false;
    if (getPurchasedRank(entry, parentId) < parent.rankMax) return false;
  }

  if (node.type === "evolution_first" && hasSelectedEvolution(entry, ":evolution:first:")) {
    return false;
  }
  if (node.type === "evolution_second") {
    if (hasSelectedEvolution(entry, ":evolution:second:")) return false;
    if (attackType === "projectile" && !entry.selectedEvolutionIds.includes(`${attackType}:evolution:first:${node.firstCategory}`)) {
      return false;
    }
    if (attackType === "soulSiphon" && !entry.selectedEvolutionIds.includes(`${attackType}:evolution:first:${node.firstCategory}`)) {
      return false;
    }
    if (attackType === "bladeBlast" && !entry.selectedEvolutionIds.includes(`${attackType}:evolution:first:${node.firstEvolutionId}`)) {
      return false;
    }
  }
  return true;
}

export function getLegalWeaponArtNodes(attackType, progress = null, options = {}) {
  const tree = getBasicAttackTree(attackType);
  if (!tree) return [];
  const entry = progress || getBasicAttackProgress(attackType);
  const allowedRarities = Array.isArray(options.allowedRarities) && options.allowedRarities.length > 0
    ? new Set(options.allowedRarities.map((rarity) => String(rarity || "").toLowerCase()))
    : null;
  return (tree.nodes || []).filter((node) => {
    if (allowedRarities && !allowedRarities.has(String(node.rarity || "common").toLowerCase())) {
      return false;
    }
    return canPurchaseBasicAttackNode(attackType, node.id, entry);
  });
}

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
    if (tokenType === "precision") {
      chance += victoryBonus + bossBonus;
    } else if (tokenType === "expansion") {
      chance += victoryBonus * 0.75;
    } else {
      chance += victoryBonus * 0.5;
    }
    chance = Math.max(0, Math.min(0.95, chance * demoMult));
    if ((rng?.() ?? Math.random()) < chance) {
      out[tokenType] = 1;
    }
  }

  return out;
}

export function grantWeaponArtRunRewards(summary = {}, rng = Math.random) {
  const rewards = rollWeaponArtTokenRewards(summary, rng);
  if (Object.keys(rewards).length === 0) {
    return {
      rewards: {},
      inventory: getWeaponArtTokenInventory()
    };
  }
  const inventory = addWeaponArtTokens(rewards);
  return { rewards, inventory };
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

function buildOfferView(attackType, node, progress) {
  return {
    ...clone(node),
    currentRank: getPurchasedRank(progress, node.id),
    spentValueCost: getNodeRankCost(node),
    minSpentPoints: getBasicAttackNodeMinSpentPoints(attackType, node.id),
    draftCategory: getNodeDraftCategory(node)
  };
}

export function rollWeaponArtOffers(attackType, draftContext = {}, options = {}) {
  const progress = options.progress || getBasicAttackProgress(attackType);
  const count = Math.max(1, toFiniteInt(options.count, 3));
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const recentSkipped = new Set((draftContext?.recentSkippedNodeIds || []).map((id) => String(id)));
  const rerolledAway = new Set((draftContext?.rerolledAwayNodeIds || []).map((id) => String(id)));
  const biasCategory = draftContext?.biasCategory ? String(draftContext.biasCategory) : null;
  const lastDraftedCategory = draftContext?.lastDraftedCategory ? String(draftContext.lastDraftedCategory) : null;
  const allowedRarities = Array.isArray(options.allowedRarities) ? options.allowedRarities : null;
  const legalNodes = getLegalWeaponArtNodes(attackType, progress, { allowedRarities });
  const weighted = legalNodes.map((node) => {
    let weight = OFFER_BASE_WEIGHTS_BY_RARITY[String(node.rarity || "common").toLowerCase()] ?? 1;
    const nodeCategory = getNodeDraftCategory(node);
    if (lastDraftedCategory && nodeCategory === lastDraftedCategory) {
      weight *= 1.8;
    }
    if (biasCategory && nodeCategory === biasCategory) {
      weight *= 3;
    }
    if (recentSkipped.has(node.id)) {
      weight *= 0.6;
    }
    if (rerolledAway.has(node.id)) {
      weight *= 0.35;
    }
    return { item: node, weight };
  });
  return weightedSampleWithoutReplacement(weighted, count, rng).map((node) => buildOfferView(attackType, node, progress));
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
  if (!normalizedTokenType || !attackType) {
    return { ok: false, error: "invalid_token" };
  }
  if (choiceState.tokenUsed) {
    return { ok: false, error: "token_already_used" };
  }
  if (!(getWeaponArtTokenInventory()[normalizedTokenType] > 0)) {
    return { ok: false, error: "token_unavailable" };
  }

  const progress = getBasicAttackProgress(attackType);
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
    offers = rollWeaponArtOffers(attackType, rollContext, { count: 3, progress, rng: params?.rng });
    offerCount = 3;
  } else if (normalizedTokenType === "insight") {
    const category = String(params?.category || "");
    if (!getWeaponArtCategories(attackType).includes(category)) {
      return { ok: false, error: "invalid_category" };
    }
    biasCategory = category;
    offers = rollWeaponArtOffers(attackType, {
      ...rollContext,
      biasCategory
    }, { count: 3, progress, rng: params?.rng });
    offerCount = 3;
  } else if (normalizedTokenType === "expansion") {
    offers = rollWeaponArtOffers(attackType, rollContext, { count: 6, progress, rng: params?.rng });
    offerCount = 6;
  } else if (normalizedTokenType === "precision") {
    offers = getLegalWeaponArtNodes(attackType, progress, {
      allowedRarities: ["common", "uncommon"]
    }).map((node) => buildOfferView(attackType, node, progress));
    directSelect = true;
    offerCount = offers.length;
  }

  if (offers.length === 0) {
    return { ok: false, error: "no_legal_offers" };
  }

  const inventory = consumeWeaponArtToken(normalizedTokenType);
  if (!inventory) {
    return { ok: false, error: "token_unavailable" };
  }

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

function applyNodePurchase(entry, attackType, nodeId) {
  const node = getBasicAttackNode(attackType, nodeId);
  if (!node) return null;
  const next = clone(entry);
  next.purchasedRanks[nodeId] = getPurchasedRank(next, nodeId) + 1;
  if (next.pendingPickCount > 0) {
    next.pendingPickCount = Math.max(0, next.pendingPickCount - 1);
  }
  if ((node.type === "evolution_first" || node.type === "evolution_second") && !next.selectedEvolutionIds.includes(nodeId)) {
    next.selectedEvolutionIds.push(nodeId);
  }
  return saveProgressEntry(attackType, next);
}

export function resolveWeaponArtDraftChoice(attackType, nodeId, choiceState = null) {
  const entry = getBasicAttackProgress(attackType);
  if ((entry.pendingPickCount || 0) <= 0) return null;
  if (!canPurchaseBasicAttackNode(attackType, nodeId, entry)) return null;
  const normalizedChoiceState = choiceState ? normalizeChoiceState(choiceState) : null;
  if (normalizedChoiceState && normalizedChoiceState.attackType && normalizedChoiceState.attackType !== attackType) {
    return null;
  }
  if (normalizedChoiceState && normalizedChoiceState.offers.length > 0 && !normalizedChoiceState.offers.includes(String(nodeId))) {
    return null;
  }
  return applyNodePurchase(entry, attackType, nodeId);
}

export function addBasicAttackXp(attackType, amount) {
  if (!attackType || amount <= 0) return getBasicAttackProgress(attackType);
  const tree = getBasicAttackTree(attackType);
  if (!tree) return null;
  const current = getBasicAttackProgress(attackType);
  const next = clone(current);
  const previousLevel = current.level || 1;
  next.xp = Math.max(0, Number(next.xp || 0) + Number(amount || 0));
  next.level = getLevelForXp(tree, next.xp);
  const levelsGained = Math.max(0, next.level - previousLevel);
  next.pendingPickCount = Math.min(
    getRemainingRankSlots(attackType, next),
    Math.max(0, toFiniteInt(next.pendingPickCount, 0)) + levelsGained
  );
  return saveProgressEntry(attackType, next);
}

export const addWeaponArtXp = addBasicAttackXp;

export function getPendingWeaponArtTypes() {
  const all = getAllBasicAttackProgress();
  return Object.keys(all).filter((attackType) => (all[attackType]?.pendingPickCount || 0) > 0);
}

export function hasPendingWeaponArtChoices() {
  return getPendingWeaponArtTypes().length > 0;
}

export function buildRunAttackStateFromProgress(attackType, progress = null) {
  const tree = getBasicAttackTree(attackType);
  const entry = progress || getBasicAttackProgress(attackType);
  const runAttackUpgrades = [];
  const categoryCounts = {};
  let elementalShotEvolutionFirst = null;
  let elementalShotEvolutionSecond = null;
  let soulSiphonEvolutionFirst = null;
  let soulSiphonEvolutionSecond = null;
  let bladeBlastTier1EvolutionId = null;
  let bladeBlastTier2EvolutionId = null;

  for (const node of tree?.nodes || []) {
    const rank = getPurchasedRank(entry, node.id);
    if (rank <= 0) continue;
    if (node.type === "upgrade") {
      const def = getAttackUpgradeDefById(attackType, node.upgradeId);
      if (!def) continue;
      for (let i = 0; i < rank; i += 1) {
        runAttackUpgrades.push({
          id: def.id,
          name: def.name,
          description: def.description,
          category: def.category,
          level: 1,
          maxLevel: def.maxLevel,
          value: getDeterministicUpgradeValue(def),
          percent: !!def.valueRange?.percent
        });
      }
      categoryCounts[def.category] = (categoryCounts[def.category] || 0) + rank;
      continue;
    }
    if (node.type === "evolution_first") {
      if (attackType === "projectile") {
        elementalShotEvolutionFirst = node.evolutionCategory || null;
      } else if (attackType === "soulSiphon") {
        soulSiphonEvolutionFirst = node.evolutionCategory || null;
      } else if (attackType === "bladeBlast") {
        bladeBlastTier1EvolutionId = node.evolutionId || null;
      }
      continue;
    }
    if (node.type === "evolution_second") {
      if (attackType === "projectile") {
        elementalShotEvolutionSecond = node.secondCategory || null;
      } else if (attackType === "soulSiphon") {
        soulSiphonEvolutionSecond = node.secondCategory || null;
      } else if (attackType === "bladeBlast") {
        bladeBlastTier2EvolutionId = node.evolutionId || null;
      }
    }
  }

  const weaponEvolutionState = {};
  if (attackType === "bladeBlast") {
    weaponEvolutionState[BLADE_BLAST_BASE_WEAPON_ID] = {
      tier1Id: bladeBlastTier1EvolutionId,
      tier2Id: bladeBlastTier2EvolutionId
    };
  }

  return {
    runAttackUpgrades,
    runAttackPenalties: [],
    categoryCounts,
    elementalShotEvolutionFirst,
    elementalShotEvolutionSecond,
    soulSiphonEvolutionFirst,
    soulSiphonEvolutionSecond,
    bladeBlastTier1EvolutionId,
    bladeBlastTier2EvolutionId,
    weaponEvolutionState,
    weaponEvolutions: attackType === "bladeBlast" && bladeBlastTier1EvolutionId
      ? { [BLADE_BLAST_BASE_WEAPON_ID]: bladeBlastTier2EvolutionId || bladeBlastTier1EvolutionId }
      : {}
  };
}

export function getBasicAttackTreeSummary(attackType, progress = null) {
  const entry = progress || getBasicAttackProgress(attackType);
  const tree = getBasicAttackTree(attackType);
  const xpInLevel = Math.max(0, entry.xp - getXpForBasicAttackLevel(entry.level));
  const xpToNext = entry.level >= (tree?.maxLevel || 1)
    ? 0
    : Math.max(0, getXpForBasicAttackLevel(entry.level + 1) - getXpForBasicAttackLevel(entry.level));
  return {
    ...entry,
    maxLevel: tree?.maxLevel || 1,
    maxSpentValue: tree?.maxSpentValue || 0,
    spentValue: getBasicAttackSpentValue(attackType, entry),
    purchasedRankCount: getTotalPurchasedRankCount(entry),
    totalRankCount: tree?.totalRankCount || 0,
    xpInLevel,
    xpToNext
  };
}

export function getWeaponArtProgressSummary(attackType, progress = null) {
  return getBasicAttackTreeSummary(attackType, progress);
}

// Legacy test/debug helpers retained for non-UI callers.
export function purchaseBasicAttackNode(attackType, nodeId) {
  const entry = getBasicAttackProgress(attackType);
  if (!canPurchaseBasicAttackNode(attackType, nodeId, entry)) return false;
  return !!applyNodePurchase({
    ...entry,
    pendingPickCount: Math.max(1, toFiniteInt(entry.pendingPickCount, 0))
  }, attackType, nodeId);
}

export function refundBasicAttackTree(attackType) {
  const current = getBasicAttackProgress(attackType);
  const reset = {
    ...current,
    pendingPickCount: Math.max(0, current.level - 1),
    purchasedRanks: {},
    selectedEvolutionIds: []
  };
  saveProgressEntry(attackType, reset);
  return true;
}
