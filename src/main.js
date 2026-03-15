import { Vec2, pointToSegmentDist, escapeHtml } from './utils.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { Player } from './player.js';
import {
  DIFFICULTY_CONDITION_COUNTS, DIFFICULTY_STAT_MULTIPLIER,
  TALENTS_KEY, SKILL_UNLOCKS_KEY, SKILL_LEVELS_KEY,
  SKILL_MOD_SOCKETS_KEY, MOD_CARDS_INVENTORY_KEY,
  SKILL_XP_CURVE, SKILL_MAX_LEVEL, SKILL_SLOT_UNLOCK, DEV_MODE_ENABLED,
  getXpForSkillLevel, getSkillLevels, setSkillLevels, getSkillLevel, getSkillXp,
  markSkillEncountered, addSkillXp, getModSlotsForSkillLevel,
  getSkillModSockets, setSkillModSockets,
  getModCardInventory, addModCardToInventory, removeModCardFromInventoryAtIndex,
  getSkillUnlocks, setSkillUnlock,
  getHighestCompletedDifficulty, markDifficultyCompleted, getAvailableSkillSlots
} from './data/constants.js';
import { OBSTACLE_TYPES } from './data/obstacles.js';
import { SHRINE_DEFS, EVENT_DEFS } from './data/shrines.js';
import {
  TALENT_TREE, getPurchasedTalents, purchaseTalent, hasTalent,
  canRefundTalent, refundTalent, refundBranch
} from './data/talents.js';
import {
  SKILL_CATEGORIES, SKILL_DEFS, MODIFICATION_CARD_DEFS, MODIFICATION_CARD_CATEGORIES,
  DELIVERY_TRIGGER_MOD_IDS,
  getModsForSkillSlot, getModEffectMult, applyElementDebuffsFromMods,
  isSkillUnlocked, getUnlockedSkills
} from './data/skills.js';
import { RUN_CONDITIONS, ATTACK_TYPES, pickRandomConditions } from './data/conditions.js';
import { MAP_WIDTH, MAP_HEIGHT, WALL_THICKNESS, MAP_DEFS, World } from './data/maps.js';
import {
  ATTACK_UPGRADE_DEFS, CONTRADICTORY_UPGRADE_PENALTY,
  getUpgradeDisplayDescription, getPenaltyDisplayDescription,
  getAggregatedUpgradeEffect, getAggregatedPenaltyEffect,
  rollUpgradeValue
} from './data/level-up-data.js';
import {
  EQUIPMENT_BASE_STAT, EQUIPMENT_BASE_NAMES, EQUIPMENT_BASE_RANGES,
  EQUIPMENT_SECONDARY_BASE, WEIGHT_OPTIONS,
  MODIFIER_POOL, ARMOUR_SLOT_TYPES, LOCAL_STAT_SCALE_MOD_IDS,
  getModifierPoolForType, rollLocalStatScaleValue,
  MODIFIER_ROLL_BY_DIFFICULTY, LOCAL_STAT_SCALE_ROLL_BY_DIFFICULTY,
  rollModifierValueForDifficulty, rollLocalStatScaleValueForDifficulty,
  NAME_PREFIXES, NAME_SUFFIXES,
  RARITY_COLORS, LOOT_DEFS, LOOT_COLORS, LOOT_ICONS,
  GLOBAL_LUCK, setGlobalLuck, rollModifierValue, getRarityRoll, generateEquipmentItem
} from './data/loot-data.js';
import {
  LEGENDARY_CUBES, LEGENDARY_MODIFIER_IDS, LEGENDARY_MODIFIER_EFFECTS,
  BLESSING_DEFS,
  MODIFIER_CUBE_TIERS, MODIFIER_CUBES, UPGRADE_CUBES,
  getCubeLabel, rollModifierForTier, getModifierPoolEntry
} from './data/cubes-data.js';


import { Obstacle } from './entities/obstacle.js';
import { HazardSystem } from './entities/hazard.js';
import {
  ENEMY_TYPES, BOSS_XP, AFFIX_DEFS, getAffixDef, getXpForLevel,
  Enemy
} from './entities/enemy.js';
import {
  PLAYER_PROJECTILE_SPEED, PLAYER_PROJECTILE_SIZE, PLAYER_PROJECTILE_MAX_DIST,
  PlayerProjectile, Projectile
} from './entities/projectile.js';
import { Boss, BOSS_MAX_HP, BOSS_ATTACK, BOSS_BASE_SPEED, BOSS_SIZE } from './entities/boss.js';
import { EnemySystem } from './entities/enemy-system.js';
import { LootItem, LootSystem } from './entities/loot.js';

// -------- Game orchestration --------
// Game class has been moved to src/game/game.js
// Re-export for backward compatibility
export { Game } from './game/game.js';

// UI imports (for backward compatibility if needed)
import {
  loadConquerorVault, addConquerorBonusItem,
  loadLegacyCubeStash, addToLegacyCubeStash, consumeLegacyCubeStash,
  restoreEternalItemsFromDefeat, loadSavedCharacters, buildLegacyVault
} from './ui/save-system.js';
import {
  formatItemStats, formatItemModifiers, getItemRarityColor,
  buildItemTooltipContent, showItemTooltip, hideItemTooltip
} from './ui/tooltips.js';
import { renderHallOfChampions } from './ui/hall-of-champions.js';
import {
  openLegacyVault, closeLegacyVault, getSelectedLegacyItems, deleteLegacySelectedItems
} from './ui/legacy-vault.js';
import {
  openSkillLibrary, closeSkillLibrary
} from './ui/skill-library.js';
import {
  openTalentTree, closeTalentTree
} from './ui/talent-tree-ui.js';
import { refreshMainMenuLP, openInstructions, closeInstructions } from './ui/main-menu.js';
import {
  showPreRunScreen, setPreRunDifficulty, rerollPreRunConditions,
  acceptPreRunAndStart, showSkillSelectScreen, confirmSkillSelectAndStart,
  setStartGameCallback, renderPreRunScreen
} from './ui/pre-run.js';


// (Legacy vault, skill library, talent tree, pre-run, and skill-select screens
//  have been extracted to src/ui/ modules above.)

// bootstrap() and startGame() have been moved to src/bootstrap.js
// They are imported and used there.

