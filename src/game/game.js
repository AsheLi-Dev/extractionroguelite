import { Vec2, pointToSegmentDist, segmentsIntersect, escapeHtml, obstacleIntersectsRect, getObstacleCollisionRect } from '../utils.js';
import { ParticlePool, TransientVFX } from '../utils/particles.js';
import { Input } from '../input.js';
import { Camera } from '../camera.js';
import { Player } from '../player.js';
import {
  DIFFICULTY_CONDITION_COUNTS, LP_PER_DIFFICULTY, DIFFICULTY_STAT_MULTIPLIER,
  LEGACY_POINTS_KEY, TALENTS_KEY, SKILL_UNLOCKS_KEY, SKILL_LEVELS_KEY,
  SKILL_MOD_SOCKETS_KEY, MOD_CARDS_INVENTORY_KEY,
  SKILL_XP_CURVE, SKILL_MAX_LEVEL, SKILL_SLOT_UNLOCK, DEV_MODE_ENABLED,
  PLAYER_WALL_COLLISION_INSET,
  getXpForSkillLevel, getSkillLevels, setSkillLevels, getSkillLevel, getSkillXp,
  markSkillEncountered, addSkillXp, getModSlotsForSkillLevel,
  getSkillModSockets, setSkillModSockets,
  getModCardInventory, addModCardToInventory, removeModCardFromInventoryAtIndex,
  getLegacyPoints, addLegacyPoints,
  getSkillUnlocks, setSkillUnlock,
  getHighestCompletedDifficulty, markDifficultyCompleted, getAvailableSkillSlots
} from '../data/constants.js';
import { OBSTACLE_TYPES } from '../data/obstacles.js';
import { rollGoldDrop } from './economy.js';
import { SHRINE_DEFS, EVENT_DEFS } from '../data/shrines.js';
import {
  TALENT_TREE, getPurchasedTalents, purchaseTalent, hasTalent,
  canRefundTalent, refundTalent, refundBranch
} from '../data/talents.js';
import {
  SKILL_CATEGORIES, SKILL_DEFS, MODIFICATION_CARD_DEFS, MODIFICATION_CARD_CATEGORIES,
  DELIVERY_TRIGGER_MOD_IDS,
  getModsForSkillSlot, getModEffectMult, applyElementDebuffsFromMods,
  isSkillUnlocked, getUnlockedSkills
} from '../data/skills.js';
import { RUN_CONDITIONS, ATTACK_TYPES, pickRandomConditions, enforceConditionLimits } from '../data/conditions.js';
import { MAP_WIDTH, MAP_HEIGHT, WALL_THICKNESS, MAP_DEFS, World, createProceduralWorld, PRESET_MEDIUM } from '../data/maps.js';
import {
  ATTACK_UPGRADE_DEFS, CONTRADICTORY_UPGRADE_PENALTY,
  getUpgradeDisplayDescription, getPenaltyDisplayDescription,
  getAggregatedUpgradeEffect, getAggregatedPenaltyEffect,
  rollUpgradeValue
} from '../data/level-up-data.js';
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
} from '../data/loot-data.js';
import {
  LEGENDARY_CUBES, LEGENDARY_MODIFIER_IDS, LEGENDARY_MODIFIER_EFFECTS,
  BLESSING_DEFS,
  MODIFIER_CUBES, UPGRADE_CUBES,
  getCubeLabel, rollModifierForTier, getModifierPoolEntry, getModifierRollRangeForTier, getCubeDifficultyForTier
} from '../data/cubes-data.js';


import { Obstacle } from '../entities/obstacle.js';
import { HazardSystem } from '../entities/hazard.js';
import {
  ENEMY_TYPES, BOSS_XP, AFFIX_DEFS, getAffixDef, getXpForLevel,
  Enemy
} from '../entities/enemy.js';
import {
  PLAYER_PROJECTILE_SPEED, PLAYER_PROJECTILE_SIZE, PLAYER_PROJECTILE_MAX_DIST,
  PlayerProjectile, Projectile
} from '../entities/projectile.js';
import { Boss, BOSS_MAX_HP, BOSS_ATTACK, BOSS_BASE_SPEED, BOSS_SIZE } from '../entities/boss.js';
import { EnemySystem } from '../entities/enemy-system.js';
import { LootItem, LootSystem } from '../entities/loot.js';
import { play as playSfx, stopBgm } from '../audio.js';
import {
  spawnFanStrikeVfx,
  onFanStrikeHitEnemy,
  updateFanStrikeVfx,
  renderFanStrikeVfx,
  HIT_STOP_MS,
  CAMERA_SHAKE_INTENSITY,
  CAMERA_SHAKE_DURATION
} from '../vfx/fanStrikeVfx.js';
import { refreshMainMenuLP } from '../ui/main-menu.js';
import { consumeLegacyCubeStash, loadSavedCharacters, addConquerorBonusItem, addToLegacyCubeStash } from '../ui/save-system.js';
import { getAttackEvolutionById } from '../data/attack-evolutions.js';
import {
  ensureRingRuntime,
  tickRingEffects,
  onRingDashUsed,
  applyRingIncomingDamageMods,
  onRingPlayerDamaged,
  onRingEnemyKilled,
  onRingBreakableDestroyed,
  tryProcBattleRhythm,
  getRingDamageMultiplierForHit,
  tryProcEchoEngine,
  hasRing,
  getRingCount,
  getRingAttackSpeedMultiplier,
  getRingMoveSpeedMultiplier,
  tryProcMirrorFang,
  syncFocusCharges,
  tryConsumeFocusCharge,
  onSkillReadyRefillFocus,
  onRingSkillCooldownRestored,
  tryGuardianPreDeath
} from './ring-effects.js';

// Import mixin modules
import { applyGameCoreMixin } from './game-core.js';
import { applyGameDevMixin } from './game-dev.js';
import { applyGameInventoryMixin } from './game-inventory.js';
import { applyGameVictoryMixin } from './game-victory.js';
import { applyGameStatsMixin } from './game-stats.js';
import { applyGameUIMixin } from './game-ui.js';
import { applyGameLevelUpMixin } from './game-levelup.js';
import { applyGameInputMixin } from './game-input.js';
import { applyGameLootMixin } from './game-loot.js';
import { applyGameCollisionMixin } from './game-collision.js';
import { getWallCollisionRect } from '../utils.js';
import { applyGameMapMixin } from './game-map.js';
import { applyGameEventsMixin } from './game-events.js';
import { applyGameEnemyAttacksMixin } from './game-enemy-attacks.js';
import { TutorialSystem } from '../ui/tutorial.js';
import {
  buildSkillContext as buildSkillContextBase,
  computeSkillMultipliers,
  collectAllPlayerModifiers
} from './skill-context.js';
import {
  ensureRunInventoryState,
  normalizeAllEquipmentVessels,
  recomputeAncestorState,
  tickAncestorSystem,
  handleAncestorOnPlayerDamaged,
  handleAncestorOnHit,
  handleAncestorOnSkillCast,
  getAncestorMoveSpeedMult,
  getAncestorSearchSpeedMult,
  getAncestorBreakableDamageMult,
  getAncestorOutgoingDamageMult,
  getAncestorIncomingDamageMult,
  handleAncestorOnEnemyKilled,
  handleAncestorOnBreakableDestroyed,
  handleAncestorOnChestOpened,
  notifyAncestorDebuffApplied,
  mirrorAncestorDebuffToPlayer,
  tickEnemyBleed,
  getSkillFlatDamageBonus,
  grantSpirit as grantAncestorSpiritById,
  grantVesselCube as grantAncestorVesselCube,
  printActiveSpiritsAndClans as printAncestorSummary
} from './ancestor-system.js';

const DASH_CHARGE_ICON_FULL_SRC = "assets/UI/UI_TravelBook_IconEnergy01a.png";
const DASH_CHARGE_ICON_EMPTY_SRC = "assets/UI/UI_TravelBook_IconEnergy01g.png";
const DESIGN_WIDTH = 640;
const DESIGN_HEIGHT = 360;
const CAMERA_VIEW_WIDTH = 832;
const CAMERA_VIEW_HEIGHT = 468;

// -------- Game Class --------
// Game class constructor and property initialization.
// Methods are added via mixin modules.

export class Game {
  constructor(canvas, legacyItems = [], runConfig = {}) {
    this.runConfig = runConfig;
    this.difficulty = runConfig.difficulty ?? 1;
    this.conditions = enforceConditionLimits(runConfig.conditions ?? []);
    this.skills = runConfig.skills || [null, null, null, null];
    this.attackType = runConfig.attackType || "projectile";
    (this.skills || []).forEach((id) => { if (id) markSkillEncountered(id); });
    this.skillCooldowns = [0, 0, 0, 0];
    this.skillEffects = [];
    this.hitStopRemaining = 0;
    this.cameraShakeUntil = 0;
    this.cameraShakeAmount = 0;
    this.skillChargeSlot = null;
    this.skillChargeStartTime = null;
    this.chainCastQueue = [];
    this.empowerStacks = [0, 0, 0, 0];
    this.playerHasteUntil = 0;
    this.playerHasteMult = 1;
    this.skillCascadeFlashUntil = {};
    this.devModOverrides = { 0: [], 1: [], 2: [], 3: [] };
    this.activeAuras = new Set();
    this.whirlwindActive = false;
    this.bladeDashActive = false;
    this.bladeDashTimer = 0;
    this.bladeDashDirection = new Vec2(0, 0);
    this.bladeDashSpeed = 600;
    this.bladeDashMult = 0.8;
    this.bladeDashHitIds = new Set();
    this.earthquakeShakeUntil = 0;
    this.iceShardHitsThisRun = 0;
    this.damageSkillsUsedThisRun = new Set();
    this.phoenixInvulnUntil = 0;
    this.timeWarpUntil = 0;
    this.hasCondition = (id) => this.conditions.some((c) => c.id === id);

    this.eventsOccurredThisRun = new Set();
    this.escortQuest = null;
    this.pendingMerchantInvestment = null;
    this.lpMultiplier = 1;
    this.cursedChestBlocked = false;
    this.fierySpawned = false;
    this.fieryKilled = false;
    this.fieryTimer = 0;
    this.rogueNpcRunEnabled = Math.random() < 0.5;
    this.rogueNpcSpawned = false;

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.lastTime = 0;
    this.time = 0;
    this._destroyed = false;
    this._rafId = null;
    this._listenerAbortController = new AbortController();
    this._listenerSignal = this._listenerAbortController.signal;

    this.input = new Input({ signal: this._listenerSignal });

    this.inventory = legacyItems.map((item, i) => ({
      id: 10000 + i,
      name: item.name,
      type: item.type,
      ringId: item.ringId || null,
      ringSpriteKey: item.ringSpriteKey || null,
      consumedOnTrigger: !!item.consumedOnTrigger,
      rolledModifiers: item.rolledModifiers || null,
      spriteCell: item.spriteCell || null,
      stats: item.stats || {},
      cardKey: item.cardKey || null,
      description: item.description || "",
      weight: item.weight || null,
      rarity: item.rarity || null,
      modifiers: item.modifiers || [],
      baseStat: item.baseStat || null,
      sockets: item.sockets ?? 0,
      vesselsMax: item.vesselsMax ?? 0,
      vessels: Array.isArray(item.vessels) ? item.vessels : []
    }));
    this.runInventory = {
      ancestorSpirits: [],
      ancestorSpiritRegistry: {}
    };
    this.selectedAncestorSpiritId = null;
    ensureRunInventoryState(this);
    if (hasTalent("livingItem")) {
      const firstCommon = this.inventory.find((it) => it.type !== "Upgrade Card" && (it.rarity === "common" || !it.rarity));
      if (firstCommon) firstCommon.livingItem = true;
    }
    this.cubeInventory = {};
    const stash = consumeLegacyCubeStash();
    for (const [key, count] of Object.entries(stash)) {
      this.cubeInventory[key] = (this.cubeInventory[key] || 0) + count;
    }
    this.inventoryListEl = document.getElementById("inventory-list");
    this.equippedListEl = document.getElementById("equipped-list");
    this.playerStatsEl = document.getElementById("player-stats");
    this.devToggleEl = document.getElementById("dev-toggle");
    this.devPanelEl = document.getElementById("dev-panel");
    this.devGiveAllEl = document.getElementById("dev-give-all");
    this.devMaxStatsEl = document.getElementById("dev-max-stats");
    this.devCardListEl = document.getElementById("dev-card-list");
    this.devCloseEl = document.getElementById("dev-close");

    this.devMode = !!runConfig.devMode;
    this.devStatsOverride = null;
    this.devAttackCooldownOverride = null; // Dev override for attack cooldown
    this.debugDrawObstacleHitboxes = false;
    this.debugDrawPlayerHitbox = false;
    this.debugDrawNpcScale = false;
    this.baseStats = {
      maxHealth: 100,
      defense: 0,
      speed: 220,
      attack: 10
    };
    if (!this.devMode) {
      if (hasTalent("resilient")) this.baseStats.maxHealth = Math.round(this.baseStats.maxHealth * 1.1);
      if (hasTalent("fortitude")) this.baseStats.maxHealth = Math.round(this.baseStats.maxHealth * 1.1);
      if (hasTalent("thickSkin")) this.baseStats.maxHealth = Math.round(this.baseStats.maxHealth * 1.15);
      if (hasTalent("fierce")) this.baseStats.attack = Math.round(this.baseStats.attack * 1.1);
      if (hasTalent("nimble")) this.baseStats.speed = Math.round(this.baseStats.speed * 1.05);
      if (this.hasCondition("startHealth")) this.baseStats.maxHealth = Math.max(10, this.baseStats.maxHealth - 30);
      if (this.hasCondition("startAttack")) this.baseStats.attack = Math.round(this.baseStats.attack * 0.8);
      if (this.hasCondition("startSpeed")) this.baseStats.speed = Math.round(this.baseStats.speed * 0.8);
    }
    this.talentAttackSpeedMult = hasTalent("rapid") ? 1.1 : 1;
    this.currentStats = { ...this.baseStats };
    this.currentHealth = this.baseStats.maxHealth;
    this.timeSinceLastHit = 0;
    this.damageFlashTimer = 0; // Timer for red screen flash when player takes damage

    // VFX systems
    this.particlePool = new ParticlePool(300);
    this.transientVFX = new TransientVFX();
    this.playerDebuffVFX = {
      weakening: { active: false, until: 0, streakTimer: 0 },
      slow: { active: false, until: 0 },
      burn: { active: false, until: 0, emberTimer: 0 },
      weaken: { active: false, until: 0, crackTimer: 0 },
      stun: { active: false, until: 0 }
    };
    this._weakeningShards = [];
    this._weakeningRingTime = null;

    this.equipment = {
      Helmet: null,
      "Body Armour": null,
      Weapon: null,
      Boots: null,
      Ring1: null,
      Ring2: null
    };
    normalizeAllEquipmentVessels(this);

    this.level = 1;
    this.enemiesKilled = 0;
    this.xp = 0;
    this.gold = 0;
    this.legacyPointsEarnedThisRun = 0;
    this.shopRerollCountByShopId = {};
    this.itemServiceRerollCountByItemId = {};
    this.lootHoarderUntil = 0;
    this.levelUpChoices = null;
    this.runAttackUpgrades = [];
    this.runAttackPenalties = [];
    this.upgradeOnlyStats = { attackDamagePct: 0, projectileRangePct: 0, attackSpeedPct: 0 };
    this.weaponEvolutions = {};
    this.evolutionGroupSelections = {};
    this.loggedEvolutionAvailability = {};
    this.clearedMaps = new Set();
    this.visitedMaps = new Set();
    this.mapEnemyStates = {}; // Store enemy state for each map
    this.mapEnvironmentalStates = {}; // Store obstacles and sub-areas for each map
    this.shrineSpawnInterval = 2 + Math.floor(Math.random() * 3); // Random 2-4
    this.shrineSpawnCounter = 0;
    // Spawn a shop every 35 newly visited maps (starting map counts as 1).
    this.shopSpawnInterval = 3 + Math.floor(Math.random() * 3); // 3-5
    this.shopSpawnCounter = 1;
    this.shrineInteractions = [];
    this.frenzyBuffUntil = 0;
    this.trialBosses = [];
    this.trialTimer = 0;
    this.trialCompleted = false;
    this.equipmentAttackSpeedMult = 1;
    this.equipmentCooldownRecovery = 1;
    this.equipmentXpGainedMult = 1;
    this.equipmentSkillDamageMult = 1;
    this.equipmentSpeedMult = 1;
    this.equipmentDashCooldownMult = 1;

    this.swiftFeetTimer = 0;
    this.ironSkinTimer = 0;
    this.ironSkinShieldReady = false;
    this.doubleStrikeCounter = 0;
    this.ghostStepTimer = 0;
    this.secondWindUsed = false;
    this.immortalShield = 0;
    this.jackpotUsed = false;
    this.wildCardRerollUsed = false;
    this.levelUpRerollsRemaining = 0;

    this.viewWidth = CAMERA_VIEW_WIDTH;
    this.viewHeight = CAMERA_VIEW_HEIGHT;

    const useProceduralMap = runConfig.useProceduralMap !== false;
    this.useProceduralMap = useProceduralMap;

    if (useProceduralMap) {
      const seed = (runConfig.seed ?? Date.now()) ^ 0;
      const { world, startPixel } = createProceduralWorld(PRESET_MEDIUM, seed, MAP_DEFS[0]);
      this.world = world;
      this.proceduralSeed = seed;
    } else {
      this.world = new World(MAP_WIDTH, MAP_HEIGHT);
    }

    // Check if tutorial mode
    this.tutorialMode = runConfig.tutorial === true;
    
    this.currentMapId = 0;
    this.currentMap = MAP_DEFS[0];
    this.world.setTheme(this.currentMap);
    this.roguesAtlas = new Image();
    this.roguesAtlas.src = "assets/images/rogues.png";
    this.enemyDeathSmokeSheet = new Image();
    this.enemyDeathSmokeSheet.src = "assets/images/Free Smoke Fx  Pixel 05.png";
    this.enemyDeathSmokeVfx = [];
    this.enemyDeathSmokeFrameW = 64;
    this.enemyDeathSmokeFrameH = 64;
    this.enemyDeathSmokeFrames = 11;
    this.enemyDeathSmokeFps = 20;
    this.dashChargeIconFull = new Image();
    this.dashChargeIconFull.src = DASH_CHARGE_ICON_FULL_SRC;
    this.dashChargeIconEmpty = new Image();
    this.dashChargeIconEmpty.src = DASH_CHARGE_ICON_EMPTY_SRC;

    const margin = this.world.wallThickness + 60;
    const centerY = this.world.height / 2 - 24;
    const playerSize = 100; // Player.size from constructor
    let spawnX = margin;
    let spawnY = centerY;
    if (useProceduralMap && this.world.startPixel) {
      const ts = this.world.tileSize;
      spawnX = this.world.startPixel.x + ts; // One tile in from left edge
      spawnY = this.world.startPixel.y + ts / 2 - playerSize / 2;
      spawnX = Math.max(ts, Math.min(spawnX, this.world.width - ts - playerSize));
      spawnY = Math.max(ts, Math.min(spawnY, this.world.height - ts - playerSize));
    }
    this.player = new Player(spawnX, spawnY);
    
    // Initialize tutorial system if in tutorial mode
    if (this.tutorialMode) {
      this.tutorialSystem = new TutorialSystem(this);
      // Setup tutorial button handlers
      const skipBtn = document.getElementById("tutorial-skip");
      if (skipBtn) {
        this.addManagedListener(skipBtn, "click", () => {
          if (this.tutorialSystem) this.tutorialSystem.skip();
        });
      }
    } else {
      this.tutorialSystem = null;
    }

    this.lootSystem = new LootSystem(this.world);
    const lootQual = this.currentMap.lootQuality;
    this.lootSystem.setMapLootQuality(lootQual);
    this.lootSystem.setDifficulty(this.difficulty);

    // Initialize mapInteractables before spawnObstacles (which checks for overlaps)
    this.mapInteractables = [];
    // Initialize map environment containers before first spawn pass.
    this.obstacles = [];
    this.breakables = [];
    this.searchableProps = [];
    
    if (hasTalent("socketFinder") && Math.random() < 0.2) {
      const m = this.world.wallThickness + 80;
      this.mapInteractables.push({
        type: "socketWorkshop",
        x: m + Math.random() * (this.world.width - 2 * m - 64),
        y: m + Math.random() * (this.world.height - 2 * m - 64),
        w: 64,
        h: 64
      });
    }
    this.spawnMapNpcsForVisit(this.currentMapId);
    
    // Spawn obstacles on initial map
    this.spawnObstacles(this.currentMapId);
    this.spawnBreakablesForMap(this.currentMap, () => Math.random());
    this.spawnSearchableProps(this.currentMap, () => Math.random());

    // Save environmental state for initial map
    this.saveMapEnvironmentalState(this.currentMapId);
    this.visitedMaps.add(this.currentMapId);
    
    // Spawn enemies after sub-areas so we can check for room overlaps
    this.enemySystem = new EnemySystem(this.world, this.currentMap, this.conditions, this.difficulty);
    
    // Tutorial mode: spawn specific enemies for tutorial steps
    if (this.tutorialMode) {
      this.setupTutorialMap();
    } else {
      this.enemySystem.spawnInitial(this);
    }

    this.hazardSystem = new HazardSystem(this.world, this.conditions);

    this.toxicGroundTimer = 0;
    this.burningGroundTimer = 0;
    this.stunTimer = 0;
    this.playerSlowUntil = 0;
    this.playerSlowMult = 1;
    this.playerBurnUntil = 0;
    this.playerBurnDamage = 0;
    this.playerWeakenUntil = 0;
    this.playerSlowUntil = 0;
    this.playerBurnUntil = 0;
    this.playerBurnDmg = 0;
    this.playerCursedWeakenUntil = 0;
    this.lastDamagingEnemy = null;

    this.mapNameEl = document.getElementById("map-name");
    this.enemyCountEl = document.getElementById("enemy-count");
    this.escortQuestIndicatorEl = document.getElementById("escort-quest-indicator");
    this.xpBarFillEl = document.getElementById("xp-bar-fill");
    this.xpLabelEl = document.getElementById("xp-label");
    this.playerLevelEl = document.getElementById("player-level");

    // Player projectile state
    this.playerProjectiles = [];
    this.playerAttackCooldown = 0.72;
    this.playerAttackTimer = 0;
    this.pulseOrbs = [];
    this.dashStrikeState = null;
    this.backfireDashState = null;
    this.doubleStrikeCounter = 0;

    this.exitTransitionCooldown = 0;
    this.victoryPortal = null;
    this.victoryPortalTimer = 0;
    this.bossExtractionTimerEnabled = true;
    this.bossExtractionDuration = 40;
    this.bossExtractionActive = false;
    this.bossExtractionTimeLeft = 0;
    // mapInteractables initialized earlier (before spawnObstacles)
    this.nearInteractable = null;
    this.nearSearchableProp = null;
    this.searchingProp = null;
    this.activeBlessings = [];

    this.dashDuration = 0.2;
    this.dashInvincibleStart = 0.1;
    this.dashInvincibleDuration = 0.1;
    let baseDash = hasTalent("swiftExtraction") ? 0.9 : 1.0;
    if (hasTalent("reflexes")) baseDash = Math.max(0.1, baseDash - 0.1);
    this.baseDashCooldownTime = baseDash;
    this.dashCooldownTime = this.baseDashCooldownTime;
    this.dashSpeedMult = 3;
    this.dashDistanceMult = 0.5;
    this.dashMaxCharges = 2;
    this.dashCharges = this.dashMaxCharges;
    this.dashRechargeTimer = 0;
    this.dashActive = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirection = new Vec2(0, 0);
    this.dashTrail = [];
    this.floatingCombatText = [];
    this.lastMouseWorld = { x: 0, y: 0 };
    this.spaceConsumed = false;
    this.mouseHeld = false;

    this.secureFootingUntil = 0;
    this.vaultMasterSecuredItemIds = new Set();
    this.vaultMasterSecureTransferred = false;
    this.cardSurgeUntil = 0;
    this.ghostLooterUntargetableUntil = 0;
    this.phantomExtractorUntil = 0;
    this.phantomExtractorCooldownUntil = 0;
    this.curatorUsedThisRun = false;
    ensureRingRuntime(this);

    this.gameOver = false;
    this.paused = false;
    this.inventoryOverlayOpen = false;
    this.gameOverEl = document.getElementById("game-over");
    this.gameOverMapsEl = document.getElementById("game-over-maps");
    this.gameOverEnemiesEl = document.getElementById("game-over-enemies");
    this.gameOverLevelEl = document.getElementById("game-over-level");
    this.pauseToggleEl = document.getElementById("pause-toggle");
    this.bossHealthBarEl = document.getElementById("boss-health-bar");
    this.bossHealthFillEl = document.getElementById("boss-health-fill");
    this.bossHealthLabelEl = document.getElementById("boss-health-label");

    this.camera = new Camera(this.viewWidth, this.viewHeight);

    this.updateInventoryUI();
    this.updateEquippedUI();
    this.recalculateStats();
    if (hasTalent("immortal")) this.immortalShield = 30;
    this.recalculateStats();
    syncFocusCharges(this);
    this.updateMapUI();
    this.updateXpUI();
    this.initDevUI();
    
    // Set up inventory API for friends system
    import('../ui/friends-ui.js').then(m => {
      m.setInventoryApi({
        canAdd: (item) => {
          // Simple check: assume inventory can always add items (no capacity limit in this game)
          return true;
        },
        add: (item) => {
          if (item.type === "Cube" && item.cubeKey) {
            this.addCubeToInventory(item.cubeKey);
          } else {
            // Add equipment item
            const newItem = {
              id: Date.now() + Math.random(),
              name: item.name,
              type: item.type,
              stats: item.stats || {},
              cardKey: item.cardKey || null,
              description: item.description || "",
              weight: item.weight || null,
              rarity: item.rarity || null,
              modifiers: item.modifiers || [],
              baseStat: item.baseStat || null,
              sockets: item.sockets ?? 0,
              vesselsMax: item.vesselsMax ?? 0,
              vessels: Array.isArray(item.vessels) ? item.vessels : []
            };
            this.inventory.push(newItem);
            this.updateInventoryUI();
          }
        }
      });
    }).catch(() => {});

    const tryAgainBtn = document.getElementById("game-over-try-again");
    if (tryAgainBtn) {
      this.addManagedListener(tryAgainBtn, "click", () => this.restartGame());
    }

    const mainMenuBtn = document.getElementById("game-over-main-menu");
    if (mainMenuBtn) {
      this.addManagedListener(mainMenuBtn, "click", () => this.returnToMainMenu());
    }

    const victorySaveBtn = document.getElementById("victory-save-btn");
    if (victorySaveBtn) {
      this.addManagedListener(victorySaveBtn, "click", () => this.saveCharacterAndReturnToMenu());
    }

    if (this.pauseToggleEl) {
      this.addManagedListener(this.pauseToggleEl, "click", () => this.togglePause());
    }

    const inventoryBtn = document.getElementById("inventory-button");
    if (inventoryBtn) {
      this.addManagedListener(inventoryBtn, "click", () => {
        if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
        else this.showInventoryOverlay();
      });
    }

    const inventoryCloseBtn = document.getElementById("inventory-overlay-close");
    if (inventoryCloseBtn) {
      this.addManagedListener(inventoryCloseBtn, "click", () => this.closeInventoryOverlay());
    }

    this.craftingSelectedItem = null;
    this.craftingSelectedCube = null;
    this.craftingItemSource = null;
    this._craftingPreviewFadeTimer = null;
    this.inventoryRightPageView = "crafting";

    const rightTabCrafting = document.getElementById("inventory-right-tab-crafting");
    const rightTabStats = document.getElementById("inventory-right-tab-stats");
    if (rightTabCrafting && rightTabStats) {
      this.addManagedListener(rightTabCrafting, "click", () => this.setInventoryRightPageView("crafting"));
      this.addManagedListener(rightTabStats, "click", () => this.setInventoryRightPageView("stats"));
    }

    const craftConfirm = document.getElementById("crafting-confirm");
    if (craftConfirm) {
      this.addManagedListener(craftConfirm, "click", () => this.executeCraft());
    }

    this.addManagedListener(window, "keydown", (e) => {
      if (e.key === "i" || e.key === "I") {
        if (!e.repeat && !this.gameOver && !this.levelUpChoices && !this.currentEvent) {
          if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
          else this.showInventoryOverlay();
        }
        return;
      }
      if (e.key === "c" || e.key === "C") {
        if (!e.repeat && !this.gameOver && !this.levelUpChoices && !this.currentEvent) {
          // Open inventory if not already open
          if (!this.inventoryOverlayOpen) {
            this.showInventoryOverlay();
          }
          this.setInventoryRightPageView("crafting");
        }
        return;
      }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        this.togglePause();
        return;
      }
      if (this.devMode && e.key === "F8" && !e.repeat) {
        e.preventDefault();
        this.debugDrawObstacleHitboxes = !this.debugDrawObstacleHitboxes;
        console.log(`[Dev] Obstacle hitbox overlay: ${this.debugDrawObstacleHitboxes ? "ON" : "OFF"}`);
        return;
      }
      if (this.devMode && e.key === "F9" && !e.repeat) {
        e.preventDefault();
        this.debugDrawPlayerHitbox = !this.debugDrawPlayerHitbox;
        console.log(`[Dev] Player hitbox overlay: ${this.debugDrawPlayerHitbox ? "ON" : "OFF"}`);
        return;
      }
      if (this.devMode && e.key === "F10" && !e.repeat) {
        e.preventDefault();
        this.debugDrawNpcScale = !this.debugDrawNpcScale;
        console.log(`[Dev] NPC scale overlay: ${this.debugDrawNpcScale ? "ON" : "OFF"}`);
      }
    });

    this.resizeCanvas();
    this.addManagedListener(window, "resize", () => this.resizeCanvas());
    this.addManagedListener(document, "fullscreenchange", () => this.resizeCanvas());
    this.addManagedListener(document, "webkitfullscreenchange", () => this.resizeCanvas());

    this.addManagedListener(this.canvas, "mousedown", (e) => this.onCanvasMouseDown(e));
    this.addManagedListener(this.canvas, "mouseup", (e) => { if (e.button === 0) this.mouseHeld = false; });
    this.addManagedListener(this.canvas, "mouseleave", () => this.mouseHeld = false);
    this.addManagedListener(window, "mouseup", (e) => { if (e.button === 0) this.mouseHeld = false; });
    this.addManagedListener(this.canvas, "mousemove", (e) => {
      this.lastMouseWorld = this.getWorldPositionFromScreen(e.clientX, e.clientY);
      this.updateAffixTooltip(e.clientX, e.clientY);
    });
    this.addManagedListener(this.canvas, "mouseleave", () => this.hideAffixTooltip());
    this.addManagedListener(window, "keydown", (e) => {
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        this.tryDash();
        // Track dash for tutorial
        if (this.tutorialSystem) this.tutorialSystem.onDash();
      }
    });
    this.addManagedListener(window, "keyup", (e) => {
      if (e.key === " ") this.spaceConsumed = false;
    });
    this.addManagedListener(window, "keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "1" && !e.repeat) this.tryCastSkill(0);
      if (k === "2" && !e.repeat) this.tryCastSkill(1);
      if (k === "3" && !e.repeat) this.tryCastSkill(2);
      if (k === "4" && !e.repeat) this.tryCastSkill(3);
    });
    this.addManagedListener(window, "keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "1") this.tryReleaseChargedSkill(0);
      if (k === "2") this.tryReleaseChargedSkill(1);
      if (k === "3") this.tryReleaseChargedSkill(2);
      if (k === "4") this.tryReleaseChargedSkill(3);
    });

    this._rafId = requestAnimationFrame((t) => this.loop(t));
  }

  addManagedListener(target, type, handler, options = undefined) {
    if (!target || !target.addEventListener) return;
    const opts = typeof options === "boolean"
      ? options
      : { ...(options || {}), signal: this._listenerSignal };
    target.addEventListener(type, handler, opts);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.paused = true;

    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._listenerAbortController) {
      this._listenerAbortController.abort();
      this._listenerAbortController = null;
      this._listenerSignal = null;
    }
    if (this.input && typeof this.input.destroy === "function") {
      this.input.destroy();
    }
  }

  resizeCanvas() {
    const cap = window.__gameResolutionCap || { width: 1920, height: 1080 };
    const presetId = window.__gameResolutionPresetId || "1080p";
    const isFullscreen = !!document.fullscreenElement;
    const containerWidth = isFullscreen
      ? window.innerWidth
      : Math.min(window.innerWidth, cap.width);
    const containerHeight = isFullscreen
      ? window.innerHeight
      : Math.min(window.innerHeight, cap.height);
    const containerLeft = Math.floor((window.innerWidth - containerWidth) / 2);
    const containerTop = Math.floor((window.innerHeight - containerHeight) / 2);
    const scale = Math.max(
      1,
      Math.floor(
        Math.min(
          containerWidth / DESIGN_WIDTH,
          containerHeight / DESIGN_HEIGHT
        )
      )
    );

    const displayWidth = DESIGN_WIDTH * scale;
    const displayHeight = DESIGN_HEIGHT * scale;
    const canvasLeft = containerLeft + Math.floor((containerWidth - displayWidth) / 2);
    const canvasTop = containerTop + Math.floor((containerHeight - displayHeight) / 2);

    this.canvas.width = DESIGN_WIDTH;
    this.canvas.height = DESIGN_HEIGHT;
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.canvas.style.position = "absolute";
    this.canvas.style.left = `${canvasLeft}px`;
    this.canvas.style.top = `${canvasTop}px`;
    this.canvas.style.imageRendering = "pixelated";

    this.canvasScale = scale;
    this.canvasScreenLeft = canvasLeft;
    this.canvasScreenTop = canvasTop;
    this.canvasScreenWidth = displayWidth;
    this.canvasScreenHeight = displayHeight;

    const gameRoot = document.querySelector(".game-root");
    if (gameRoot) {
      gameRoot.style.position = "fixed";
      gameRoot.style.inset = "0";
      gameRoot.style.display = "block";
      gameRoot.style.background = "#000";
      gameRoot.style.borderRadius = "0";
      gameRoot.style.overflow = "visible";
      gameRoot.style.boxShadow = "none";
    }
    this.layoutUiForDesignResolution(scale, canvasLeft, canvasTop);
    console.log(
      `[Resolution] preset=${presetId} container=${containerWidth}x${containerHeight} scale=${scale} canvas=${displayWidth}x${displayHeight}`
    );
    this.ctx.imageSmoothingEnabled = false;
  }

  layoutUiForDesignResolution(scale, canvasLeft, canvasTop) {
    const place = (el, designX, designY) => {
      if (!el) return;
      el.style.left = `${Math.round(canvasLeft + designX * scale)}px`;
      el.style.top = `${Math.round(canvasTop + designY * scale)}px`;
    };

    const inventoryButton = document.getElementById("inventory-button");
    if (inventoryButton) {
      inventoryButton.style.position = "fixed";
      inventoryButton.style.left = "12px";
      inventoryButton.style.top = "12px";
      inventoryButton.style.transformOrigin = "top left";
      inventoryButton.style.transform = "none";
    }

    const buildLogToggle = document.getElementById("build-log-toggle");
    if (buildLogToggle) {
      const invWidth = inventoryButton ? inventoryButton.offsetWidth : 140;
      buildLogToggle.style.position = "fixed";
      buildLogToggle.style.left = `${12 + invWidth + 6}px`;
      buildLogToggle.style.top = "12px";
      buildLogToggle.style.transformOrigin = "top left";
      buildLogToggle.style.transform = "none";
    }

    const pauseToggle = document.getElementById("pause-toggle");
    if (pauseToggle) {
      pauseToggle.style.left = `${Math.round(canvasLeft + (DESIGN_WIDTH / 2) * scale)}px`;
      pauseToggle.style.top = `${Math.round(canvasTop + 20 * scale)}px`;
      pauseToggle.style.transformOrigin = "top center";
      pauseToggle.style.transform = "translateX(-50%)";
    }

    const devToggle = document.getElementById("dev-toggle");
    if (devToggle) {
      const designX = DESIGN_WIDTH - 16 - devToggle.offsetWidth;
      place(devToggle, designX, 20);
      devToggle.style.transformOrigin = "top left";
      devToggle.style.transform = "none";
    }

    const buildLogPanel = document.getElementById("build-log-panel");
    if (buildLogPanel) {
      const buildLeft = buildLogToggle
        ? parseInt(buildLogToggle.style.left || "12", 10)
        : 12;
      const buildTop = buildLogToggle
        ? parseInt(buildLogToggle.style.top || "12", 10)
        : 12;
      const buildHeight = buildLogToggle?.offsetHeight || 32;
      buildLogPanel.style.position = "fixed";
      buildLogPanel.style.left = `${buildLeft}px`;
      buildLogPanel.style.top = `${buildTop + buildHeight + 4}px`;
      buildLogPanel.style.transformOrigin = "top left";
      buildLogPanel.style.transform = "none";
    }

    const bossHealthBar = document.getElementById("boss-health-bar");
    if (bossHealthBar) {
      bossHealthBar.style.left = `${Math.round(canvasLeft + (DESIGN_WIDTH / 2) * scale)}px`;
      bossHealthBar.style.top = `${Math.round(canvasTop + 60 * scale)}px`;
      bossHealthBar.style.transformOrigin = "top center";
      bossHealthBar.style.transform = "translateX(-50%)";
    }

    const inventoryPanel = document.querySelector(".inventory-panel");
    if (inventoryPanel) {
      inventoryPanel.style.position = "fixed";
      inventoryPanel.style.top = "12px";
      inventoryPanel.style.right = "12px";
      inventoryPanel.style.left = "auto";
      inventoryPanel.style.transformOrigin = "top left";
      inventoryPanel.style.transform = "none";
    }

    const skillBar = document.getElementById("skill-bar");
    if (skillBar) {
      const skillBarTop = canvasTop + DESIGN_HEIGHT * scale - skillBar.offsetHeight - Math.round(12 * scale);
      skillBar.style.position = "fixed";
      skillBar.style.left = `${Math.round(canvasLeft + (DESIGN_WIDTH / 2) * scale)}px`;
      skillBar.style.top = `${skillBarTop}px`;
      skillBar.style.transformOrigin = "center bottom";
      skillBar.style.transform = "translateX(-50%)";
    }

    const blessingsBar = document.getElementById("blessings-bar");
    if (blessingsBar) {
      place(blessingsBar, 12, 12);
      blessingsBar.style.position = "fixed";
      blessingsBar.style.transformOrigin = "top left";
      blessingsBar.style.transform = "none";
    }
  }

  loop(timestamp) {
    const dt = (timestamp - this.lastTime) / 1000 || 0;
    this.lastTime = timestamp;

    if (!this.paused) {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  initDevUI() {
    if (!DEV_MODE_ENABLED) {
      if (this.devToggleEl) this.devToggleEl.style.display = "none";
      if (this.devPanelEl) this.devPanelEl.style.display = "none";
      return;
    }

    if (this.devToggleEl && this.devPanelEl) {
      this.devToggleEl.addEventListener("click", () => this.toggleDevPanel());
    }
    if (this.devCloseEl && this.devPanelEl) {
      this.devCloseEl.addEventListener("click", () => this.toggleDevPanel());
    }
    if (this.devGiveAllEl) {
      this.devGiveAllEl.addEventListener("click", () => this.handleDevGiveAllCards());
    }
    const devGiveAllCubesEl = document.getElementById("dev-give-all-cubes");
    if (devGiveAllCubesEl) {
      devGiveAllCubesEl.addEventListener("click", () => this.handleDevGiveAllCubes());
    }
    const devRandomItemEl = document.getElementById("dev-random-item");
    if (devRandomItemEl) {
      devRandomItemEl.addEventListener("click", () => this.handleDevRandomItem());
    }
    const devLevelUpEl = document.getElementById("dev-level-up");
    if (devLevelUpEl) {
      devLevelUpEl.addEventListener("click", () => {
        this.xp = getXpForLevel(this.level + 1);
        this.checkLevelUp();
      });
    }
    if (this.devMaxStatsEl) {
      this.devMaxStatsEl.addEventListener("click", () => this.handleDevMaxStats());
    }
    this.initDevStatsSliders();

    const devAffixSelect = document.getElementById("dev-affix-select");
    const devSpawnEliteBtn = document.getElementById("dev-spawn-elite");
    if (devAffixSelect) {
      devAffixSelect.innerHTML = '<option value="">-- Select affix --</option>';
      for (const affix of AFFIX_DEFS) {
        const opt = document.createElement("option");
        opt.value = affix.id;
        opt.textContent = affix.name;
        devAffixSelect.appendChild(opt);
      }
    }
    if (devSpawnEliteBtn) {
      devSpawnEliteBtn.addEventListener("click", () => {
        const affixId = devAffixSelect?.value;
        if (!affixId) return;
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        this.enemySystem.spawnOne("elite", [affixId], { x: px, y: py }, this);
      });
    }

    const devMinibossSelect = document.getElementById("dev-miniboss-select");
    const devSpawnMinibossBtn = document.getElementById("dev-spawn-miniboss");
    if (devMinibossSelect) {
      devMinibossSelect.innerHTML = '<option value="">-- Select enemy --</option>';
      const attackKitEnemies = ["Orc", "Orc Wizard", "Goblin", "Goblin Archer", "Troll", "Ettin", "Big Slime", "Skeleton Archer", "Lich", "Death Knight", "Banshee", "Giant Spider", "Manticore", "Dryad", "Rock Golem", "Drake / Lesser Dragon"];
      for (const name of attackKitEnemies) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        devMinibossSelect.appendChild(opt);
      }
    }
    if (devSpawnMinibossBtn) {
      devSpawnMinibossBtn.addEventListener("click", () => {
        const enemyName = devMinibossSelect?.value;
        if (!enemyName) return;
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        this.enemySystem.spawnOne("miniBoss", null, { x: px, y: py }, this, enemyName);
      });
    }

    if (this.devCardListEl) {
      this.devCardListEl.innerHTML = "";
    }

    const devModTogglesEl = document.getElementById("dev-skill-mod-toggles");
    if (devModTogglesEl) {
      devModTogglesEl.innerHTML = "";
      for (let slot = 0; slot < 4; slot++) {
        const skillId = this.skills?.[slot];
        const def = skillId ? SKILL_DEFS.find((s) => s.id === skillId) : null;
        const row = document.createElement("div");
        row.className = "dev-mod-slot-row";
        const label = document.createElement("span");
        label.className = "dev-mod-slot-label";
        label.textContent = `Slot ${slot + 1}: ${def ? def.name : "Empty"}`;
        row.appendChild(label);
        const wrap = document.createElement("div");
        wrap.className = "dev-mod-checks";
        for (const cardDef of MODIFICATION_CARD_DEFS) {
          const modId = cardDef.id;
          if (!cardDef) continue;
          const labelEl = document.createElement("label");
          labelEl.className = "dev-mod-check-label";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.dataset.slot = String(slot);
          cb.dataset.modId = modId;
          cb.checked = (this.devModOverrides[slot] || []).includes(modId);
          cb.addEventListener("change", () => {
            const list = this.devModOverrides[slot] || [];
            if (cb.checked) {
              if (!list.includes(modId)) this.devModOverrides[slot] = [...list, modId];
            } else {
              this.devModOverrides[slot] = list.filter((id) => id !== modId);
            }
          });
          labelEl.appendChild(cb);
          labelEl.appendChild(document.createTextNode(" " + cardDef.name));
          wrap.appendChild(labelEl);
        }
        row.appendChild(wrap);
        devModTogglesEl.appendChild(row);
      }
    }

    const buildLogToggle = document.getElementById("build-log-toggle");
    const buildLogPanel = document.getElementById("build-log-panel");
    const buildLogClose = document.getElementById("build-log-close");
    if (buildLogToggle && buildLogPanel) {
      buildLogToggle.addEventListener("click", () => {
        buildLogPanel.classList.toggle("hidden");
        if (!buildLogPanel.classList.contains("hidden") && this.buildLogRefresh) this.buildLogRefresh();
      });
    }
    if (buildLogClose && buildLogPanel) {
      buildLogClose.addEventListener("click", () => buildLogPanel.classList.add("hidden"));
    }
    this.buildLogRefresh = () => {
      const upgradesEl = document.getElementById("build-log-upgrades");
      const penaltiesEl = document.getElementById("build-log-penalties");
      if (!upgradesEl || !penaltiesEl) return;
      upgradesEl.innerHTML = "";
      penaltiesEl.innerHTML = "";
      
      // Add shrine interactions to upgrades list
      if (this.shrineInteractions && this.shrineInteractions.length > 0) {
        this.shrineInteractions.forEach(interaction => {
          const li = document.createElement("li");
          li.className = "build-log-upgrade";
          li.innerHTML = `<span class="build-log-name"> </span><span class="build-log-effect">${interaction.message}</span>`;
          upgradesEl.appendChild(li);
        });
      }
      
      const ups = this.runAttackUpgrades || [];
      const pens = this.runAttackPenalties || [];
      const aggUp = new Map();
      for (const u of ups) {
        if (!aggUp.has(u.id)) {
          aggUp.set(u.id, { id: u.id, name: u.name, description: u.description, value: 0, percent: u.percent, count: 0 });
        }
        const a = aggUp.get(u.id);
        a.count++;
        if (u.value !== undefined && u.value !== null) a.value += u.value;
      }
      for (const a of aggUp.values()) {
        if (a.value === 0 && a.id !== "extraProjectile") a.value = undefined;
        const li = document.createElement("li");
        li.className = "build-log-upgrade";
        const effect = getAggregatedUpgradeEffect(a);
        li.innerHTML = `<span class="build-log-name"> ${a.name} *${a.count}</span><span class="build-log-effect">${effect}</span>`;
        upgradesEl.appendChild(li);
      }
      const aggPen = new Map();
      for (const p of pens) {
        if (!aggPen.has(p.id)) {
          aggPen.set(p.id, { id: p.id, name: p.name, description: p.description, value: 0, percent: p.percent, count: 0 });
        }
        const a = aggPen.get(p.id);
        a.count++;
        if (p.value !== undefined && p.value !== null) a.value += p.value;
      }
      for (const a of aggPen.values()) {
        if (a.value === 0) a.value = undefined;
        const li = document.createElement("li");
        li.className = "build-log-penalty";
        const effect = getAggregatedPenaltyEffect(a);
        li.innerHTML = `<span class="build-log-name"> ${a.name} *${a.count}</span><span class="build-log-effect">${effect}</span>`;
        penaltiesEl.appendChild(li);
      }
    };

    const devForceUpgrade = document.getElementById("dev-force-upgrade");
    const devForcePenalty = document.getElementById("dev-force-penalty");
    const devApplyForce = document.getElementById("dev-apply-force-upgrade");
    if (devForceUpgrade && devForcePenalty && devApplyForce) {
      const defs = ATTACK_UPGRADE_DEFS[this.attackType] || {};
      const allUpgrades = [...(defs.standardUpgrades || []), ...(defs.uniqueUpgrades || [])];
      const allPenalties = [...(defs.standardPenalties || []), ...(defs.uniquePenalties || [])];
      devForceUpgrade.innerHTML = '<option value="">-- Upgrade --</option>';
      for (const u of allUpgrades) {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = u.name;
        devForceUpgrade.appendChild(opt);
      }
      devForcePenalty.innerHTML = '<option value="">-- Penalty --</option>';
      for (const p of allPenalties) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        devForcePenalty.appendChild(opt);
      }
      devApplyForce.addEventListener("click", () => {
        const uId = devForceUpgrade.value;
        const pId = devForcePenalty.value;
        if (!uId && !pId) return;
        
        if (!this.runAttackUpgrades) this.runAttackUpgrades = [];
        if (!this.runAttackPenalties) this.runAttackPenalties = [];
        
        if (uId) {
          const uDef = allUpgrades.find((x) => x.id === uId);
          if (uDef) {
            this.runAttackUpgrades.push({ id: uDef.id, name: uDef.name, description: uDef.description, value: rollUpgradeValue(uDef), percent: !!uDef.valueRange?.percent });
          }
        }
        
        if (pId) {
          const pDef = allPenalties.find((x) => x.id === pId);
          if (pDef) {
            this.runAttackPenalties.push({ id: pDef.id, name: pDef.name, description: pDef.description, value: rollUpgradeValue(pDef), percent: !!pDef.valueRange?.percent });
          }
        }
        
        if (this.buildLogRefresh) this.buildLogRefresh();
      });
    }

    // Shrine spawner
    const devShrineSelect = document.getElementById("dev-shrine-select");
    const devSpawnShrine = document.getElementById("dev-spawn-shrine");
    if (devShrineSelect && devSpawnShrine) {
      devShrineSelect.innerHTML = '<option value="">-- Select shrine --</option>';
      for (const shrine of SHRINE_DEFS) {
        const opt = document.createElement("option");
        opt.value = shrine.id;
        opt.textContent = shrine.name;
        devShrineSelect.appendChild(opt);
      }
      devSpawnShrine.addEventListener("click", () => {
        const shrineId = devShrineSelect.value;
        if (!shrineId) return;
        const shrineDef = SHRINE_DEFS.find(s => s.id === shrineId);
        if (!shrineDef) return;
        
        // Spawn shrine near player (offset by 100 pixels)
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        const offsetX = 100 + Math.random() * 50;
        const offsetY = 100 + Math.random() * 50;
        const sx = Math.max(
          this.world.wallThickness + 32,
          Math.min(px + offsetX, this.world.width - this.world.wallThickness - 96)
        );
        const sy = Math.max(
          this.world.wallThickness + 32,
          Math.min(py + offsetY, this.world.height - this.world.wallThickness - 96)
        );
        
        this.mapInteractables.push({
          type: "shrine",
          shrineId: shrineDef.id,
          shrineName: shrineDef.name,
          shrineDescription: shrineDef.description,
          shrineIcon: shrineDef.icon,
          shrineColor: shrineDef.color,
          shrineAuraColor: shrineDef.auraColor,
          x: sx - 32,
          y: sy - 32,
          w: 64,
          h: 64,
          used: false
        });
      });
    }
  }

  toggleDevPanel() {
    if (!this.devPanelEl) return;
    const hidden = this.devPanelEl.classList.contains("dev-panel-hidden");
    if (hidden) {
      this.devPanelEl.classList.remove("dev-panel-hidden");
      this.initDevStatsSliders();
    } else {
      this.devPanelEl.classList.add("dev-panel-hidden");
    }
  }

  restartGame() {
    window.location.reload();
  }

  returnToMainMenu() {
    stopBgm();
    // Hide game elements
    document.getElementById("main-menu").classList.remove("hidden");
    document.querySelector(".game-root").classList.add("hidden");
    document.getElementById("pause-toggle").classList.add("hidden");
    document.getElementById("dev-toggle")?.classList.add("hidden");
    document.getElementById("inventory-button")?.classList.add("hidden");
    
    // Unpause if paused
    this.paused = false;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "Pause";
      this.pauseToggleEl.classList.remove("paused");
    }
    
    // Refresh main menu
    refreshMainMenuLP();
  }

  togglePause() {
    if (this.gameOver) return;
    if (this.inventoryOverlayOpen) {
      this.closeInventoryOverlay();
      return;
    }
    this.paused = !this.paused;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = this.paused ? "Resume" : "Pause";
      this.pauseToggleEl.classList.toggle("paused", this.paused);
    }
  }

  showInventoryOverlay() {
    if (this.gameOver || this.levelUpChoices || this.currentEvent) return;
    this.inventoryOverlayOpen = true;
    this.paused = true;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "Resume";
      this.pauseToggleEl.classList.add("paused");
    }
    const overlay = document.getElementById("inventory-overlay");
    if (overlay) overlay.classList.remove("hidden");
    this.populateInventoryOverlay();
    this.populateCraftingTab();
  }

  closeInventoryOverlay() {
    this.inventoryOverlayOpen = false;
    this.paused = false;
    if (this._craftingPreviewFadeTimer) {
      clearInterval(this._craftingPreviewFadeTimer);
      this._craftingPreviewFadeTimer = null;
    }
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "Pause";
      this.pauseToggleEl.classList.remove("paused");
    }
    const overlay = document.getElementById("inventory-overlay");
    if (overlay) overlay.classList.add("hidden");
    hideItemTooltip();
  }

  populateInventoryOverlay() {
    const equippedList = document.getElementById("inventory-overlay-equipped-list");
    const invList = document.getElementById("inventory-overlay-inventory-list");
    if (!equippedList || !invList) return;

    equippedList.innerHTML = "";
    const slots = ["Helmet", "Body Armour", "Weapon", "Boots"];
    for (const slot of slots) {
      const li = document.createElement("li");
      const item = this.equipment[slot];
      if (item) {
        const color = getItemRarityColor(item);
        const baseKey = EQUIPMENT_BASE_STAT[slot];
        const baseVal = item.stats?.[baseKey] ?? 0;
        if (item.rarity === "legendary") li.classList.add("item-legendary");
        li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (+${baseVal})`;
      } else {
        li.textContent = `${slot}: None`;
      }
      if (item) {
        li.dataset.hasItem = "1";
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
        li.addEventListener("click", () => {
          if (item) {
            this.inventory.push(item);
            this.equipment[slot] = null;
            this.updateInventoryUI();
            this.updateEquippedUI();
            this.populateInventoryOverlay();
            this.recalculateStats();
          }
        });
      } else {
        li.classList.add("inventory-overlay-empty");
      }
      equippedList.appendChild(li);
    }

    invList.innerHTML = "";
    if (this.inventory.length === 0) {
      const li = document.createElement("li");
      li.className = "inventory-overlay-empty";
      li.textContent = "No items in inventory";
      invList.appendChild(li);
    } else {
      for (const item of this.inventory) {
        const li = document.createElement("li");
        if (item.type !== "Upgrade Card") {
          const color = getItemRarityColor(item);
          const baseKey = EQUIPMENT_BASE_STAT[item.type];
          const baseVal = item.stats?.[baseKey] ?? 0;
          if (item.rarity === "legendary") li.classList.add("item-legendary");
          li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (${escapeHtml(item.type)}) +${baseVal}`;
        } else {
          li.textContent = item.name;
        }
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
        li.addEventListener("click", () => this.handleInventoryItemClick(item));
        invList.appendChild(li);
      }
    }
    this.populateCraftingTab();
  }

  getLivingItem() {
    for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
      const item = this.equipment[slot];
      if (item?.livingItem) return item;
    }
    return this.inventory.find((it) => it.livingItem) || null;
  }

  getCraftableEquipmentItems() {
    const items = [];
    for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
      const item = this.equipment[slot];
      if (item && item.rarity !== "legendary" && !item.livingItem) items.push({ item, source: "equipped", slot });
    }
    for (let i = 0; i < this.inventory.length; i++) {
      const item = this.inventory[i];
      if (item.type !== "Upgrade Card" && item.rarity !== "legendary" && !item.livingItem && (item.type === "Helmet" || item.type === "Body Armour" || item.type === "Weapon" || item.type === "Boots")) {
        items.push({ item, source: "inventory", index: i });
      }
    }
    return items;
  }

  populateCraftingTab() {
    const grid = document.getElementById("cube-inventory-grid");
    const itemList = document.getElementById("crafting-item-list");
    if (!grid || !itemList) return;

    grid.innerHTML = "";
    const allCubes = [];
    for (const cube of MODIFIER_CUBES) {
      for (let t = 1; t <= 3; t++) {
        allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
      }
    }
    for (const cube of UPGRADE_CUBES) {
      for (let t = 1; t <= 3; t++) {
        allCubes.push({ ...cube, tier: t, key: `${cube.id}T${t}` });
      }
    }
    for (const cube of LEGENDARY_CUBES) {
      allCubes.push({ ...cube, tier: null, key: cube.id });
    }
    const ownedCubes = allCubes.filter((c) => (this.cubeInventory[c.key] || 0) > 0);
    for (const c of ownedCubes) {
      const count = this.cubeInventory[c.key] || 0;
      const div = document.createElement("div");
      div.className = `cube-slot ${c.tier ? `tier-${c.tier}` : "tier-legendary"} ${this.craftingSelectedCube === c.key ? "selected" : ""}`;
      div.dataset.cubeKey = c.key;
      const icon = c.tier ? (c.id.includes("magic") ? "" : c.id.includes("rare") ? "" : c.id.includes("reforge") ? "" : "") : "";
      const tierLabel = c.tier ? ` T${c.tier}` : "";
      div.innerHTML = `
        <span class="cube-icon">${icon}${tierLabel}</span>
        <span class="cube-slot-name">${escapeHtml(c.label)}</span>
        <span class="cube-slot-count">${count}</span>
      `;
      div.addEventListener("click", () => this.selectCraftingCube(c.key));
      grid.appendChild(div);
    }

    itemList.innerHTML = "";
    const craftables = this.getCraftableEquipmentItems();
    for (const { item, source, slot, index } of craftables) {
      const li = document.createElement("li");
      const color = getItemRarityColor(item);
      const baseKey = EQUIPMENT_BASE_STAT[item.type];
      const baseVal = item.stats?.[baseKey] ?? 0;
      const loc = source === "equipped" ? `${slot}` : "Inventory";
      if (item.rarity === "legendary") li.classList.add("item-legendary");
      li.innerHTML = `<span style="color:${color}">${escapeHtml(item.name)}</span> (+${baseVal}) [${loc}]`;
      li.classList.toggle("selected", this.craftingSelectedItem === item && this.craftingItemSource?.source === source && (source === "inventory" ? this.craftingItemSource.index === index : this.craftingItemSource.slot === slot));
      li.addEventListener("click", () => this.selectCraftingItem(item, source, slot, index));
      li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
      li.addEventListener("mouseleave", hideItemTooltip);
      itemList.appendChild(li);
    }

    this.updateCraftingPreview();
  }

  selectCraftingItem(item, source, slot, index) {
    this.craftingSelectedItem = item;
    this.craftingItemSource = { source, slot, index };
    this.populateCraftingTab();
  }

  selectCraftingCube(cubeKey) {
    if ((this.cubeInventory[cubeKey] || 0) === 0) return;
    this.craftingSelectedCube = cubeKey;
    this.populateCraftingTab();
  }

  updateCraftingPreview() {
    const itemEl = document.getElementById("crafting-selected-item");
    const cubeEl = document.getElementById("crafting-selected-cube");
    const statsEl = document.getElementById("crafting-item-stats");
    const previewEl = document.getElementById("crafting-preview");
    const confirmBtn = document.getElementById("crafting-confirm");
    if (!itemEl || !cubeEl || !previewEl || !confirmBtn) return;

    if (this.craftingSelectedItem) {
      itemEl.textContent = this.craftingSelectedItem.name;
      itemEl.classList.add("has-item");
      if (statsEl) {
        if (this.craftingSelectedItem.type === "Upgrade Card") {
          statsEl.innerHTML = "";
          statsEl.classList.add("hidden");
        } else {
          statsEl.innerHTML = buildItemTooltipContent(this.craftingSelectedItem, null);
          statsEl.classList.remove("hidden");
        }
      }
    } else {
      itemEl.textContent = "No item selected";
      itemEl.classList.remove("has-item");
      if (statsEl) {
        statsEl.innerHTML = "";
        statsEl.classList.add("hidden");
      }
    }

    if (this.craftingSelectedCube) {
      const tierMatch = this.craftingSelectedCube.match(/T(\d)$/);
      const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
      const legCube = LEGENDARY_CUBES.find((c) => c.id === this.craftingSelectedCube);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => `${c.id}T${tier}` === this.craftingSelectedCube || this.craftingSelectedCube.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => this.craftingSelectedCube === `${c.id}T${tier}`);
      const cubeLabel = legCube ? legCube.label : (modCube ? `${modCube.label} T${tier}` : (upgCube ? `${upgCube.label} T${tier}` : this.craftingSelectedCube));
      cubeEl.textContent = cubeLabel;
      cubeEl.classList.add("has-cube");
    } else {
      cubeEl.textContent = "No cube selected";
      cubeEl.classList.remove("has-cube");
    }

    let preview = "";
    let canCraft = false;
    if (this.craftingSelectedItem && this.craftingSelectedCube) {
      const item = this.craftingSelectedItem;
      if (item.rarity === "legendary") {
        preview = "Legendary items cannot be further crafted.";
      } else {
      const legCube = LEGENDARY_CUBES.find((c) => c.id === this.craftingSelectedCube);
      const [cubeId, tierStr] = this.craftingSelectedCube.match(/(.+)T(\d)$/)?.slice(1) || [null, "1"];
      const tier = parseInt(tierStr || "1", 10);
      const modCube = !legCube && MODIFIER_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));
      const upgCube = !legCube && UPGRADE_CUBES.find((c) => this.craftingSelectedCube.startsWith(c.id));

      if (legCube) {
        if (item.type === "Upgrade Card") {
          preview = "Legendary cubes can only be used on equipment.";
        } else if (item.rarity !== "rare") {
          preview = "Legendary cubes can only be used on Rare (Yellow) items.";
        } else {
          preview = `Upgrades to Legendary and replaces one modifier with ${legCube.modifierLabel}.`;
          canCraft = true;
        }
      } else if (modCube) {
        const item = this.craftingSelectedItem;
        if (item.type === "Upgrade Card") {
          preview = "Modifier cubes can only be used on equipment.";
        } else if (item.rarity === "common" || !item.rarity) {
          preview = "Modifier cubes can only be used on Magic or Rare items. Use a Magic Cube first.";
        } else {
          const existing = item.modifiers?.find((m) => m.id === modCube.modifierId);
          const maxMods = item.rarity === "common" ? 0 : item.rarity === "magic" ? 2 : 4;
          const currentCount = item.modifiers?.length || 0;
          const r = getModifierRollRangeForTier(tier, modCube.modifierId);
          const range = (r.min * 100).toFixed(0) + "-" + (r.max * 100).toFixed(0) + "%";
          if (existing) {
            preview = `${modCube.modifierLabel} already exists on this item. Choose a different cube.`;
          } else if (currentCount < maxMods) {
            preview = `Adds ${modCube.modifierLabel} (${range}).`;
            canCraft = true;
          } else {
            preview = `Replaces a random modifier with ${modCube.modifierLabel} (${range}).`;
            canCraft = true;
          }
        }
      } else if (upgCube) {
        const item = this.craftingSelectedItem;
        if (item.type === "Upgrade Card") {
          preview = "Upgrade cubes can only be used on equipment.";
        } else if (upgCube.id === "magicCube" && item.rarity !== "common") {
          preview = "Magic Cube can only be used on White (common) items.";
        } else if (upgCube.id === "rareCube" && item.rarity !== "magic") {
          preview = "Rare Cube can only be used on Blue (magic) items.";
        } else if (upgCube.id === "reforgeCube" && (item.rarity === "common" || !item.rarity)) {
          preview = "Reforge Cube can only be used on Blue or Yellow items.";
        } else {
          if (upgCube.id === "magicCube") preview = "Upgrades to Blue and adds 2 random modifiers.";
          else if (upgCube.id === "rareCube") preview = "Upgrades to Yellow and adds 2 more modifiers.";
          else preview = "Rerolls all modifiers with new random values.";
          canCraft = true;
        }
      }
      }
    }
    previewEl.textContent = preview;
    previewEl.classList.toggle("hidden", !preview);
    confirmBtn.disabled = !canCraft;
  }

  executeCraft() {
    if (!this.craftingSelectedItem || !this.craftingSelectedCube) return;
    if (this.craftingSelectedItem.rarity === "legendary") return;
    const cubeKey = this.craftingSelectedCube;
    const count = this.cubeInventory[cubeKey] || 0;
    if (count === 0) return;

    const tier = parseInt(cubeKey.match(/T(\d)$/)?.[1] || "1", 10);
    const legCube = LEGENDARY_CUBES.find((c) => c.id === cubeKey);
    const modCube = !legCube && MODIFIER_CUBES.find((c) => cubeKey.startsWith(c.id));
    const upgCube = !legCube && UPGRADE_CUBES.find((c) => cubeKey.startsWith(c.id));

    if (legCube) {
      const item = this.craftingSelectedItem;
      if (item.rarity !== "rare") return;
      this.applyLegendaryCube(item, legCube);
    } else if (modCube) {
      const item = this.craftingSelectedItem;
      if (item.rarity === "common" || !item.rarity) return;
      if (item.modifiers?.some((m) => m.id === modCube.modifierId)) return;
      this.applyModifierCube(item, modCube, tier);
    } else if (upgCube) {
      this.applyUpgradeCube(this.craftingSelectedItem, upgCube, tier);
    }

    const cascadeSave = hasTalent("cubeCascade") && Math.random() < 0.1;
    if (!cascadeSave) {
      this.cubeInventory[cubeKey] = count - 1;
      if (this.cubeInventory[cubeKey] === 0) delete this.cubeInventory[cubeKey];
    }
    this.craftingSelectedCube = null;
    this.recalculateStats();
    this.updateEquippedUI();
    this.populateInventoryOverlay();
    this.populateCraftingTab();
    if (this._craftingPreviewFadeTimer) clearInterval(this._craftingPreviewFadeTimer);
    this._craftingPreviewFadeTimer = setInterval(() => {
      this.updateCraftingPreview();
    }, 500);
    setTimeout(() => {
      if (this._craftingPreviewFadeTimer) {
        clearInterval(this._craftingPreviewFadeTimer);
        this._craftingPreviewFadeTimer = null;
      }
    }, 10000);
  }

  applyModifierCube(item, cubeDef, tier) {
    item.modifiers = item.modifiers || [];
    const value = rollModifierForTier(tier, cubeDef.modifierId);
    const poolEntry = MODIFIER_POOL.find((m) => m.id === cubeDef.modifierId);
    const modEntry = { id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: poolEntry?.statKey || cubeDef.modifierId.replace("Percent", ""), value, addedAt: Date.now() };

    const existingIdx = item.modifiers.findIndex((m) => m.id === cubeDef.modifierId);
    const maxMods = item.rarity === "magic" ? 2 : item.rarity === "rare" ? 4 : 0;
    if (existingIdx >= 0) {
      item.modifiers[existingIdx] = { ...modEntry };
    } else if (item.modifiers.length < maxMods) {
      item.modifiers.push(modEntry);
    } else {
      const replaceIdx = Math.floor(Math.random() * item.modifiers.length);
      const removed = item.modifiers[replaceIdx];
      if (removed) {
        modEntry.removedModifier = {
          id: removed.id,
          label: removed.label,
          value: removed.value
        };
      }
      item.modifiers[replaceIdx] = modEntry;
    }
    this.rebuildItemStats(item);
  }

  applyLegendaryCube(item, cubeDef) {
    if (item.rarity !== "rare") return;
    item.rarity = "legendary";
    const mods = item.modifiers || [];
    if (mods.length > 0) {
      const idx = Math.floor(Math.random() * mods.length);
      mods[idx] = { id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 };
    } else {
      item.modifiers = [{ id: cubeDef.modifierId, label: cubeDef.modifierLabel, statKey: null, value: 0 }];
    }
    this.rebuildItemStats(item);
  }

  applyUpgradeCube(item, cubeDef, tier) {
    if (cubeDef.id === "magicCube") {
      item.rarity = "magic";
      item.modifiers = item.modifiers || [];
      const pool = getModifierPoolForType(item.type);
      for (let i = 0; i < 2; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(getCubeDifficultyForTier(tier)) : rollModifierForTier(tier, m.id);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
      const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
      const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
      if (!hasPrefix && !hasSuffix) {
        if (Math.random() < 0.5) {
          item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
        } else {
          item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
        }
      }
    } else if (cubeDef.id === "rareCube") {
      item.rarity = "rare";
      item.modifiers = item.modifiers || [];
      const pool = getModifierPoolForType(item.type).filter((p) => !item.modifiers.some((m) => m.id === p.id));
      const extraMods = hasTalent("transmutation") && Math.random() < 0.05 ? 3 : 2;
      for (let i = 0; i < extraMods; i++) {
        if (pool.length === 0) break;
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(getCubeDifficultyForTier(tier)) : rollModifierForTier(tier, m.id);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
      const hasPrefix = NAME_PREFIXES.some((p) => item.name.startsWith(p + " "));
      const hasSuffix = NAME_SUFFIXES.some((s) => item.name.includes(" " + s));
      if (!hasPrefix) item.name = `${NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)]} ${item.name}`;
      if (!hasSuffix) item.name = `${item.name} ${NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)]}`;
    } else if (cubeDef.id === "reforgeCube") {
      item.modifiers = [];
      const pool = getModifierPoolForType(item.type);
      const count = item.rarity === "magic" ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const m = pool.splice(idx, 1)[0];
        const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(getCubeDifficultyForTier(tier)) : rollModifierForTier(tier, m.id);
        item.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
      }
    }
    this.rebuildItemStats(item);
  }

  rebuildItemStats(item) {
    const baseKey = EQUIPMENT_BASE_STAT[item.type];
    if (!item.baseStat && item.stats) {
      item.baseStat = { [baseKey]: item.stats[baseKey] ?? 0 };
      const sec = EQUIPMENT_SECONDARY_BASE[item.type];
      if (sec) item.baseStat[sec.statKey] = item.stats[sec.statKey] ?? 0;
    }
    const stats = { ...(item.baseStat || {}) };
    for (const m of item.modifiers || []) {
      if (LEGENDARY_MODIFIER_IDS.includes(m.id)) continue;
      if (m.id === "defenseStatScale") {
        stats.defense = Math.round((stats.defense || 0) * (1 + m.value));
      } else if (m.id === "maxHealthStatScale") {
        stats.maxHealth = Math.round((stats.maxHealth || 0) * (1 + m.value));
      } else if (m.statKey === "attackSpeed") {
        stats.attackSpeed = (stats.attackSpeed || 1) * (1 + m.value);
      } else if (m.statKey === "cooldownRecovery") {
        stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - m.value);
      } else {
        const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
        stats[key] = (stats[key] || 0) + m.value;
      }
    }
    item.stats = stats;
  }

  showGameOver() {
    this.gameOver = true;
    const eternalItems = [];
    const hasEternal = (item) => item?.modifiers?.some((m) => m.id === "eternal");
    for (const [slot, item] of Object.entries(this.equipment)) {
      if (item && hasEternal(item)) eternalItems.push({ item: JSON.parse(JSON.stringify(item)), source: "equipped", slot });
    }
    for (const item of this.inventory) {
      if (item && item.type !== "Upgrade Card" && hasEternal(item)) eternalItems.push({ item: JSON.parse(JSON.stringify(item)), source: "inventory" });
    }
    if (eternalItems.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem(ETERNAL_ITEMS_ON_DEFEAT_KEY) || "[]");
        existing.push(...eternalItems.map((e) => e.item));
        localStorage.setItem(ETERNAL_ITEMS_ON_DEFEAT_KEY, JSON.stringify(existing));
      } catch (_) {}
    }
    
    // Update game over panel stats
    if (this.gameOverMapsEl) {
      this.gameOverMapsEl.textContent = this.visitedMaps.size;
    }
    if (this.gameOverEnemiesEl) {
      this.gameOverEnemiesEl.textContent = this.enemiesKilled;
    }
    if (this.gameOverLevelEl) {
      this.gameOverLevelEl.textContent = this.level;
    }
    
    if (this.gameOverEl) {
      this.gameOverEl.classList.remove("hidden");
      // Force inline styles to ensure proper positioning (CSS wasn't applying correctly)
      this.gameOverEl.style.position = 'fixed';
      this.gameOverEl.style.top = '0';
      this.gameOverEl.style.left = '0';
      this.gameOverEl.style.right = '0';
      this.gameOverEl.style.bottom = '0';
      this.gameOverEl.style.width = '100vw';
      this.gameOverEl.style.height = '100vh';
      this.gameOverEl.style.display = 'flex';
      this.gameOverEl.style.alignItems = 'center';
      this.gameOverEl.style.justifyContent = 'center';
      this.gameOverEl.style.margin = '0';
      this.gameOverEl.style.padding = '0';
      this.gameOverEl.style.zIndex = '60';
    }
  }

  showVictory() {
    this.gameOver = true;
    const el = document.getElementById("victory-overlay");
    if (el) {
      el.classList.remove("hidden");
      this.populateVictorySummary();
    }
  }

  populateVictorySummary() {
    const lpEl = document.getElementById("victory-lp-earned");
    if (lpEl) lpEl.textContent = `+${this.lpEarnedThisRun ?? 0} Legacy Points earned this run`;

    const equippedEl = document.getElementById("victory-equipped");
    const statsEl = document.getElementById("victory-stats");
    if (equippedEl) {
      equippedEl.innerHTML = "";
      for (const [slot, item] of Object.entries(this.equipment)) {
        const div = document.createElement("div");
        div.textContent = `${slot}: ${item ? item.name : "None"}`;
        equippedEl.appendChild(div);
      }
    }
    if (statsEl) {
      statsEl.innerHTML = "";
      const rows = [
        ["Level", `${this.level}`],
        ["Difficulty", `${this.difficulty}`],
        ["Health", `${this.currentStats.maxHealth}`],
        ["Defense", `${this.currentStats.defense}`],
        ["Speed", `${this.currentStats.speed}`],
        ["Attack", `${this.currentStats.attack}`]
      ];
      for (const [label, value] of rows) {
        const div = document.createElement("div");
        div.textContent = `${label}: ${value}`;
        statsEl.appendChild(div);
      }
    }
  }

  saveCharacterAndReturnToMenu() {
    const nameInput = document.getElementById("victory-char-name");
    const name = (nameInput && nameInput.value.trim()) || "Champion";
    const saveData = {
      name,
      level: this.level,
      difficulty: this.difficulty,
      equipment: JSON.parse(JSON.stringify(this.equipment)),
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      cubeInventory: JSON.parse(JSON.stringify(this.cubeInventory)),
      stats: { ...this.currentStats },
      savedAt: Date.now()
    };
    const saved = loadSavedCharacters();
    saved.push(saveData);
    localStorage.setItem("spaceShooter_characters", JSON.stringify(saved));
    if (hasTalent("conqueror") && this.difficulty >= 4) {
      const def = this.lootSystem.getLootDefinition(0.9);
      addConquerorBonusItem({ name: def.name, type: def.type, stats: def.stats || {}, weight: def.weight || null });
    }

    stopBgm();
    document.getElementById("victory-overlay").classList.add("hidden");
    document.getElementById("main-menu").classList.remove("hidden");
    document.querySelector(".game-root").classList.add("hidden");
    refreshMainMenuLP();
    document.getElementById("pause-toggle").classList.add("hidden");
    document.getElementById("dev-toggle").classList.add("hidden");
    renderHallOfChampions();
  }

  update(dt) {
    if (this.gameOver) return;
    if (this.levelUpChoices) return;
    if (this.currentEvent) return;

    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining -= dt;
      dt = 0;
    }
    this.time += dt;
    tickAncestorSystem(this, dt);
    
    // Update tutorial system
    if (this.tutorialSystem) {
      this.tutorialSystem.update(dt);
    }
    this.timeSinceLastHit += dt;
    
    // Update damage flash timer
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      if (this.damageFlashTimer < 0) this.damageFlashTimer = 0;
    }

    // Lucky: increase global luck as long as you avoid damage
    if (this.hasUpgradeCard("lucky")) {
      const t = Math.min(this.timeSinceLastHit, 30);
      setGlobalLuck(0.1 + (t / 30) * 0.4);
    } else {
      setGlobalLuck(0);
    }
    tickRingEffects(this, dt);

    // Speed calculation: gear stats + card modifiers
    let effectiveSpeed = this.currentStats.speed;
    if (this.hasUpgradeCard("secureFooting") && this.swiftFeetTimer > 0) {
      this.swiftFeetTimer -= dt;
      if (this.swiftFeetTimer < 0) this.swiftFeetTimer = 0;
      effectiveSpeed *= 1.5;
    }
    if (this.hasUpgradeCard("berserkerRage")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      effectiveSpeed *= 1 + (1 - ratio) * 0.5;
    }
    const inHazard = this.hazardSystem?.playerInPatch(this.player);
    this.playerInWeakeningPatch = inHazard?.type === "weakeningGround";
    if (inHazard) {
      if (inHazard.type === "frozenGround") effectiveSpeed *= 0.7;
      if (inHazard.type === "slowZone" || inHazard.type === "webZone" || inHazard.type === "rootZone") {
        effectiveSpeed *= inHazard.slowMult ?? 0.6;
      }
      if (inHazard.type === "shockingGround" && Math.random() < dt * 0.2) {
        this.stunTimer = 0.5;
      }
      if (inHazard.type === "toxicGround") {
        this.toxicGroundTimer += dt;
        if (this.toxicGroundTimer >= 1) {
          this.toxicGroundTimer = 0;
          this.onPlayerDamaged(2, false);
        }
      }
      if (inHazard.type === "burningGround") {
        this.burningGroundTimer += dt;
        if (this.burningGroundTimer >= 2) {
          this.burningGroundTimer = 0;
          this.onPlayerDamaged(6, false);
        }
      }
    } else {
      this.toxicGroundTimer = 0;
      this.burningGroundTimer = 0;
      this.playerInWeakeningPatch = false;
    }
    if (this.whirlwindActive) effectiveSpeed *= 0.5;
    effectiveSpeed *= this.equipmentSpeedMult || 1;
    effectiveSpeed *= getRingMoveSpeedMultiplier(this);
    if (typeof this.getPillarMoveSpeedMultiplier === "function") {
      effectiveSpeed *= this.getPillarMoveSpeedMultiplier({ source: "player_move" });
    }
    if (this.hasBlessing("swiftness")) effectiveSpeed *= 1.5;
    if (hasTalent("cardSurge") && this.cardSurgeUntil > this.time) effectiveSpeed *= 1.2;
    if (this.playerSlowUntil > this.time) effectiveSpeed *= (this.playerSlowMult ?? 0.7);
    if (this.playerHasteUntil > this.time) effectiveSpeed *= (this.playerHasteMult ?? 1);
    // Frenzy buff: 40% movement speed
    if (this.frenzyBuffUntil > this.time) {
      effectiveSpeed *= 1.4;
    }
    effectiveSpeed *= getAncestorMoveSpeedMult(this);
    this.player.speed = effectiveSpeed;

    if (this.playerBurnUntil > this.time) {
      this.playerBurnAccum = (this.playerBurnAccum ?? 0) + dt;
      if (this.playerBurnAccum >= 0.5) {
        this.playerBurnAccum = 0;
        this.onPlayerDamaged(this.playerBurnDmg || 4, false);
      }
    } else this.playerBurnAccum = 0;

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      if (this.stunTimer < 0) this.stunTimer = 0;
    }

    if (this.dashMaxCharges == null) this.dashMaxCharges = 2;
    if (this.dashCharges == null) this.dashCharges = this.dashMaxCharges;
    if (this.dashRechargeTimer == null) this.dashRechargeTimer = 0;
    // Backward compatibility for existing "refresh dash cooldown" effects:
    // when cooldown is forced to 0 externally, refill charges.
    if (this.dashCooldown <= 0 && this.dashCharges < this.dashMaxCharges && this.dashRechargeTimer > 0) {
      this.dashCharges = this.dashMaxCharges;
      this.dashRechargeTimer = 0;
    }
    if (this.dashCharges < this.dashMaxCharges) {
      this.dashRechargeTimer -= dt;
      while (this.dashRechargeTimer <= 0 && this.dashCharges < this.dashMaxCharges) {
        this.dashCharges += 1;
        if (this.dashCharges < this.dashMaxCharges) {
          this.dashRechargeTimer += this.dashCooldownTime;
        } else {
          this.dashRechargeTimer = 0;
        }
      }
    }
    this.dashCooldown = this.dashCharges < this.dashMaxCharges ? Math.max(0, this.dashRechargeTimer) : 0;

    if (this.dashActive) {
      this.dashTimer -= dt;
      if (this.player && typeof this.player.tickDashAnimation === "function") {
        this.player.tickDashAnimation(dt);
      }
      // Calculate dash speed to achieve distance = 150 + player.speed * 0.2
      const dashSpeed = 750 + this.player.speed;
      const moveDist = dashSpeed * (this.dashDistanceMult ?? 1) * dt;
      const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
      let nx = this.player.position.x + this.dashDirection.x * moveDist;
      let ny = this.player.position.y + this.dashDirection.y * moveDist;
      nx = Math.max(margin, Math.min(nx, this.world.width - margin - this.player.size));
      ny = Math.max(margin, Math.min(ny, this.world.height - margin - this.player.size));
      
      const pi = PLAYER_WALL_COLLISION_INSET;
      const pBase = Math.max(1, this.player.size - 2 * pi);
      const pw = Math.max(1, pBase * 0.25);
      const ph = Math.max(1, pBase * 0.5);
      const pxo = pi + (pBase - pw) / 2;
      const pyo = pi + (pBase - ph) / 2;
      const testX = { x: nx + pxo, y: this.player.position.y + pyo, w: pw, h: ph };
      const testY = { x: this.player.position.x + pxo, y: ny + pyo, w: pw, h: ph };
      
      let canMoveX = true;
      let canMoveY = true;
      
      for (const obstacle of this.obstacles || []) {
        if (obstacle.destroyed || !obstacle.blocksMovement || obstacle.type === "ancientTree") continue;
        if (obstacleIntersectsRect(obstacle, testX)) {
          canMoveX = false;
        }
        
        if (obstacleIntersectsRect(obstacle, testY)) {
          canMoveY = false;
        }
      }
      
      const walls = this.world.tileWallRects || [];
      for (const wall of walls) {
        const wallRect = getWallCollisionRect(wall);
        if (testX.x < wallRect.x + wallRect.w && testX.x + testX.w > wallRect.x &&
            testX.y < wallRect.y + wallRect.h && testX.y + testX.h > wallRect.y) canMoveX = false;
        if (testY.x < wallRect.x + wallRect.w && testY.x + testY.w > wallRect.x &&
            testY.y < wallRect.y + wallRect.h && testY.y + testY.h > wallRect.y) canMoveY = false;
      }
      // Block movement on axes that would collide
      if (!canMoveX) nx = this.player.position.x;
      if (!canMoveY) ny = this.player.position.y;
      
      // If both blocked, stop the dash
      if (!canMoveX && !canMoveY) {
        this.dashActive = false;
        this.dashTrail = [];
        if (typeof this.runPillarEvent === "function") {
          this.runPillarEvent("onDashEnded", { reason: "blocked", time: this.time });
        }
      }
      
      this.player.position.set(nx, ny);

      this.dashTrail.push({
        x: this.player.position.x,
        y: this.player.position.y,
        alpha: 1 - (1 - this.dashTimer / this.dashDuration) * 0.8
      });
      if (this.dashTrail.length > 12) this.dashTrail.shift();

      if (this.dashActive && this.dashTimer <= 0) {
        this.dashActive = false;
        this.dashTrail = [];
        if (typeof this.runPillarEvent === "function") {
          this.runPillarEvent("onDashEnded", { reason: "duration_complete", time: this.time });
        }
      }
    } else if (this.bladeDashActive) {
      this.bladeDashTimer -= dt;
      const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
      const moveDist = this.bladeDashSpeed * dt;
      let nx = this.player.position.x + this.bladeDashDirection.x * moveDist;
      let ny = this.player.position.y + this.bladeDashDirection.y * moveDist;
      nx = Math.max(margin, Math.min(nx, this.world.width - margin - this.player.size));
      ny = Math.max(margin, Math.min(ny, this.world.height - margin - this.player.size));
      
      const pi = PLAYER_WALL_COLLISION_INSET;
      const pBase = Math.max(1, this.player.size - 2 * pi);
      const pw = Math.max(1, pBase * 0.25);
      const ph = Math.max(1, pBase * 0.5);
      const pxo = pi + (pBase - pw) / 2;
      const pyo = pi + (pBase - ph) / 2;
      const testX = { x: nx + pxo, y: this.player.position.y + pyo, w: pw, h: ph };
      const testY = { x: this.player.position.x + pxo, y: ny + pyo, w: pw, h: ph };
      
      let canMoveX = true;
      let canMoveY = true;
      
      for (const obstacle of this.obstacles || []) {
        if (obstacle.destroyed || !obstacle.blocksMovement || obstacle.type === "ancientTree") continue;
        if (obstacleIntersectsRect(obstacle, testX)) {
          canMoveX = false;
        }
        
        if (obstacleIntersectsRect(obstacle, testY)) {
          canMoveY = false;
        }
      }
      
      const walls = this.world.tileWallRects || [];
      for (const wall of walls) {
        const wallRect = getWallCollisionRect(wall);
        if (testX.x < wallRect.x + wallRect.w && testX.x + testX.w > wallRect.x &&
            testX.y < wallRect.y + wallRect.h && testX.y + testX.h > wallRect.y) canMoveX = false;
        if (testY.x < wallRect.x + wallRect.w && testY.x + testY.w > wallRect.x &&
            testY.y < wallRect.y + wallRect.h && testY.y + testY.h > wallRect.y) canMoveY = false;
      }
      // Block movement on axes that would collide
      if (!canMoveX) nx = this.player.position.x;
      if (!canMoveY) ny = this.player.position.y;
      
      // If both blocked, stop the blade dash
      if (!canMoveX && !canMoveY) {
        this.bladeDashActive = false;
        this.bladeDashHitIds.clear();
        if (typeof this.runPillarEvent === "function") {
          this.runPillarEvent("onDashEnded", { reason: "blade_dash_blocked", time: this.time });
        }
      }
      
      this.player.position.set(nx, ny);
      const cx = this.player.position.x + this.player.size / 2;
      const cy = this.player.position.y + this.player.size / 2;
      const hit = this.enemiesInRadius(cx, cy, 40);
      for (const e of hit) {
        if (!this.bladeDashHitIds.has(e.id)) {
          this.bladeDashHitIds.add(e.id);
          const slot = this.bladeDashSlot;
          const skillId = slot != null ? this.skills?.[slot] : "bladeDash";
          const mods = slot != null ? getModsForSkillSlot(this, slot) : [];
          this.dealDamageToEnemy(
            e,
            this.computeSkillDamage(e, this.bladeDashMult, slot, { sacrificeMult: this.bladeDashSacrificeMult, skillId }),
            {
              isSkill: true,
              skillSlot: slot,
              modList: mods,
              triggeredCast: !!this.bladeDashTriggeredCast,
              allowTriggeredProcs: this.bladeDashAllowTriggeredProcs === true
            }
          );
        }
      }
      const breakHit = this.breakablesInRadius(cx, cy, 40);
      for (const b of breakHit) {
        if (!this.bladeDashHitBreakableIds?.has(b.id)) {
          if (!this.bladeDashHitBreakableIds) this.bladeDashHitBreakableIds = new Set();
          this.bladeDashHitBreakableIds.add(b.id);
          const dmg = Math.round(this.currentStats.attack * this.bladeDashMult);
          this.dealDamageToBreakable(b, dmg);
        }
      }
      if (this.bladeDashActive && this.bladeDashTimer <= 0) {
        this.bladeDashActive = false;
        this.bladeDashHitIds.clear();
        if (this.bladeDashHitBreakableIds) this.bladeDashHitBreakableIds.clear();
        if (typeof this.runPillarEvent === "function") {
          this.runPillarEvent("onDashEnded", { reason: "blade_dash_complete", time: this.time });
        }
      }
    } else if (this.dashStrikeState) {
      // Player position is driven by updateDashStrike
    } else if (this.backfireDashState) {
      // Player position is driven by updateBackfireDash
    } else if (this.stunTimer <= 0) {
      const prevPx = this.player.position.x;
      const prevPy = this.player.position.y;
      const walls = this.world.tileWallRects || [];
      const blocking = [...(this.obstacles || []).filter(o => !o.destroyed)];
      this.player.update(dt, this.input, this.world, blocking, walls);
      // Track player movement for tutorial
      if (this.tutorialSystem) {
        const axis = this.input.getAxis();
        if (axis.x !== 0 || axis.y !== 0) {
          this.tutorialSystem.onPlayerMove();
        }
      }
    }
    if (this.playerHasteUntil > this.time) {
      this.adrenalineTrail = this.adrenalineTrail || [];
      this.adrenalineTrail.push({ x: this.player.position.x, y: this.player.position.y });
      if (this.adrenalineTrail.length > 12) this.adrenalineTrail.shift();
    } else {
      this.adrenalineTrail = [];
    }

    if (this.hasUpgradeCard("cubeMagnet")) this.applyMagnetEffect(dt);

    if (this.hasUpgradeCard("healthRegen")) {
      const heal = this.currentStats.maxHealth * 0.03 * dt;
      this.currentHealth = Math.min(this.currentStats.maxHealth, this.currentHealth + heal);
      this.updateHealthBar();
    }

    if (this.fierySpawned && !this.fieryKilled && this.fieryTimer > 0) {
      this.fieryTimer -= dt;
    }

    this.lootSystem.update(dt, this.player, (item) => this.handleLootPickup(item));
    this.updateEnemyDeathSmokeVfx(dt);
    this.updateUpgradeCardEffects(dt);
    if (this.hazardSystem) this.hazardSystem.update(dt, this);
    // Update obstacles
    if (this.obstacles) {
      for (const obstacle of this.obstacles) {
        obstacle.update(dt, this);
      }
      this.obstacles = this.obstacles.filter(obs => !obs.destroyed);
    }
    if (this.breakables) {
      for (const b of this.breakables) {
        b.update(dt, this);
      }
      this.breakables = this.breakables.filter(b => !b.isDead);
    }
    this.updateCombat(dt);
    
    // Mark map as cleared if all enemies are defeated
    if (!this.clearedMaps.has(this.currentMapId)) {
      const es = this.enemySystem;
      const allEnemiesDead = es.enemies.length === 0 && (!es.boss || es.boss.isDead);
      if (allEnemiesDead) {
        this.clearedMaps.add(this.currentMapId);
      }
    }
    
    // Handle trial timer
    if (this.trialTimer > 0 && !this.trialCompleted) {
      this.trialTimer -= dt;
      const remainingBosses = this.trialBosses.filter(id => {
        const enemy = this.enemySystem.enemies.find(e => e.id === id);
        return enemy && !enemy.isDead;
      });
      if (remainingBosses.length === 0 && this.trialBosses.length > 0) {
        // All trial bosses defeated within time
        addLegacyPoints(1);
        this.lpEarnedThisRun += 1;
        this.trialCompleted = true;
        this.trialTimer = 0;
      } else if (this.trialTimer <= 0) {
        // Time expired
        this.trialTimer = 0;
      }
    }

    if (this.bossExtractionActive && !this.victoryPortal) {
      this.bossExtractionTimeLeft = Math.max(0, (this.bossExtractionTimeLeft ?? 0) - dt);
      if (this.bossExtractionTimeLeft <= 0) {
        this.bossExtractionActive = false;
        this.spawnExtractionPortalNearPlayer();
      }
    }
    
    this.resolveCollisions();
    this.ensurePlayerNotStuck();
    this.updateAuras(dt);

    if (this.exitTransitionCooldown > 0) this.exitTransitionCooldown -= dt;
    if (!this.victoryPortal) this.checkExits();
    this.checkVictoryPortal(dt);
    this.nearInteractable = null;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;

    this.nearSearchableProp = null;
    for (const prop of this.searchableProps || []) {
      if (prop.isSearched) continue;
      if (prop.playerInRange(this.player)) {
        this.nearSearchableProp = prop;
        break;
      }
    }

    if (this.searchingProp) {
      if (this.currentHealth <= 0 || this.stunTimer > 0 || !this.searchingProp.playerInRange(this.player) || !this.input.keys.has("e")) {
        this.searchingProp = null;
      } else {
        let searchMult = getAncestorSearchSpeedMult(this, this.searchingProp);
        if (typeof this.getPillarChestOpenSpeedMultiplier === "function") {
          searchMult *= this.getPillarChestOpenSpeedMultiplier(this.searchingProp);
        }
        if (hasRing(this, "ring_locksmith") && this.searchingProp?.typeId === "chest") {
          searchMult *= Math.pow(1.2, getRingCount(this, "ring_locksmith"));
        }
        this.searchingProp.updateSearch(dt * searchMult, this.player);
        const requiredSearchTime = typeof this.searchingProp.getRequiredSearchTime === "function"
          ? this.searchingProp.getRequiredSearchTime()
          : (Number(this.searchingProp?.def?.searchTime) || 0);
        if (this.searchingProp.searchProgress >= requiredSearchTime) {
          this.searchingProp.finishSearch(this);
          handleAncestorOnChestOpened(this);
          if (typeof this.runPillarEvent === "function") {
            this.runPillarEvent("onChestOpened", {
              prop: this.searchingProp,
              time: this.time
            });
          }
          this.searchingProp = null;
        }
      }
    } else if (this.nearSearchableProp && this.input.keys.has("e")) {
      this.searchingProp = this.nearSearchableProp;
      this.searchingProp.startSearch(this.player);
    }

    for (const obj of this.mapInteractables) {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      if (Math.abs(px - cx) < 80 && Math.abs(py - cy) < 80) {
        this.nearInteractable = obj;
        break;
      }
    }

    if (!this.searchingProp && this.nearInteractable && this.input.keys.has("e")) {
      this.interactWithMapObject(this.nearInteractable);
      const shouldConsume = this.nearInteractable.type !== "shop" && this.nearInteractable.consumeOnInteract !== false;
      if (shouldConsume) {
        this.mapInteractables = this.mapInteractables.filter((o) => o !== this.nearInteractable);
      }
      this.nearInteractable = null;
    }
    
    this.updateBlessings(dt);

    this.updateBossHealthBar();
    this.updateDashUI();
    this.updateSkillEffects(dt);
    this.updateSkillUI();
    this.camera.follow(this.player, this.world.width, this.world.height, dt);
  }

  updateBossHealthBar() {
    // Boss health bar is now drawn on canvas, so hide the DOM element
    if (this.bossHealthBarEl) {
      this.bossHealthBarEl.classList.add("hidden");
    }
  }

  playerInExit(exit) {
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    return (
      px >= exit.x && px <= exit.x + exit.w &&
      py >= exit.y && py <= exit.y + exit.h
    );
  }

  saveMapEnemyState(mapId) {
    // Save current enemy state for this map
    const es = this.enemySystem;
    this.mapEnemyStates[mapId] = {
      enemies: es.enemies.map(e => ({
        id: e.id,
        position: { x: e.position.x, y: e.position.y },
        size: e.size,
        name: e.name,
        color: e.color,
        maxHealth: e.maxHealth,
        health: e.health,
        attack: e.attack,
        speed: e.speed,
        defense: e.defense,
        attackCooldown: e.attackCooldown,
        attackTimer: e.attackTimer,
        activated: e.activated,
        enemyTier: e.enemyTier,
        isElite: e.isElite,
        tierXpMult: e.tierXpMult,
        affixes: e.affixes ? [...e.affixes] : [],
        burnUntil: e.burnUntil,
        burnDps: e.burnDps,
        burnAccum: e.burnAccum || 0,
        toxicStacks: e.toxicStacks,
        toxicUntil: e.toxicUntil,
        toxicAccum: e.toxicAccum || 0,
        voidDefenseUntil: e.voidDefenseUntil,
        voidDefenseMult: e.voidDefenseMult,
        regenRate: e.regenRate,
        worldBounds: e.worldBounds
      })),
      boss: es.boss ? {
        id: es.boss.id,
        position: { x: es.boss.position.x, y: es.boss.position.y },
        size: es.boss.size,
        name: es.boss.name,
        color: es.boss.color,
        maxHealth: es.boss.maxHealth,
        health: es.boss.health,
        attack: es.boss.attack,
        speed: es.boss.speed,
        defense: es.boss.defense,
        attackCooldown: es.boss.attackCooldown,
        attackTimer: es.boss.attackTimer,
        phase2: es.boss.phase2,
        chargeCooldown: es.boss.chargeCooldown,
        chargeTimer: es.boss.chargeTimer,
        chargeActive: es.boss.chargeActive,
        chargeDir: es.boss.chargeDir ? { x: es.boss.chargeDir.x, y: es.boss.chargeDir.y } : null,
        projectileCooldown: es.boss.projectileCooldown,
        projectileTimer: es.boss.projectileTimer,
        minionCooldown: es.boss.minionCooldown,
        minionTimer: es.boss.minionTimer,
        burnUntil: es.boss.burnUntil,
        burnDps: es.boss.burnDps,
        burnAccum: es.boss.burnAccum || 0,
        slowUntil: es.boss.slowUntil,
        slowMult: es.boss.slowMult,
        stunUntil: es.boss.stunUntil,
        toxicStacks: es.boss.toxicStacks,
        toxicUntil: es.boss.toxicUntil,
        toxicAccum: es.boss.toxicAccum || 0,
        voidDefenseUntil: es.boss.voidDefenseUntil,
        voidDefenseMult: es.boss.voidDefenseMult
      } : null,
      projectiles: es.projectiles.map(p => ({
        position: { x: p.position.x, y: p.position.y },
        velocity: { x: p.velocity.x, y: p.velocity.y },
        damage: p.damage,
        size: p.size,
        lifetime: p.lifetime,
        maxLifetime: p.maxLifetime
      })),
      respawnQueue: [...es.respawnQueue]
    };
  }

  restoreMapEnemyState(mapId) {
    const savedState = this.mapEnemyStates[mapId];
    if (!savedState) {
      // No saved state, spawn initial enemies
      this.enemySystem.enemies = [];
      this.enemySystem.boss = null;
      this.enemySystem.projectiles = [];
      this.enemySystem.respawnQueue = [];
      this.enemySystem.spawnInitial();
      return;
    }

    const es = this.enemySystem;
    
    // Restore enemies
    es.enemies = savedState.enemies.map(data => {
      const base = ENEMY_TYPES.find(t => t.name === data.name) || ENEMY_TYPES[0];
      const typeDef = { ...base, maxHealth: data.maxHealth, attack: data.attack, speed: data.speed, size: data.size };
      const enemy = new Enemy(data.position.x, data.position.y, typeDef);
      // Override the auto-generated ID with the saved one
      ENEMY_ID_COUNTER = Math.max(ENEMY_ID_COUNTER, data.id);
      enemy.id = data.id;
      enemy.health = data.health;
      enemy.defense = data.defense;
      enemy.attackCooldown = data.attackCooldown;
      enemy.attackTimer = data.attackTimer;
      enemy.activated = data.activated;
      enemy.enemyTier = data.enemyTier;
      enemy.isElite = data.isElite;
      enemy.tierXpMult = data.tierXpMult;
      enemy.affixes = data.affixes ? [...data.affixes] : [];
      enemy.burnUntil = data.burnUntil;
      enemy.burnDps = data.burnDps;
      enemy.burnAccum = data.burnAccum || 0;
      enemy.toxicStacks = data.toxicStacks;
      enemy.toxicUntil = data.toxicUntil;
      enemy.toxicAccum = data.toxicAccum || 0;
      enemy.voidDefenseUntil = data.voidDefenseUntil;
      enemy.voidDefenseMult = data.voidDefenseMult;
      enemy.regenRate = data.regenRate;
      enemy.worldBounds = data.worldBounds;
      return enemy;
    });

    // Restore boss
    if (savedState.boss) {
      const bossData = savedState.boss;
      const boss = new Boss(bossData.position.x, bossData.position.y);
      boss.health = bossData.health;
      boss.defense = bossData.defense;
      boss.attackCooldown = bossData.attackCooldown;
      boss.attackTimer = bossData.attackTimer;
      boss.phase2 = bossData.phase2;
      boss.chargeCooldown = bossData.chargeCooldown;
      boss.chargeTimer = bossData.chargeTimer;
      boss.chargeActive = bossData.chargeActive;
      if (bossData.chargeDir) {
        boss.chargeDir.set(bossData.chargeDir.x, bossData.chargeDir.y);
      }
      boss.projectileCooldown = bossData.projectileCooldown;
      boss.projectileTimer = bossData.projectileTimer;
      boss.minionCooldown = bossData.minionCooldown;
      boss.minionTimer = bossData.minionTimer;
      boss.burnUntil = bossData.burnUntil;
      boss.burnDps = bossData.burnDps;
      boss.burnAccum = bossData.burnAccum || 0;
      boss.slowUntil = bossData.slowUntil;
      boss.slowMult = bossData.slowMult;
      boss.stunUntil = bossData.stunUntil;
      boss.toxicStacks = bossData.toxicStacks;
      boss.toxicUntil = bossData.toxicUntil;
      boss.toxicAccum = bossData.toxicAccum || 0;
      boss.voidDefenseUntil = bossData.voidDefenseUntil;
      boss.voidDefenseMult = bossData.voidDefenseMult;
      es.boss = boss;
    } else {
      es.boss = null;
    }

    // Restore projectiles (simplified - just clear them)
    es.projectiles = [];
    es.respawnQueue = savedState.respawnQueue || [];
  }

  checkExits() {
    if (this.exitTransitionCooldown > 0 || !this.currentMap.exits) return;
    if (this.cursedChestBlocked) return;
    for (const exit of this.currentMap.exits) {
      if (this.playerInExit(exit)) {
        this.transitionToMap(exit.targetMapId, exit.spawnSide);
        this.exitTransitionCooldown = 0.6;
        break;
      }
    }
  }

  spawnObstacles(mapId) {
    this.obstacles = [];
    const mapDef = MAP_DEFS.find(m => m.id === mapId);
    if (!mapDef) return;

    // Get available obstacle types for this map
    const availableTypes = Object.values(OBSTACLE_TYPES).filter(obs => 
      obs.maps.includes(mapId)
    );
    if (availableTypes.length === 0) return;

    // Determine spawn count (8-15)
    const count = 8 + Math.floor(Math.random() * 8);
    const margin = this.world.wallThickness + 80;
    const maxAttempts = count * 50; // Try many times to find valid positions
    let attempts = 0;
    let spawned = 0;

    // Get exit zones to avoid blocking paths
    const exitZones = (mapDef.exits || []).map(exit => ({
      x: exit.x - 100,
      y: exit.y - 100,
      w: exit.w + 200,
      h: exit.h + 200
    }));

    // Get player spawn position
    const playerSpawnX = this.player.position.x;
    const playerSpawnY = this.player.position.y;
    const playerSpawnZone = {
      x: playerSpawnX - 100,
      y: playerSpawnY - 100,
      w: 200,
      h: 200
    };

    while (spawned < count && attempts < maxAttempts) {
      attempts++;
      const typeDef = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      const size = typeDef.size;
      
      // Random position
      const minSpawnX = Math.max(margin, this.world.width * 0.2);
      const xRange = Math.max(1, this.world.width - margin - size.w - minSpawnX);
      const x = minSpawnX + Math.random() * xRange;
      const y = margin + Math.random() * (this.world.height - 2 * margin - size.h);

      // Check if position is valid
      let valid = true;

      // Check exit zones
      for (const zone of exitZones) {
        if (x < zone.x + zone.w && x + size.w > zone.x &&
            y < zone.y + zone.h && y + size.h > zone.y) {
          valid = false;
          break;
        }
      }

      // Check player spawn zone
      if (x < playerSpawnZone.x + playerSpawnZone.w && x + size.w > playerSpawnZone.x &&
          y < playerSpawnZone.y + playerSpawnZone.h && y + size.h > playerSpawnZone.y) {
        valid = false;
      }

      // Check overlap with existing obstacles
      if (valid) {
        for (const existing of this.obstacles) {
          if (x < existing.position.x + existing.size.w && x + size.w > existing.position.x &&
              y < existing.position.y + existing.size.h && y + size.h > existing.position.y) {
            valid = false;
            break;
          }
        }
      }

      // Check overlap with loot
      if (valid) {
        for (const loot of this.lootSystem.items) {
          const lootPos = loot.displayPosition;
          if (x < lootPos.x + loot.size && x + size.w > lootPos.x &&
              y < lootPos.y + loot.size && y + size.h > lootPos.y) {
            valid = false;
            break;
          }
        }
      }

      // Check overlap with enemies (only if enemySystem is initialized)
      if (valid && this.enemySystem) {
        const allEnemies = [...this.enemySystem.enemies];
        if (this.enemySystem.boss) allEnemies.push(this.enemySystem.boss);
        for (const enemy of allEnemies) {
          if (enemy.isDead) continue;
          if (x < enemy.position.x + enemy.size && x + size.w > enemy.position.x &&
              y < enemy.position.y + enemy.size && y + size.h > enemy.position.y) {
            valid = false;
            break;
          }
        }
      }

      // Check overlap with interactables
      if (valid) {
        for (const obj of this.mapInteractables) {
          if (x < obj.x + obj.w && x + size.w > obj.x &&
              y < obj.y + obj.h && y + size.h > obj.y) {
            valid = false;
            break;
          }
        }
      }

      if (valid) {
        const obstacle = new Obstacle(x, y, typeDef);
        this.obstacles.push(obstacle);
        spawned++;
      }
    }
  }

  spawnSubAreas(mapId) {
    // Sub-areas removed from game
  }

  transitionToMap(targetMapId, spawnSide) {
    const targetMap = MAP_DEFS.find((m) => m.id === targetMapId);
    if (!targetMap) return;

    // Save current map's enemy state and environmental elements before leaving (if we were on a map)
    if (this.currentMapId !== undefined && this.currentMapId !== null) {
      this.saveMapEnemyState(this.currentMapId);
      this.saveMapEnvironmentalState(this.currentMapId);
    }

    this.currentMapId = targetMapId;
    this.currentMap = targetMap;
    this.world.setTheme(targetMap);

    this.hazardSystem = new HazardSystem(this.world, this.conditions);

    this.lootSystem.items = [];
    this.playerProjectiles = [];
    this.skillEffects = [];
    this.hitStopRemaining = 0;
    this.cameraShakeUntil = 0;
    this.cameraShakeAmount = 0;
    this.dashActive = false;
    this.dashTrail = [];
    const lootQual = targetMap.lootQuality;
    this.lootSystem.setMapLootQuality(lootQual);
    this.lootSystem.setDifficulty(this.difficulty);

    if (hasTalent("immortal")) this.immortalShield = 30;

    if (hasTalent("treasureHunter") && targetMapId % 3 === 2) {
      const cx = this.world.width / 2 - 10;
      const cy = this.world.height / 2 - 10;
      this.lootSystem.spawnBurstAt(cx, cy, 2, 0.8);
    }

    this.empowerStacks = [0, 0, 0, 0];
    this.enemySystem.setMap(targetMap);
    
    // Check if we've visited this map before
    const isFirstVisit = !this.visitedMaps.has(targetMapId);
    
    if (isFirstVisit) {
      // First visit: initialize mapInteractables and spawn obstacles and sub-areas
      this.mapInteractables = [];
      if (hasTalent("socketFinder") && Math.random() < 0.2) {
        const margin = this.world.wallThickness + 80;
        const ix = margin + Math.random() * (this.world.width - 2 * margin - 64);
        const iy = margin + Math.random() * (this.world.height - 2 * margin - 64);
        this.mapInteractables.push({ type: "socketWorkshop", x: ix, y: iy, w: 64, h: 64 });
      }
      
      // Spawn obstacles and sub-areas before enemies (so enemies don't spawn inside rooms)
      this.spawnObstacles(targetMapId);
      this.spawnSubAreas(targetMapId);
      // Save the environmental state for future visits
      this.saveMapEnvironmentalState(targetMapId);
      
      // Spawn initial enemies (after sub-areas are spawned)
      this.enemySystem.enemies = [];
      this.enemySystem.boss = null;
      this.enemySystem.projectiles = [];
      this.enemySystem.respawnQueue = [];
      this.enemySystem.spawnInitial(this);
      this.visitedMaps.add(targetMapId);
    } else {
      // Returning to a visited map: restore environmental elements and enemy state
      this.restoreMapEnvironmentalState(targetMapId);
      this.restoreMapEnemyState(targetMapId);
    }

    if (this.escortQuest?.active && targetMapId === 0) {
      this.resolveStrangerQuest();
    }
    
    // Spawn shrine based on interval
    this.shrineSpawnCounter++;
    if (this.shrineSpawnCounter >= this.shrineSpawnInterval) {
      const shrineDef = SHRINE_DEFS[Math.floor(Math.random() * SHRINE_DEFS.length)];
      const margin = this.world.wallThickness + 80;
      
      // Try to find valid position (not inside sub-areas)
      let valid = false;
      let sx, sy;
      let attempts = 0;
      while (!valid && attempts < 50) {
        sx = margin + Math.random() * (this.world.width - 2 * margin - 64);
        sy = margin + Math.random() * (this.world.height - 2 * margin - 64);
        valid = true;
        attempts++;
      }
      
      if (valid) {
        this.mapInteractables.push({
          type: "shrine",
          shrineId: shrineDef.id,
          shrineName: shrineDef.name,
          shrineDescription: shrineDef.description,
          shrineIcon: shrineDef.icon,
          shrineColor: shrineDef.color,
          shrineAuraColor: shrineDef.auraColor,
          x: sx,
          y: sy,
          w: 64,
          h: 64,
          used: false
        });
        this.shrineSpawnCounter = 0;
        this.shrineSpawnInterval = 2 + Math.floor(Math.random() * 3); // New interval 2-4
      } else {
        this.shrineSpawnCounter++;
      }
    } else {
      this.shrineSpawnCounter++;
    }

    const margin = this.world.wallThickness + 60;
    const centerY = this.world.height / 2 - this.player.size / 2;

    if (spawnSide === "left") {
      this.player.position.set(margin, centerY);
    } else if (spawnSide === "right") {
      this.player.position.set(this.world.width - margin - this.player.size, centerY);
    } else {
      this.player.position.set(this.world.width / 2 - this.player.size / 2, centerY);
    }

    // On map transitions, snap camera immediately to the player's new spawn position.
    if (this.camera) {
      this.camera.snapTo(this.player, this.world.width, this.world.height);
    }

    this.updateMapUI();
    this.tryTriggerEvent();
  }

  tryTriggerEvent() {
    // Require at least 3 maps visited before events can trigger
    if (this.visitedMaps.size < 3) return;
    if (this.eventsOccurredThisRun.size >= EVENT_DEFS.length) return;
    if (Math.random() >= 0.25) return;
    const available = EVENT_DEFS.filter((e) => !this.eventsOccurredThisRun.has(e.id));
    if (available.length === 0) return;
    const event = available[Math.floor(Math.random() * available.length)];
    this.eventsOccurredThisRun.add(event.id);
    this.showEventCard(event);
  }

  showEventCard(eventDef) {
    this.paused = true;
    this.currentEvent = eventDef;
    const overlay = document.getElementById("event-overlay");
    const titleEl = document.getElementById("event-title");
    const descEl = document.getElementById("event-desc");
    const choicesEl = document.getElementById("event-choices");
    const merchantPick = document.getElementById("event-merchant-pick");
    if (!overlay || !titleEl || !descEl || !choicesEl) return;
    titleEl.textContent = eventDef.name;
    descEl.textContent = eventDef.desc;
    choicesEl.innerHTML = "";
    merchantPick.classList.add("hidden");
    if (eventDef.id === "fiery") {
      const btn = document.createElement("button");
      btn.className = "event-choice-btn";
      btn.textContent = "Face the Fiery";
      btn.onclick = () => this.resolveEventChoice(eventDef.id, "face");
      choicesEl.appendChild(btn);
    } else {
      for (const choice of eventDef.choices) {
        const btn = document.createElement("button");
        btn.className = "event-choice-btn";
        btn.textContent = choice.label;
        btn.onclick = () => this.resolveEventChoice(eventDef.id, choice.id);
        choicesEl.appendChild(btn);
      }
    }
    overlay.classList.remove("hidden");
  }

  resolveEventChoice(eventId, choiceId) {
    const overlay = document.getElementById("event-overlay");
    const merchantPick = document.getElementById("event-merchant-pick");
    const choicesEl = document.getElementById("event-choices");
    if (eventId === "merchant" && choiceId === "invest") {
      const equippable = this.inventory.filter((i) => this.isItemEquippable(i) && i.type !== "Upgrade Card");
      if (equippable.length === 0) {
        this.closeEventOverlay();
        return;
      }
      choicesEl.classList.add("hidden");
      merchantPick.classList.remove("hidden");
      const list = document.getElementById("event-invest-list");
      list.innerHTML = "";
      for (const item of equippable) {
        const li = document.createElement("li");
        li.textContent = `${item.name} (${item.type})`;
        li.onclick = () => {
          this.pendingMerchantInvestment = item;
          const idx = this.inventory.indexOf(item);
          this.inventory.splice(idx, 1);
          this.updateInventoryUI();
          this.updateEquippedUI();
          this.recalculateStats();
          merchantPick.classList.add("hidden");
          choicesEl.classList.remove("hidden");
          this.closeEventOverlay();
        };
        list.appendChild(li);
      }
      document.getElementById("event-invest-cancel").onclick = () => {
        merchantPick.classList.add("hidden");
        choicesEl.classList.remove("hidden");
        this.closeEventOverlay();
      };
      return;
    }
    if (eventId === "merchant" && choiceId === "decline") {
      this.closeEventOverlay();
      return;
    }
    if (eventId === "stranger") {
      if (choiceId === "help") {
        this.escortQuest = { active: true, targetMapId: 0 };
        this.updateEscortQuestUI();
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "shrine") {
      if (choiceId === "offerXp") {
        const sacrifice = Math.floor(this.xp * 0.3);
        this.xp -= sacrifice;
        this.updateXpUI();
      } else if (choiceId === "destroy") {
        this.inventory = [];
        this.equipment = { Helmet: null, "Body Armour": null, Weapon: null, Boots: null, Ring1: null, Ring2: null };
        this.updateInventoryUI();
        this.updateEquippedUI();
        this.recalculateStats();
        this.lpMultiplier = 2;
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "cursedChest") {
      if (choiceId === "open") {
        this.grantEventRareEquipment();
        this.spawnCursedChestEnemy();
        this.cursedChestBlocked = true;
      }
      this.closeEventOverlay();
      return;
    }
    if (eventId === "fiery" && choiceId === "face") {
      this.spawnFiery();
      this.fieryTimer = 30;
      this.closeEventOverlay();
      return;
    }
    this.closeEventOverlay();
  }

  closeEventOverlay() {
    this.paused = false;
    this.currentEvent = null;
    const overlay = document.getElementById("event-overlay");
    const merchantPick = document.getElementById("event-merchant-pick");
    const choicesEl = document.getElementById("event-choices");
    if (overlay) overlay.classList.add("hidden");
    if (merchantPick) merchantPick.classList.add("hidden");
    if (choicesEl) choicesEl.classList.remove("hidden");
  }

  grantEventRareEquipment() {
    const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
    const type = types[Math.floor(Math.random() * types.length)];
    const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
    const def = generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.5, 0.65, null, { difficulty: diff });
    this.inventory.push({
      id: 50000 + Math.floor(Math.random() * 10000),
      name: def.name,
      type: def.type,
      stats: def.stats || {},
      cardKey: null,
      description: "",
      weight: def.weight,
      rarity: def.rarity,
      modifiers: def.modifiers || [],
      baseStat: def.baseStat || null
    });
    this.updateInventoryUI();
  }

  spawnCursedChestEnemy() {
    const margin = this.world.wallThickness + 80;
    const cx = this.world.width / 2 - 30;
    const cy = this.world.height / 2 - 30;
    const typeDef = {
      name: "Cursed Guardian",
      color: "#7c3aed",
      size: 52,
      maxHealth: 200,
      attack: 25,
      speed: 90
    };
    const s = this.currentMap.enemyScale || { hp: 1, attack: 1, speed: 1 };
    typeDef.maxHealth = Math.round(typeDef.maxHealth * (s.hp || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.attack = Math.round(typeDef.attack * (s.attack || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.speed = Math.round(typeDef.speed * (s.speed || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    const enemy = new Enemy(cx, cy, typeDef);
    enemy.isCursedChestGuardian = true;
    this.enemySystem.enemies.push(enemy);
  }

  spawnFiery() {
    const margin = this.world.wallThickness + 60;
    const x = margin + Math.random() * (this.world.width - margin * 2 - 40);
    const y = margin + Math.random() * (this.world.height - margin * 2 - 40);
    const typeDef = {
      name: "Golden Fiery",
      color: "#fbbf24",
      size: 36,
      maxHealth: 80,
      attack: 12,
      speed: 140
    };
    const s = this.currentMap.enemyScale || { hp: 1, attack: 1, speed: 1 };
    typeDef.maxHealth = Math.round(typeDef.maxHealth * (s.hp || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.attack = Math.round(typeDef.attack * (s.attack || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    typeDef.speed = Math.round(typeDef.speed * (s.speed || 1) * (DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1));
    const enemy = new Enemy(x, y, typeDef);
    enemy.isFiery = true;
    enemy.wanderDirection = new Vec2(Math.random() - 0.5, Math.random() - 0.5);
    enemy.wanderTimer = 0;
    enemy.worldBounds = { width: this.world.width, height: this.world.height };
    this.enemySystem.enemies.push(enemy);
    this.fierySpawned = true;
  }

  resolveStrangerQuest() {
    this.escortQuest = null;
    this.updateEscortQuestUI();
    const cx = this.world.width / 2 - 20;
    const cy = this.world.height / 2 - 20;
    const rewardType = Math.random() < 0.5 ? "high" : "low";
    if (rewardType === "high") {
      this.lootSystem.spawnBurstAt(cx, cy, 4, 0.9);
      this.grantXP(80);
      this.showNotification("Quest Complete!", "You successfully escorted the stranger home! They reward you with valuable treasures and 80 XP.");
    } else {
      this.lootSystem.spawnBurstAt(cx, cy, 3, 0.5);
      this.grantXP(40);
      this.showNotification("Quest Complete!", "You successfully escorted the stranger home! They reward you with treasures and 40 XP.");
    }
  }

  showNotification(title, message) {
    const overlay = document.getElementById("notification-overlay");
    const titleEl = document.getElementById("notification-title");
    const messageEl = document.getElementById("notification-message");
    const closeBtn = document.getElementById("notification-close");
    
    if (!overlay || !titleEl || !messageEl || !closeBtn) return;
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    overlay.classList.remove("hidden");
    this.paused = true;
    
    const handleClose = () => {
      overlay.classList.add("hidden");
      this.paused = false;
      closeBtn.removeEventListener("click", handleClose);
    };
    
    closeBtn.addEventListener("click", handleClose);
  }

  updateMapUI() {
    if (!this.mapNameEl) return;
    this.mapNameEl.textContent = `${this.currentMap.name} (Map ${this.currentMap.number})`;
    this.updateEnemyCountUI();
    this.updateEscortQuestUI();
  }

  updateEscortQuestUI() {
    if (!this.escortQuestIndicatorEl) return;
    if (this.escortQuest?.active) {
      this.escortQuestIndicatorEl.classList.remove("hidden");
    } else {
      this.escortQuestIndicatorEl.classList.add("hidden");
    }
  }

  updateEnemyCountUI() {
    if (!this.enemyCountEl) return;
    const es = this.enemySystem;
    const count = es.enemies.length + (es.boss ? 1 : 0);
    this.enemyCountEl.textContent = `Enemies: ${count}`;
    this.enemyCountEl.classList.toggle("hidden", this.currentMap?.id === 4 && !es.boss);
  }

  updateXpUI() {
    const threshold = getXpForLevel(this.level + 1);
    const prevThreshold = getXpForLevel(this.level);
    const xpInLevel = this.xp - prevThreshold;
    const xpNeeded = threshold - prevThreshold;
    const pct = this.level >= 99 ? 1 : xpNeeded > 0 ? Math.min(1, xpInLevel / xpNeeded) : 0;

    if (this.xpBarFillEl) this.xpBarFillEl.style.width = `${Math.round(pct * 100)}%`;
    if (this.xpLabelEl) this.xpLabelEl.textContent = this.level >= 99 ? "MAX" : `${Math.floor(xpInLevel)} / ${Math.floor(xpNeeded)} XP`;
    if (this.playerLevelEl) this.playerLevelEl.textContent = `Level ${this.level}`;
  }

  grantXP(amount) {
    let mult = this.equipmentXpGainedMult ?? 1;
    // Frenzy buff: 20% XP gained
    if (this.frenzyBuffUntil > this.time) {
      mult *= 1.2;
    }
    const rounded = Math.round(amount * mult);
    this.xp += rounded;
    this.updateXpUI();
    this.checkLevelUp();
    for (let i = 0; i < (this.skills?.length || 0); i++) {
      const skillId = this.skills[i];
      if (!skillId) continue;
      markSkillEncountered(skillId);
      const result = addSkillXp(skillId, rounded);
      if (result && result.leveledUp) {
        this.skillLevelUpThisFrame = this.skillLevelUpThisFrame || [];
        this.skillLevelUpThisFrame.push({ skillId, level: result.level });
      }
    }
  }

  checkLevelUp() {
    if (this.levelUpChoices) return;
    const nextThreshold = getXpForLevel(this.level + 1);
      if (this.xp >= nextThreshold) {
      this.level++;
      this.showLevelUpChoices();
    }
  }

  buildLevelUpCards() {
    const defs = ATTACK_UPGRADE_DEFS[this.attackType];
    if (!defs) return [];
    const takenUpgrades = new Set((this.runAttackUpgrades || []).map((u) => u.id));
    const takenPenalties = new Set((this.runAttackPenalties || []).map((p) => p.id));

    const pickStandardUpgrade = () => {
      const pool = (defs.standardUpgrades || []).filter((u) => !takenUpgrades.has(u.id));
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      const value = rollUpgradeValue(def);
      return { id: def.id, name: def.name, description: def.description, value };
    };
    const pickStandardPenalty = () => {
      const pool = (defs.standardPenalties || []).filter((p) => !takenPenalties.has(p.id));
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      const value = rollUpgradeValue(def);
      return { id: def.id, name: def.name, description: def.description, value };
    };
    const pickUniqueUpgrade = () => {
      const pool = (defs.uniqueUpgrades || []).filter((u) => !takenUpgrades.has(u.id));
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      return { id: def.id, name: def.name, description: def.description, value: undefined };
    };
    const pickUniquePenalty = (excludeIds = []) => {
      const pool = (defs.uniquePenalties || []).filter(
        (p) => !takenPenalties.has(p.id) && !excludeIds.includes(p.id)
      );
      if (pool.length === 0) return null;
      const def = pool[Math.floor(Math.random() * pool.length)];
      return { id: def.id, name: def.name, description: def.description, value: undefined };
    };

    const cards = [];
    const usedInOfferUp = new Set();
    const usedInOfferPen = new Set();
    for (let i = 0; i < 2; i++) {
      const upgrades = [];
      for (let j = 0; j < 2; j++) {
        const poolUp = (defs.standardUpgrades || []).filter((u) => !usedInOfferUp.has(u.id));
        if (poolUp.length === 0) break;
        const defUp = poolUp[Math.floor(Math.random() * poolUp.length)];
        const upgrade = { id: defUp.id, name: defUp.name, description: defUp.description, value: rollUpgradeValue(defUp), percent: !!defUp.valueRange?.percent };
        upgrades.push(upgrade);
        usedInOfferUp.add(upgrade.id);
      }
      const poolPen = (defs.standardPenalties || []).filter((p) => !usedInOfferPen.has(p.id));
      if (upgrades.length < 2 || poolPen.length === 0) break;
      const defPen = poolPen[Math.floor(Math.random() * poolPen.length)];
      const penalty = { id: defPen.id, name: defPen.name, description: defPen.description, value: rollUpgradeValue(defPen), percent: !!defPen.valueRange?.percent };
      cards.push({ upgrades, penalty, isUnique: false });
      usedInOfferPen.add(penalty.id);
    }
    const uUpgrades = [];
    const showUniqueCard = this.level === 5 || this.level === 10;
    if (showUniqueCard) {
      const usedUniqueUp = new Set();
      for (let j = 0; j < 1; j++) {
        const poolU = (defs.uniqueUpgrades || []).filter((u) => !takenUpgrades.has(u.id) && !usedUniqueUp.has(u.id));
        if (poolU.length === 0) break;
        const defU = poolU[Math.floor(Math.random() * poolU.length)];
        uUpgrades.push({ id: defU.id, name: defU.name, description: defU.description, value: undefined });
        usedUniqueUp.add(defU.id);
      }
      let blockedPenalties = [];
      for (const u of uUpgrades) {
        blockedPenalties = blockedPenalties.concat(CONTRADICTORY_UPGRADE_PENALTY[u.id] || []);
      }
      const uPen = pickUniquePenalty(blockedPenalties);
      if (uUpgrades.length === 1 && uPen) {
        cards.push({ upgrades: uUpgrades, penalty: uPen, isUnique: true });
      }
    }
    const poolUpOnly = (defs.standardUpgrades || []).filter((u) => !usedInOfferUp.has(u.id));
    if (poolUpOnly.length > 0) {
      const defUp = poolUpOnly[Math.floor(Math.random() * poolUpOnly.length)];
      const upgrade = { id: defUp.id, name: defUp.name, description: defUp.description, value: rollUpgradeValue(defUp), percent: !!defUp.valueRange?.percent };
      cards.push({ upgrades: [upgrade], penalty: null, isUnique: false });
    }

    return cards;
  }

  showLevelUpChoices() {
    this.levelUpChoices = this.buildLevelUpCards();
    if (!this.levelUpChoices || this.levelUpChoices.length === 0) {
      this.levelUpChoices = null;
      return;
    }
    const overlay = document.getElementById("level-up-overlay");
    const choicesEl = document.getElementById("level-up-choices");
    const rerollBtn = document.getElementById("level-up-reroll");
    if (!overlay || !choicesEl) return;

    choicesEl.innerHTML = "";
    for (const card of this.levelUpChoices) {
      const btn = document.createElement("button");
      btn.className = "level-up-card" + (card.isUnique ? " level-up-card-unique" : "");
      const star = card.isUnique ? '<span class="level-up-card-star">spr_ui_star</span>' : "";
      const upgradeBlocks = (card.upgrades || []).map(
        (u, idx) => `<div class="level-up-card-upgrade">${idx === 0 ? star : ""}<strong>${u.name}</strong><br><span class="level-up-card-desc">${getUpgradeDisplayDescription(u)}</span></div>`
      ).join("");
      const penaltyBlock = card.penalty
        ? `<div class="level-up-card-divider"></div><div class="level-up-card-penalty"><strong>${card.penalty.name}</strong><br><span class="level-up-card-desc">${getPenaltyDisplayDescription(card.penalty)}</span></div>`
        : `<div class="level-up-card-no-penalty">No penalty</div>`;
      btn.innerHTML = `<div class="level-up-card-inner">${upgradeBlocks}${penaltyBlock}</div>`;
      btn.addEventListener("click", () => this.applyLevelUpChoice(card, btn));
      choicesEl.appendChild(btn);
    }
    if (rerollBtn) {
      const canReroll = hasTalent("wildCard") && !this.wildCardRerollUsed;
      rerollBtn.classList.toggle("hidden", !canReroll);
      rerollBtn.onclick = canReroll ? () => {
        this.wildCardRerollUsed = true;
        rerollBtn.classList.add("hidden");
        this.showLevelUpChoices();
      } : null;
    }
    overlay.classList.remove("hidden");
    const buildLogPanel = document.getElementById("build-log-panel");
    if (buildLogPanel) {
      buildLogPanel.classList.remove("hidden");
      if (this.buildLogRefresh) this.buildLogRefresh();
    }
    this.paused = true;
    if (this.pauseToggleEl) {
      this.pauseToggleEl.textContent = "Resume";
      this.pauseToggleEl.classList.add("paused");
    }
  }

  applyLevelUpChoice(card, cardEl) {
    for (const u of (card.upgrades || [])) this.runAttackUpgrades.push(u);
    if (card.penalty) this.runAttackPenalties.push(card.penalty);
    this.levelUpChoices = null;

    if (cardEl) {
      cardEl.classList.add("level-up-card-selected");
      setTimeout(() => {
        const overlay = document.getElementById("level-up-overlay");
        if (overlay) overlay.classList.add("hidden");
        this.paused = false;
        if (this.pauseToggleEl) {
          this.pauseToggleEl.textContent = "Pause";
          this.pauseToggleEl.classList.remove("paused");
        }
        this.recalculateStats();
        this.updateXpUI();
        this.checkLevelUp();
        if (this.buildLogRefresh) this.buildLogRefresh();
      }, 320);
    } else {
      const overlay = document.getElementById("level-up-overlay");
      if (overlay) overlay.classList.add("hidden");
      this.paused = false;
      if (this.pauseToggleEl) {
        this.pauseToggleEl.textContent = "Pause";
        this.pauseToggleEl.classList.remove("paused");
      }
      this.recalculateStats();
      this.updateXpUI();
      this.checkLevelUp();
      if (this.buildLogRefresh) this.buildLogRefresh();
    }
  }

  getWorldPositionFromScreen(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / rect.width) * this.viewWidth;
    const viewY = ((clientY - rect.top) / rect.height) * this.viewHeight;
    return {
      x: this.camera.position.x + viewX,
      y: this.camera.position.y + viewY
    };
  }

  getWorldPositionFromClick(e) {
    return this.getWorldPositionFromScreen(e.clientX, e.clientY);
  }

  updateAffixTooltip(clientX, clientY) {
    const tt = document.getElementById("affix-tooltip");
    if (!tt || !this.lastMouseWorld || !this.enemySystem) return;
    const viewX = this.lastMouseWorld.x - this.camera.position.x;
    const viewY = this.lastMouseWorld.y - this.camera.position.y;
    let hitEnemy = null;
    for (const enemy of this.enemySystem.enemies) {
      if (enemy.isDead) continue;
      const sx = enemy.position.x - this.camera.position.x;
      const sy = enemy.position.y - this.camera.position.y;
      const pad = 30;
      if (viewX >= sx - 5 && viewX <= sx + enemy.size + 5 &&
          viewY >= sy - pad && viewY <= sy + enemy.size + 5) {
        hitEnemy = enemy;
        break;
      }
    }
    if (hitEnemy && hitEnemy.affixes?.length > 0) {
      const names = hitEnemy.affixes.map((id) => (getAffixDef(id).name)).join(", ");
      tt.textContent = names;
      tt.classList.remove("hidden");
      tt.style.left = (clientX + 12) + "px";
      tt.style.top = (clientY + 12) + "px";
    } else {
      tt.classList.add("hidden");
    }
  }

  hideAffixTooltip() {
    const tt = document.getElementById("affix-tooltip");
    if (tt) tt.classList.add("hidden");
  }

  onCanvasMouseDown(e) {
    if (e.button !== 0 || this.gameOver || this.levelUpChoices) return;
    
    // Handle pause menu button clicks
    if (this.paused) {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * this.viewWidth;
      const y = ((e.clientY - rect.top) / rect.height) * this.viewHeight;
      
      if (this.pauseResumeButton) {
        if (x >= this.pauseResumeButton.x && x <= this.pauseResumeButton.x + this.pauseResumeButton.w &&
            y >= this.pauseResumeButton.y && y <= this.pauseResumeButton.y + this.pauseResumeButton.h) {
          this.togglePause();
          return;
        }
      }
      
      if (this.pauseMainMenuButton) {
        if (x >= this.pauseMainMenuButton.x && x <= this.pauseMainMenuButton.x + this.pauseMainMenuButton.w &&
            y >= this.pauseMainMenuButton.y && y <= this.pauseMainMenuButton.y + this.pauseMainMenuButton.h) {
          this.returnToMainMenu();
          return;
        }
      }
      
      return;
    }
    
    this.mouseHeld = true;
    this.lastMouseWorld = this.getWorldPositionFromClick(e);
    this.tryBasicAttack(this.lastMouseWorld.x, this.lastMouseWorld.y);
  }

  tryDash() {
    if (this.gameOver || this.paused || this.levelUpChoices || this.spaceConsumed) return;
    if (typeof this.canPillarDash === "function" && !this.canPillarDash({ source: "input" })) return;
    const dashCost = typeof this.getPillarDashCost === "function"
      ? this.getPillarDashCost(1, { source: "input" })
      : 1;
    if (this.dashActive || (this.dashCharges || 0) < dashCost) return;
    if (this.stunTimer > 0) return;

    const axis = this.input.getAxis();
    let dx = axis.x;
    let dy = axis.y;

    if (dx === 0 && dy === 0) {
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const mx = this.lastMouseWorld.x;
      const my = this.lastMouseWorld.y;
      const toMouseX = mx - px;
      const toMouseY = my - py;
      const dist = Math.sqrt(toMouseX * toMouseX + toMouseY * toMouseY) || 1;
      dx = toMouseX / dist;
      dy = toMouseY / dist;
    } else {
      const inv = 1 / Math.sqrt(dx * dx + dy * dy);
      dx *= inv;
      dy *= inv;
    }

    this.dashActive = true;
    this.dashTimer = this.dashDuration;
    this.dashDirection.set(dx, dy);
    this.dashCharges = Math.max(0, (this.dashCharges || 0) - dashCost);
    if (this.dashCharges < (this.dashMaxCharges || 2) && (this.dashRechargeTimer || 0) <= 0) {
      this.dashRechargeTimer = this.dashCooldownTime;
    }
    this.dashCooldown = this.dashCharges < (this.dashMaxCharges || 2) ? this.dashRechargeTimer : 0;
    if (this.player && typeof this.player.beginDashAnimation === "function") {
      this.player.beginDashAnimation(dx, dy);
    }
    this.dashTrail = [];
    this.spaceConsumed = true;
    onRingDashUsed(this);
    if (typeof this.runPillarEvent === "function") {
      this.runPillarEvent("onDashStarted", { dx, dy, cost: dashCost, time: this.time });
    }
    playSfx("playerDash");
  }

  tryBasicAttack(targetX, targetY) {
    if (typeof this.isPillarBasicAttackAllowed === "function" && !this.isPillarBasicAttackAllowed({ targetX, targetY })) {
      return;
    }
    const attackMults = this.getSkillMultipliersFor(this.attackType);
    const attackDamageMult = attackMults.damageMult || 1;
    const attackSpeedMult = attackMults.attackSpeedMult || 1;
    const attackCooldownMult = attackMults.cooldownMult || 1;
    let atkSpdMult = (this.equipmentAttackSpeedMult || 1) * (this.talentAttackSpeedMult || 1);
    atkSpdMult *= getRingAttackSpeedMultiplier(this);
    if (typeof this.getPillarAttackSpeedMultiplier === "function") {
      atkSpdMult *= this.getPillarAttackSpeedMultiplier({ attackType: this.attackType });
    }
    // Frenzy buff: 30% attack speed
    if (this.frenzyBuffUntil > this.time) {
      atkSpdMult *= 1.3;
    }
    atkSpdMult *= 1 + this.getAttackUpgradeValue("attackSpeed");
    atkSpdMult *= 1 - this.getAttackPenaltyValue("speedPenalty");
    if (this.playerWeakenUntil > this.time) atkSpdMult *= 0.9;
    const projectileEvolution = this.getProjectileShotEvolutionOverrides();
    if (this.attackType === "projectile" && projectileEvolution?.attackSpeedMult != null) {
      atkSpdMult *= projectileEvolution.attackSpeedMult;
    }
    // Use dev override if set, otherwise use base cooldown
    const baseCooldown = this.devAttackCooldownOverride ?? this.playerAttackCooldown;
    let effectiveCooldown = (baseCooldown / atkSpdMult) * attackCooldownMult;
    effectiveCooldown /= attackSpeedMult;
    if (hasTalent("cardSurge") && this.cardSurgeUntil > this.time) {
      effectiveCooldown /= 1.2;
    }
    effectiveCooldown += this.getAttackPenaltyValue("cooldown");
    if (this.hasUpgradeCard("berserkerRage")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      effectiveCooldown *= Math.max(0.4, ratio);
    }
    if (this.playerAttackTimer > 0) return;
    if (this.dashActive) return;
    if (this.bladeDashActive) return;
    if (this.dashStrikeState) return;
    if (this.backfireDashState) return;

    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const dx = targetX - px;
    const dy = targetY - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    this.playerAttackTimer = effectiveCooldown;
    
    // Trigger attack animation with actual cooldown duration
    this.player.triggerAttackAnimation(effectiveCooldown);

    if (this.attackType === "projectile") {
      if (this.hasAttackPenalty("misfire") && Math.random() < 0.1) return;
      const burstMode = projectileEvolution?.fireMode === "BURST";
      if (this.hasAttackPenalty("delayedFire")) {
        this.delayedFireQueue = this.delayedFireQueue || [];
        if (burstMode) {
          this.queueProjectileBurst(targetX, targetY, attackDamageMult, 0.3);
        } else {
          this.delayedFireQueue.push({ targetX, targetY, at: this.time + 0.3, damageMult: attackDamageMult });
        }
        return;
      }
      playSfx("playerAttack");
      if (burstMode) {
        this.queueProjectileBurst(targetX, targetY, attackDamageMult, 0);
        return;
      }
      this.firePlayerProjectile(targetX, targetY, attackDamageMult);
      return;
    }

    const attackFlatBonus = getSkillFlatDamageBonus(this, this.attackType);
    const baseDamage = Math.round((this.computePlayerDamage(null) + attackFlatBonus) * attackDamageMult);

    if (this.attackType === "fanStrike") {
      playSfx("playerAttack");
      const FAN_RANGE = 210;
      const facingAngle = Math.atan2(dirY, dirX);
      spawnFanStrikeVfx({ x: px, y: py, facingAngle, range: FAN_RANGE, telegraph: true });
      const hit = this.enemiesInCone(px, py, dirX, dirY, FAN_RANGE, 60);
      for (const e of hit) {
        this.dealDamageToEnemy(e, baseDamage, { meleeFreeze: 0.1, skillId: this.attackType, isMeleeHit: true });
        const ex = e.position.x + e.size / 2;
        const ey = e.position.y + e.size / 2;
        onFanStrikeHitEnemy({ enemyX: ex, enemyY: ey, sweepAngle: facingAngle, playerX: px, playerY: py });
      }
      const breakHit = this.breakablesInCone(px, py, dirX, dirY, FAN_RANGE, 60);
      for (const b of breakHit) this.dealDamageToBreakable(b, baseDamage);
      if (hit.length > 0 || breakHit.length > 0) {
        this.hitStopRemaining = HIT_STOP_MS / 1000;
        this.cameraShakeUntil = this.time + CAMERA_SHAKE_DURATION;
        this.cameraShakeAmount = CAMERA_SHAKE_INTENSITY * 40;
      }
      return;
    }

    if (this.attackType === "pulseShot") {
      playSfx("playerAttack");
      const PULSE_RADIUS = 55;
      const PULSE_DELAY = 0.35;
      this.skillEffects.push({ type: "pulseStrike", x: targetX, y: targetY, damage: baseDamage, radius: PULSE_RADIUS, delay: PULSE_DELAY, t: 0, duration: PULSE_DELAY + 0.25 });
      return;
    }

    if (this.attackType === "thrustStrike") {
      const THRUST_RANGE = 240;
      const hit = this.getEnemiesInLine(px, py, dirX, dirY, THRUST_RANGE, 8);
      const dmg = Math.round(baseDamage * 1.6);
      for (const e of hit) this.dealDamageToEnemy(e, dmg, { meleeFreeze: 0.1, skillId: this.attackType, isMeleeHit: true });
      const breakLine = this.getBreakablesInLine(px, py, dirX, dirY, THRUST_RANGE, 8);
      for (const b of breakLine) this.dealDamageToBreakable(b, dmg);
      const endX = px + dirX * THRUST_RANGE;
      const endY = py + dirY * THRUST_RANGE;
      this.skillEffects.push({ type: "attackThrustLunge", x: px, y: py, dirX, dirY, hitX: endX, hitY: endY, t: 0, duration: 0.15 });
      return;
    }

    if (this.attackType === "dashStrike") {
      const surgeDist = this.player.size * 0.5;
      this.dashStrikeState = { phase: "surge", startX: this.player.position.x, startY: this.player.position.y, dirX, dirY, dist: surgeDist, traveled: 0, damage: baseDamage };
      this.skillEffects.push({ type: "dashStrikeSurge", x: px, y: py, dirX, dirY, t: 0, duration: 0.25 });
      return;
    }

    if (this.attackType === "backfireShot") {
      const backDist = this.player.size * 1.5;
      const projX = px - PLAYER_PROJECTILE_SIZE / 2;
      const projY = py - PLAYER_PROJECTILE_SIZE / 2;
      const speedMult = 1 + this.getAttackUpgradeValue("projectileSpeed") - this.getAttackPenaltyValue("slowShot");
      const maxDistMult = 1 + this.getAttackUpgradeValue("rangeBoost") - this.getAttackPenaltyValue("reducedRange");
      const hasPiercingSource = (this.hasUpgradeCard("piercing") || this.hasAttackUpgrade("piercing"));
      let piercesRemaining = hasPiercingSource ? 3 : 2;
      const fragileShot = this.hasAttackPenalty("fragileShot");
      if (fragileShot) {
        // Fragile Shot now reduces penetration targets by 3.
        piercesRemaining = Math.max(0, piercesRemaining - 3);
      }
      this.overdriveCounter = (this.overdriveCounter || 0) + 1;
      const isOverdrive = this.hasAttackUpgrade("overdrive") && (this.overdriveCounter % 5 === 0);
      const proj = new PlayerProjectile(projX, projY, targetX, targetY, baseDamage, {
        speedMult, maxDistMult, piercesRemaining, fragileShot,
        ghost: this.hasAttackUpgrade("ghostProjectile"),
        splitting: this.hasAttackUpgrade("splitting"),
        overdrive: isOverdrive
      });
      if (this.hasUpgradeCard("homing")) proj.maxLifetime = 3;
      this.playerProjectiles.push(proj);
      this.backfireDashState = { dirX, dirY, traveled: 0, dist: backDist };
      this.skillEffects.push({ type: "backfireTrail", x: px, y: py, dirX, dirY, t: 0, duration: 0.25 });
      return;
    }
  }

  queueProjectileBurst(targetX, targetY, attackDamageMult, initialDelaySec = 0) {
    const evo = this.getProjectileShotEvolutionOverrides();
    if (!evo || evo.fireMode !== "BURST") {
      this.delayedFireQueue = this.delayedFireQueue || [];
      this.delayedFireQueue.push({ targetX, targetY, at: this.time + initialDelaySec, damageMult: attackDamageMult });
      return;
    }
    const burstCount = Math.max(1, Math.floor(evo.burstCount || 10));
    const interval = Math.max(0.01, Number(evo.burstIntervalSec || 0.08));
    const spreadDeg = Number(evo.spreadDeg || 15);
    const spreadRad = spreadDeg * Math.PI / 180;
    const shotDamageMult = Number(evo.burstShotDamageMult || 0.15);
    this.delayedFireQueue = this.delayedFireQueue || [];
    for (let i = 0; i < burstCount; i++) {
      const angleOffsetRad = (Math.random() - 0.5) * spreadRad;
      this.delayedFireQueue.push({
        targetX,
        targetY,
        at: this.time + initialDelaySec + i * interval,
        damageMult: attackDamageMult * shotDamageMult,
        angleOffsetRad
      });
    }
  }

  getProjectileCount() {
    let n = 1;
    const ups = this.runAttackUpgrades || [];
    const pens = this.runAttackPenalties || [];
    n += ups.filter((u) => u.id === "extraProjectile").length;
    if (this.hasUpgradeCard("volley")) n += 3;
    n -= pens.filter((p) => p.id === "fewerProjectiles").length;
    n -= pens.filter((p) => p.id === "reducedProjectiles").length;
    return Math.max(1, n);
  }

  firePlayerProjectile(targetX, targetY, damageMult = 1, options = {}) {
    const px = this.player.position.x + this.player.size / 2 - PLAYER_PROJECTILE_SIZE / 2;
    const py = this.player.position.y + this.player.size / 2 - PLAYER_PROJECTILE_SIZE / 2;
    const attackFlatBonus = getSkillFlatDamageBonus(this, this.attackType);
    const evo = this.getProjectileShotEvolutionOverrides();
    const evolutionDamageMult = evo?.damageMult != null ? evo.damageMult : 1;
    let baseDamage = Math.round((this.computePlayerDamage(null) + attackFlatBonus) * damageMult * evolutionDamageMult);
    const critChance = this.getAttackUpgradeValue("critChance");
    const isCrit = critChance > 0 && Math.random() < critChance;
    if (isCrit) baseDamage = Math.round(baseDamage * 1.5);

    let dirX = targetX - (this.player.position.x + this.player.size / 2);
    let dirY = targetY - (this.player.position.y + this.player.size / 2);
    const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= dist;
    dirY /= dist;
    if (this.hasAttackPenalty("randomDirection") && !this.hasUpgradeCard("homing")) {
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    } else if (this.hasAttackPenalty("oppositeFire")) {
      dirX = -dirX;
      dirY = -dirY;
    }

    if (options.angleOffsetRad != null) {
      const offsetCos = Math.cos(options.angleOffsetRad);
      const offsetSin = Math.sin(options.angleOffsetRad);
      const odx = dirX * offsetCos - dirY * offsetSin;
      const ody = dirX * offsetSin + dirY * offsetCos;
      dirX = odx;
      dirY = ody;
    }

    const isMachineGunBurst = evo?.fireMode === "BURST";
    const count = isMachineGunBurst ? 1 : this.getProjectileCount();
    let spreadRad = (12 * Math.PI) / 180;
    spreadRad += this.getAttackPenaltyValue("widerSpread");
    spreadRad -= this.getAttackUpgradeValue("spreadReduction");
    spreadRad = Math.max(0.02, spreadRad);

    let speedMult = 1 + this.getAttackUpgradeValue("projectileSpeed") - this.getAttackPenaltyValue("slowShot");
    if (evo?.projectileSpeedMult != null) speedMult *= evo.projectileSpeedMult;

    const maxDistMult = 1 + this.getAttackUpgradeValue("rangeBoost") - this.getAttackPenaltyValue("reducedRange");
    const maxDistAbs = evo?.infiniteRange ? Number.POSITIVE_INFINITY : null;
    const pierceEnabledFromEvo = !!evo?.pierceEnabled;
    const hasPiercingSource = pierceEnabledFromEvo || this.hasUpgradeCard("piercing") || this.hasAttackUpgrade("piercing");
    let piercesRemaining = pierceEnabledFromEvo
      ? (evo.pierceMaxTargets ?? Number.POSITIVE_INFINITY)
      : (hasPiercingSource ? 3 : 2);
    const fragileShot = this.hasAttackPenalty("fragileShot");
    if (fragileShot) {
      // Sniper Shot uses Infinity, so this remains Infinity.
      piercesRemaining = Math.max(0, piercesRemaining - 3);
    }
    const ghost = this.hasAttackUpgrade("ghostProjectile");
    const splitting = this.hasAttackUpgrade("splitting");
    const projectileScaleMult = evo?.projectileScaleMult != null ? evo.projectileScaleMult : 1;
    const seekerHoming = hasRing(this, "ring_seeker") && evo?.canSteer !== false;
    const canSteer = evo?.canSteer === false ? false : (seekerHoming ? true : (evo?.canSteer !== false));
    const sniperFalloff = evo?.sniperPierceFalloff || null;
    this.overdriveCounter = (this.overdriveCounter || 0);

    for (let i = 0; i < count; i++) {
      this.overdriveCounter++;
      const isOverdrive = this.hasAttackUpgrade("overdrive") && (this.overdriveCounter % 5 === 0);
      let tx = targetX;
      let ty = targetY;
      if (count > 1) {
        const offset = (i - (count - 1) / 2) * spreadRad;
        const cos = Math.cos(offset);
        const sin = Math.sin(offset);
        const ndx = dirX * cos - dirY * sin;
        const ndy = dirX * sin + dirY * cos;
        const far = 800;
        tx = this.player.position.x + this.player.size / 2 + ndx * far;
        ty = this.player.position.y + this.player.size / 2 + ndy * far;
      }
      const proj = new PlayerProjectile(px, py, tx, ty, baseDamage, {
        speedMult,
        maxDistMult,
        maxDistAbs,
        piercesRemaining,
        fragileShot,
        ghost,
        splitting,
        overdrive: isOverdrive,
        sizeMult: projectileScaleMult,
        canSteer,
        sniperPierceFalloff: sniperFalloff,
        forceHoming: seekerHoming
      });
      proj.maxLifetime = seekerHoming ? 3 : 2;
      this.playerProjectiles.push(proj);
    }

    if (!options?.mirrorProc) {
      tryProcMirrorFang(this, targetX, targetY, { ...options, damageMult });
    }

    if (this.hasAttackPenalty("selfKnockback")) {
      const kick = 8;
      this.player.position.x -= dirX * kick;
      this.player.position.y -= dirY * kick;
      const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
      this.player.position.x = Math.max(margin, Math.min(this.player.position.x, this.world.width - margin - this.player.size));
      this.player.position.y = Math.max(margin, Math.min(this.player.position.y, this.world.height - margin - this.player.size));
    }
  }

  updatePlayerProjectiles(dt) {
    const surviving = [];
    const toAdd = [];
    const es = this.enemySystem;
    for (const proj of this.playerProjectiles) {
      proj._spawn = null;
      proj.update(dt, this);
      if (proj._spawn) toAdd.push(...proj._spawn);
      if (proj.isExpired()) continue;
      if (proj._spawn) continue;

      let hit = false;
      const applyHit = (enemy, dmg) => {
        proj.hitEnemyIds.add(enemy.id);
        const damageMult = proj.currentDamageMult != null ? proj.currentDamageMult : 1;
        let useDmg = Math.round(dmg * damageMult);
        if (this.hasAttackUpgrade("momentum")) {
          useDmg = Math.round(useDmg * (1 + Math.min(1, proj.flightTime) * 0.1));
        }
        if (hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
          useDmg = Math.round(useDmg * 1.25);
        }
        this.dealDamageToEnemy(enemy, useDmg);
        if (this.hasAttackUpgrade("chainLightning")) {
          const cx = enemy.position.x + enemy.size / 2;
          const cy = enemy.position.y + enemy.size / 2;
          const exclude = new Set(proj.hitEnemyIds);
          const chainDmg = Math.round(useDmg * 0.33);
          for (let i = 0; i < 3; i++) {
            const next = this.getNearestEnemy(cx, cy, 150, exclude);
            if (!next) break;
            this.dealDamageToEnemy(next, chainDmg);
            exclude.add(next.id);
          }
        }
        if (this.hasAttackUpgrade("explosive")) {
          const ex = enemy.position.x + enemy.size / 2;
          const ey = enemy.position.y + enemy.size / 2;
          const hitArea = this.enemiesInRadius(ex, ey, 45);
          for (const e of hitArea) {
            if (e !== enemy) {
              this.dealDamageToEnemy(e, Math.round(useDmg * 0.6));
            }
          }
        }
      };

      // Check obstacle collision
      let hitObstacle = false;
      for (const obstacle of this.obstacles || []) {
        if (obstacle.destroyed || !obstacle.blocksProjectiles) continue;
        if (proj.intersects(obstacle)) {
          hitObstacle = true;
          // Barrel explosion
          if (obstacle.type === "barrel") {
            obstacle.destroyed = true;
            const ex = obstacle.position.x + obstacle.size.w / 2;
            const ey = obstacle.position.y + obstacle.size.h / 2;
            const hitArea = this.enemiesInRadius(ex, ey, obstacle.typeDef.explosionRadius);
            for (const e of hitArea) {
              this.dealDamageToEnemy(e, obstacle.typeDef.explosionDamage);
            }
            // Damage player if in range
            const px = this.player.position.x + this.player.size / 2;
            const py = this.player.position.y + this.player.size / 2;
            const dist = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);
            if (dist < obstacle.typeDef.explosionRadius) {
              this.onPlayerDamaged(obstacle.typeDef.explosionDamage, false);
            }
            this.skillEffects.push({ 
              type: "barrelExplosion", 
              x: ex, 
              y: ey, 
              radius: obstacle.typeDef.explosionRadius, 
              t: 0, 
              duration: 0.3 
            });
          } else {
            // Impact particle effect for solid obstacles
            this.skillEffects.push({
              type: "obstacleImpact",
              x: proj.position.x,
              y: proj.position.y,
              t: 0,
              duration: 0.2
            });
          }
          break;
        }
      }
      
      // Check procedural tile walls (projectiles do not penetrate)
      if (!hitObstacle && this.world.tileWallRects) {
        const projRect = { x: proj.position.x, y: proj.position.y, w: proj.size, h: proj.size };
        for (const wall of this.world.tileWallRects) {
          if (projRect.x < wall.x + wall.w && projRect.x + projRect.w > wall.x &&
              projRect.y < wall.y + wall.h && projRect.y + projRect.h > wall.y) {
            hitObstacle = true;
            this.skillEffects.push({
              type: "obstacleImpact",
              x: proj.position.x,
              y: proj.position.y,
              t: 0,
              duration: 0.2
            });
            break;
          }
        }
      }

      if (hitObstacle) {
        continue; // Projectile destroyed by obstacle/wall
      }

      // Check breakables (projectiles damage them; ghost projectiles pass through)
      for (const breakable of this.breakables || []) {
        if (breakable.isDead) continue;
        if (proj.intersects(breakable)) {
          this.dealDamageToBreakable(breakable, proj.damage);
          if (!proj.ghost) {
            this.skillEffects.push({
              type: "obstacleImpact",
              x: proj.position.x,
              y: proj.position.y,
              t: 0,
              duration: 0.2
            });
            hit = true;
            break;
          }
        }
      }
      if (hit && !proj.ghost) {
        continue;
      }

      const allEnemies = es.boss ? [...es.enemies, es.boss] : es.enemies;
      for (const enemy of allEnemies) {
        if (enemy.isDead) continue;
        if (enemy._undyingRespawnTime && this.time < enemy._undyingRespawnTime) continue;
        if (proj.hitEnemyIds.has(enemy.id)) continue;
        if (proj.intersects(enemy)) {
          hit = true;
          applyHit(enemy, proj.damage);
          if (proj.piercing) {
            if (proj.sniperPierceFalloff) {
              const falloffFactor = Number(proj.sniperPierceFalloff.factor || 0.85);
              const floor = Number(proj.sniperPierceFalloff.floor || 0.6);
              const current = proj.currentDamageMult != null ? proj.currentDamageMult : 1;
              proj.currentDamageMult = Math.max(floor, current * falloffFactor);
            }
            proj.piercesRemaining--;
            if (proj.piercesRemaining <= 0) break;
          } else {
            break;
          }
        }
      }
      const keep = !proj.isExpired() && (!hit || (!proj.piercing || proj.piercesRemaining > 0));
      if (keep) surviving.push(proj);
    }
    this.playerProjectiles = surviving.concat(toAdd);
  }

  updateDashStrike(dt) {
    if (!this.dashStrikeState) return;
    const s = this.dashStrikeState;
    const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
    if (s.phase === "surge") {
      const speed = 600;
      const move = Math.min(speed * dt, s.dist - s.traveled);
      let nx = this.player.position.x + s.dirX * move;
      let ny = this.player.position.y + s.dirY * move;
      nx = Math.max(margin, Math.min(nx, this.world.width - margin - this.player.size));
      ny = Math.max(margin, Math.min(ny, this.world.height - margin - this.player.size));
      
      const pi = PLAYER_WALL_COLLISION_INSET;
      const pBase = Math.max(1, this.player.size - 2 * pi);
      const pw = Math.max(1, pBase * 0.25);
      const ph = Math.max(1, pBase * 0.5);
      const pxo = pi + (pBase - pw) / 2;
      const pyo = pi + (pBase - ph) / 2;
      const testX = { x: nx + pxo, y: this.player.position.y + pyo, w: pw, h: ph };
      const testY = { x: this.player.position.x + pxo, y: ny + pyo, w: pw, h: ph };
      
      let canMoveX = true;
      let canMoveY = true;
      
      for (const obstacle of this.obstacles || []) {
        if (obstacle.destroyed || !obstacle.blocksMovement || obstacle.type === "ancientTree") continue;
        if (obstacleIntersectsRect(obstacle, testX)) {
          canMoveX = false;
        }
        
        if (obstacleIntersectsRect(obstacle, testY)) {
          canMoveY = false;
        }
      }
      
      const walls = this.world.tileWallRects || [];
      for (const wall of walls) {
        const wallRect = getWallCollisionRect(wall);
        if (testX.x < wallRect.x + wallRect.w && testX.x + testX.w > wallRect.x &&
            testX.y < wallRect.y + wallRect.h && testX.y + testX.h > wallRect.y) canMoveX = false;
        if (testY.x < wallRect.x + wallRect.w && testY.x + testY.w > wallRect.x &&
            testY.y < wallRect.y + wallRect.h && testY.y + testY.h > wallRect.y) canMoveY = false;
      }
      // Block movement on axes that would collide
      if (!canMoveX) nx = this.player.position.x;
      if (!canMoveY) ny = this.player.position.y;
      
      // If both blocked, stop the dash strike
      if (!canMoveX && !canMoveY) {
        s.phase = "fan";
        playSfx("playerAttack");
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        const DASH_STRIKE_FAN_RANGE = 150;
        const facingAngle = Math.atan2(s.dirY, s.dirX);
        spawnFanStrikeVfx({ x: px, y: py, facingAngle, range: DASH_STRIKE_FAN_RANGE, telegraph: true, halfAngleDeg: 45 });
        const hit = this.enemiesInCone(px, py, s.dirX, s.dirY, DASH_STRIKE_FAN_RANGE, 45);
        const dmg = s.damage ?? (this.computePlayerDamage(null) + getSkillFlatDamageBonus(this, "dashStrike"));
        for (const e of hit) {
          this.dealDamageToEnemy(e, dmg, { meleeFreeze: 0.1, skillId: "dashStrike", isMeleeHit: true });
          const ex = e.position.x + e.size / 2;
          const ey = e.position.y + e.size / 2;
          onFanStrikeHitEnemy({ enemyX: ex, enemyY: ey, sweepAngle: facingAngle, playerX: px, playerY: py });
        }
        const breakHit1 = this.breakablesInCone(px, py, s.dirX, s.dirY, DASH_STRIKE_FAN_RANGE, 45);
        for (const b of breakHit1) this.dealDamageToBreakable(b, dmg);
        if (hit.length > 0 || breakHit1.length > 0) {
          this.hitStopRemaining = HIT_STOP_MS / 1000;
          this.cameraShakeUntil = this.time + CAMERA_SHAKE_DURATION;
          this.cameraShakeAmount = CAMERA_SHAKE_INTENSITY * 40;
        }
        this.dashStrikeState = null;
        return;
      }
      
      this.player.position.set(nx, ny);
      s.traveled += move;
      if (s.traveled >= s.dist) {
        s.phase = "fan";
        playSfx("playerAttack");
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        const DASH_STRIKE_FAN_RANGE = 150;
        const facingAngle = Math.atan2(s.dirY, s.dirX);
        spawnFanStrikeVfx({ x: px, y: py, facingAngle, range: DASH_STRIKE_FAN_RANGE, telegraph: true, halfAngleDeg: 45 });
        const hit = this.enemiesInCone(px, py, s.dirX, s.dirY, DASH_STRIKE_FAN_RANGE, 45);
        const dmg = s.damage ?? (this.computePlayerDamage(null) + getSkillFlatDamageBonus(this, "dashStrike"));
        for (const e of hit) {
          this.dealDamageToEnemy(e, dmg, { meleeFreeze: 0.1, skillId: "dashStrike", isMeleeHit: true });
          const ex = e.position.x + e.size / 2;
          const ey = e.position.y + e.size / 2;
          onFanStrikeHitEnemy({ enemyX: ex, enemyY: ey, sweepAngle: facingAngle, playerX: px, playerY: py });
        }
        const breakHit2 = this.breakablesInCone(px, py, s.dirX, s.dirY, DASH_STRIKE_FAN_RANGE, 45);
        for (const b of breakHit2) this.dealDamageToBreakable(b, dmg);
        if (hit.length > 0 || breakHit2.length > 0) {
          this.hitStopRemaining = HIT_STOP_MS / 1000;
          this.cameraShakeUntil = this.time + CAMERA_SHAKE_DURATION;
          this.cameraShakeAmount = CAMERA_SHAKE_INTENSITY * 40;
        }
        this.dashStrikeState = null;
      }
    }
  }

  updateBackfireDash(dt) {
    if (!this.backfireDashState) return;
    const s = this.backfireDashState;
    const speed = 500;
    const move = Math.min(speed * dt, s.dist - s.traveled);
    let nx = this.player.position.x - s.dirX * move;
    let ny = this.player.position.y - s.dirY * move;
    const margin = this.world.wallThickness;
    nx = Math.max(margin, Math.min(nx, this.world.width - margin - this.player.size));
    ny = Math.max(margin, Math.min(ny, this.world.height - margin - this.player.size));
    
    const pi = PLAYER_WALL_COLLISION_INSET;
    const pBase = Math.max(1, this.player.size - 2 * pi);
    const pw = Math.max(1, pBase * 0.25);
    const ph = Math.max(1, pBase * 0.5);
    const pxo = pi + (pBase - pw) / 2;
    const pyo = pi + (pBase - ph) / 2;
    const testX = { x: nx + pxo, y: this.player.position.y + pyo, w: pw, h: ph };
    const testY = { x: this.player.position.x + pxo, y: ny + pyo, w: pw, h: ph };
    
    let canMoveX = true;
    let canMoveY = true;
    
    for (const obstacle of this.obstacles || []) {
      if (obstacle.destroyed || !obstacle.blocksMovement || obstacle.type === "ancientTree") continue;
      if (obstacleIntersectsRect(obstacle, testX)) {
        canMoveX = false;
      }
      
      if (obstacleIntersectsRect(obstacle, testY)) {
        canMoveY = false;
      }
    }
    
      // Check sub-area walls + procedural tile walls
      const walls = this.world.tileWallRects || [];
      for (const wall of walls) {
        const wallRect = getWallCollisionRect(wall);

        if (testX.x < wallRect.x + wallRect.w && testX.x + testX.w > wallRect.x &&
          testX.y < wallRect.y + wallRect.h && testX.y + testX.h > wallRect.y) {
        canMoveX = false;
      }
      
      if (testY.x < wallRect.x + wallRect.w && testY.x + testY.w > wallRect.x &&
          testY.y < wallRect.y + wallRect.h && testY.y + testY.h > wallRect.y) {
        canMoveY = false;
      }
    }
    
    // Block movement on axes that would collide
    if (!canMoveX) nx = this.player.position.x;
    if (!canMoveY) ny = this.player.position.y;
    
    // If both blocked, stop the backfire dash
    if (!canMoveX && !canMoveY) {
      this.backfireDashState = null;
      return;
    }
    
    this.player.position.set(nx, ny);
    s.traveled += move;
    if (s.traveled >= s.dist) this.backfireDashState = null;
  }

  updatePulseOrbs(dt) {
    const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
    const surviving = [];
    for (const orb of this.pulseOrbs) {
      const moveX = orb.vx * dt;
      const moveY = orb.vy * dt;
      orb.x += moveX;
      orb.y += moveY;
      orb.traveled += Math.sqrt(moveX * moveX + moveY * moveY);
      let hitWall = orb.x < margin || orb.x > this.world.width - margin || orb.y < margin || orb.y > this.world.height - margin;
      if (!hitWall && this.world.tileWallRects) {
        for (const wall of this.world.tileWallRects) {
          if (orb.x >= wall.x && orb.x < wall.x + wall.w && orb.y >= wall.y && orb.y < wall.y + wall.h) {
            hitWall = true;
            break;
          }
        }
      }
      if (orb.traveled >= orb.maxDist || hitWall) {
        const hit = this.enemiesInRadius(orb.x, orb.y, orb.detRadius);
        for (const e of hit) this.dealDamageToEnemy(e, orb.damage);
        this.skillEffects.push({ type: "pulseDetonation", x: orb.x, y: orb.y, radius: orb.detRadius, t: 0, duration: 0.25 });
      } else {
        surviving.push(orb);
      }
    }
    this.pulseOrbs = surviving;
  }

  updateEnemyAffixes(dt, enemy) {
    const has = (id) => enemy.affixes?.includes(id);
    const es = this.enemySystem;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;

    if (has("volatile")) {
      enemy._volatileTimer = (enemy._volatileTimer ?? 0) + dt;
      const vfx = enemy.vfxState.volatile;
      
      // Telegraph: pulsing ring 0.25s before burst
      if (enemy._volatileTimer >= 1.25 && enemy._volatileTimer < 1.5) {
        const telegraphProgress = (enemy._volatileTimer - 1.25) / 0.25;
        const radius = 10 + telegraphProgress * 30; // 10->40px
        vfx.telegraphTimer = enemy._volatileTimer - 1.25;
        vfx.telegraphRadius = radius;
      } else {
        vfx.telegraphTimer = 0;
      }
      
      if (enemy._volatileTimer >= 1.5) {
        enemy._volatileTimer = 0;
        vfx.lastBurstTime = this.time;
        
        // Burst flash
        this.transientVFX.addRing(ex, ey, enemy.size / 2, 0.08, "#ffffff");
        this.transientVFX.addRing(ex, ey, enemy.size / 2, 0.08, "#f97316");
        
        // Spawn 12-18 sparks
        const sparkCount = 12 + Math.floor(Math.random() * 7);
        for (let i = 0; i < sparkCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 80 + Math.random() * 60;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          this.particlePool.spawn(ex, ey, vx, vy, 0.15 + Math.random() * 0.1, 2, "#f97316");
        }
        
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
          const speed = 120;
          const proj = new Projectile(ex, ey, Math.cos(angle) * speed, Math.sin(angle) * speed, 6, 8, "#f97316");
          es.projectiles.push(proj);
        }
      }
    }

    if (has("regenerating") && !enemy.isDead) {
      enemy._regenAffixTimer = (enemy._regenAffixTimer ?? 0) + dt;
      while (enemy._regenAffixTimer >= 2) {
        enemy._regenAffixTimer -= 2;
        enemy.health = Math.min(enemy.maxHealth, enemy.health + 20);
      }
    }

    if (has("auraBearer")) {
      const auraRadius = 800;
      for (const other of es.enemies) {
        if (other === enemy || other.isDead) continue;
        const dx = (other.position.x + other.size / 2) - ex;
        const dy = (other.position.y + other.size / 2) - ey;
        if (dx * dx + dy * dy <= auraRadius * auraRadius) {
          other._auraBuffed = true;
        }
      }
    }

    if (has("orbiting")) {
      enemy._orbitingAngle = (enemy._orbitingAngle ?? 0) + dt * 3;
      const vfx = enemy.vfxState.orbiting;
      vfx.auraAngle = (vfx.auraAngle || 0) + dt * 0.5;
      // Scale orb radius with enemy size: base radius + size-based offset
      // Ensures orbs orbit outside the enemy's collision radius
      const orbRadius = enemy.size / 2 + 15;
      const orbCount = 4;
      
      for (let i = 0; i < orbCount; i++) {
        const a = enemy._orbitingAngle + (i / orbCount) * Math.PI * 2;
        const ox = ex + Math.cos(a) * orbRadius;
        const oy = ey + Math.sin(a) * orbRadius;
        const orbSize = 10;
        
        // Update trail
        if (!vfx.orbTrails[i]) vfx.orbTrails[i] = [];
        vfx.orbTrails[i].push({ x: ox, y: oy, angle: a });
        if (vfx.orbTrails[i].length > 3) vfx.orbTrails[i].shift();
        
        if (Math.abs(px - ox) < orbSize + this.player.size / 2 && Math.abs(py - oy) < orbSize + this.player.size / 2) {
          if (this.time - vfx.lastContactTime > 0.1) {
            vfx.lastContactTime = this.time;
            this.onPlayerDamaged(4, true);
            
            // Spawn sparks at contact
            for (let j = 0; j < 6; j++) {
              const sparkAngle = Math.random() * Math.PI * 2;
              const sparkSpeed = 40 + Math.random() * 30;
              this.particlePool.spawn(px, py, Math.cos(sparkAngle) * sparkSpeed, Math.sin(sparkAngle) * sparkSpeed, 0.12, 1.5, "#06b6d4");
            }
          }
        }
      }
    }

    if (has("lasering")) {
      const vfx = enemy.vfxState.lasering;
      const prevAngle = enemy._laserAngle || 0;
      enemy._laserAngle = (enemy._laserAngle ?? 0) + dt * 1.5;
      
      // Detect sweep start (angle wrapped around)
      if (prevAngle > enemy._laserAngle) {
        vfx.sweepStartTime = this.time;
        // Sweep start accent
        this.transientVFX.addArc(ex, ey, 25, 0, Math.PI * 2, 0.15, "#06b6d4");
      }
      
      vfx.emitterPulse = (vfx.emitterPulse || 0) + dt * 8;
      const beamLen = 150;
      const beamW = 20;
      const bx = ex + Math.cos(enemy._laserAngle) * beamLen;
      const by = ey + Math.sin(enemy._laserAngle) * beamLen;
      const proj = { x1: ex, y1: ey, x2: bx, y2: by, w: beamW };
      const dist = pointToSegmentDist(px, py, proj.x1, proj.y1, proj.x2, proj.y2);
      const playerInBeam = dist < beamW;
      
      // Guide line (0.2s ahead)
      const leadAngle = enemy._laserAngle + 1.5 * 0.2;
      const leadX = ex + Math.cos(leadAngle) * beamLen;
      const leadY = ey + Math.sin(leadAngle) * beamLen;
      this.transientVFX.addLine(ex, ey, leadX, leadY, 0.2, "rgba(6,182,212,0.3)", 1);
      
      // If player is in the beam and hasn't been hit yet in this sweep, deal damage
      if (playerInBeam && !enemy._laserHitPlayer) {
        this.onPlayerDamaged(30, true);
        enemy._laserHitPlayer = true;
        vfx.lastHitTime = this.time;
        
        // Zap burst at player
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const speed = 60 + Math.random() * 40;
          this.particlePool.spawn(px, py, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.1, 2, "#06b6d4");
        }
        this.transientVFX.addRing(px, py, 8, 0.08, "#ffffff");
      }
      
      // Reset hit flag when player is no longer in the beam
      if (!playerInBeam) {
        enemy._laserHitPlayer = false;
      }
    }

    if (has("regenerating") && !enemy.isDead) {
      enemy.health = Math.min(enemy.maxHealth, enemy.health + 3 * dt);
    }
  }

  updateCombat(dt) {
    const player = this.player;

    // Update VFX systems
    this.particlePool.update(dt);
    this.transientVFX.update(dt);
    updateFanStrikeVfx(dt);
    
    // Update player debuff VFX
    this.updatePlayerDebuffVFX(dt);

    // Player attack cooldown
    if (this.playerAttackTimer > 0) this.playerAttackTimer -= dt;

    for (let i = 0; i < 4; i++) {
      const before = this.skillCooldowns[i] || 0;
      if (before > 0) {
        this.skillCooldowns[i] = Math.max(0, before - dt);
        if (before > 0 && this.skillCooldowns[i] <= 0) {
          onSkillReadyRefillFocus(this, i);
          onRingSkillCooldownRestored(this, i);
        }
      }
    }
    while (this.chainCastQueue.length > 0 && this.chainCastQueue[0].t <= this.time) {
      const { skillId, slot, allowTriggeredProcs } = this.chainCastQueue.shift();
      this.executeSkill(skillId, slot, { chainCast: true, triggered: true, allowTriggeredProcs: allowTriggeredProcs === true });
    }

    if (this.mouseHeld && !this.gameOver && !this.paused && !this.levelUpChoices) {
      this.tryBasicAttack(this.lastMouseWorld.x, this.lastMouseWorld.y);
    }
    if (this.delayedFireQueue && this.delayedFireQueue.length > 0) {
      const stillPending = [];
      for (const item of this.delayedFireQueue) {
        if (this.time >= item.at) {
          this.firePlayerProjectile(item.targetX, item.targetY, item.damageMult || 1, {
            angleOffsetRad: item.angleOffsetRad || 0,
            mirrorProc: !!item.mirrorProc
          });
        }
        else stillPending.push(item);
      }
      this.delayedFireQueue = stillPending;
    }

    this.updateDashStrike(dt);
    this.updateBackfireDash(dt);
    this.updatePulseOrbs(dt);
    this.updatePlayerProjectiles(dt);

    const es = this.enemySystem;

    // -------- Boss logic (includes minions) --------
    if (es.boss) {
      const minionSurviving = [];
      const globalSlow = this.timeWarpUntil > this.time ? 0.5 : 1;
      for (const e of es.enemies) e._auraBuffed = false;
      for (const enemy of es.enemies) {
        if (enemy.attackCtrl) {
          if (enemy._attackDashState) enemy.attackCtrl.updateDash(dt, this);
          if (enemy._jumpSlamState) enemy.attackCtrl.updateJumpSlam(dt, this);
          enemy.attackCtrl.update(dt, this);
        }
        if (enemy.name === "Big Slime" && enemy.enemyTier === "miniBoss" && !enemy._hasSplit && enemy.health <= enemy.maxHealth * 0.5) {
          enemy._hasSplit = true;
          const ex = enemy.position.x + enemy.size / 2;
          const ey = enemy.position.y + enemy.size / 2;
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
            const off = 35 + Math.random() * 25;
            this.spawnEnemyMinion(ex + Math.cos(angle) * off - 43, ey + Math.sin(angle) * off - 43, "m_3a_small_slime");
          }
          enemy.health = 0;
        }
        enemy.update(dt, player, this.time, globalSlow, 400, this);
        this.updateEnemyAffixes(dt, enemy);
        this.processEnemyDebuffs(dt, enemy);
        // Attack ready telegraph
        const ex = enemy.position.x + enemy.size / 2;
        const ey = enemy.position.y + enemy.size / 2;
        if (enemy.attackTimer <= 0 && !enemy.intersects(player)) {
          const pulsePhase = (this.time * 1.67) % 1;
          if (pulsePhase < 0.2) {
            const radius = enemy.size / 2 + pulsePhase * 10;
            this.transientVFX.addRing(ex, ey, radius, 0.2, "rgba(239,68,68,0.6)");
          }
        } else if (enemy.attackTimer > 0) {
          const chargeProgress = 1 - (enemy.attackTimer / enemy.attackCooldown);
          if (chargeProgress > 0.7) {
            const radius = enemy.size / 2 + chargeProgress * 8;
            this.transientVFX.addRing(ex, ey, radius, 0.1, `rgba(239,68,68,${chargeProgress * 0.5})`);
          }
        }
        
        if (enemy.intersects(player)) {
          if (enemy.attackTimer <= 0) {
            enemy.attackTimer = enemy.attackCooldown;
            this.lastDamagingEnemy = enemy;
            
            // Impact burst at contact
            const px = player.position.x + player.size / 2;
            const py = player.position.y + player.size / 2;
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              const speed = 40 + Math.random() * 30;
              this.particlePool.spawn(px, py, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.15, 2, "#ef4444");
            }
            
            this.onPlayerDamaged(enemy.attack, true);
          }
        }
        if (enemy.intersects(player) && this.hasUpgradeCard("thorns")) {
          const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
          this.dealDamageToEnemy(enemy, thornsDmg);
        }
    if (enemy.regenRate && !enemy.isDead) {
      enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.regenRate * dt);
    }
    if (enemy.regenChannelUntil != null && this.time < enemy.regenChannelUntil && !enemy.isDead) {
      enemy.health = Math.min(enemy.maxHealth, enemy.health + (enemy.regenChannelRate ?? 15) * dt);
    }
      if (enemy.isDead) {
        if (this.hasCondition("enemyExplode")) {
          this.onPlayerDamaged(8, true);
        }
        const martyrMinions = this.dropLootFromEnemy(enemy);
        minionSurviving.push(...(martyrMinions || []));
      } else {
        minionSurviving.push(enemy);
      }
    }
    es.enemies = minionSurviving;
      this.updateBoss(dt);
      this.updateProjectiles(dt);
      return;
    }

    // -------- Regular enemies --------
    this.updateDelayedEnemyImpacts();
    const surviving = [];
    const globalSlow = this.timeWarpUntil > this.time ? 0.5 : 1;
    for (const e of es.enemies) e._auraBuffed = false;
    for (const enemy of es.enemies) {
      // Attack controller: dash and jump slam movement (before normal update)
      if (enemy.attackCtrl) {
        if (enemy._attackDashState) enemy.attackCtrl.updateDash(dt, this);
        if (enemy._jumpSlamState) enemy.attackCtrl.updateJumpSlam(dt, this);
        enemy.attackCtrl.update(dt, this);
      }
      // Big Slime split at 50% hp (miniboss only)
      if (enemy.name === "Big Slime" && enemy.enemyTier === "miniBoss" && !enemy._hasSplit && enemy.health <= enemy.maxHealth * 0.5) {
        enemy._hasSplit = true;
        const ex = enemy.position.x + enemy.size / 2;
        const ey = enemy.position.y + enemy.size / 2;
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
          const off = 35 + Math.random() * 25;
          this.spawnEnemyMinion(ex + Math.cos(angle) * off - 43, ey + Math.sin(angle) * off - 43, "m_3a_small_slime");
        }
        enemy.health = 0;
      }
      enemy.update(dt, player, this.time, globalSlow, this.viewWidth / 4, this);
      this.updateEnemyAffixes(dt, enemy);
      this.processEnemyDebuffs(dt, enemy);

      // Attack VFX removed - no red circle effects

      if (enemy.intersects(player)) {
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.attackCooldown;
          this.lastDamagingEnemy = enemy;
          
          // Impact burst at contact
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const speed = 40 + Math.random() * 30;
            this.particlePool.spawn(px, py, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.15, 2, "#ef4444");
          }
          
          this.onPlayerDamaged(enemy.attack, true);
        }
      }

      if (enemy.intersects(player) && this.hasUpgradeCard("thorns")) {
        const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
        this.dealDamageToEnemy(enemy, thornsDmg);
      }

      if (enemy.regenRate && !enemy.isDead) {
        enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.regenRate * dt);
      }
      if (enemy.regenChannelUntil != null && this.time < enemy.regenChannelUntil && !enemy.isDead) {
        enemy.health = Math.min(enemy.maxHealth, enemy.health + (enemy.regenChannelRate ?? 15) * dt);
      }

      if (enemy.isDead) {
        if (this.hasCondition("enemyExplode")) {
          this.onPlayerDamaged(8, true);
        }
        const martyrMinions = this.dropLootFromEnemy(enemy);
        surviving.push(...(martyrMinions || []));
      } else {
        surviving.push(enemy);
      }
    }

    es.enemies = surviving;
    this.updateProjectiles(dt);
    es.update(dt);
    this.updateEnemyCountUI();

    this.floatingCombatText = this.floatingCombatText.filter((e) => this.time - e.t <= 0.8);
  }

  updatePlayerDebuffVFX(dt) {
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    
    // Update weakening shards
    if (this._weakeningShards) {
      for (let i = this._weakeningShards.length - 1; i >= 0; i--) {
        const shard = this._weakeningShards[i];
        shard.t += dt;
        if (shard.t >= shard.duration) {
          this._weakeningShards.splice(i, 1);
        }
      }
    }
    
    // Weakening ring
    if (this._weakeningRingTime && this.time >= this._weakeningRingTime && this.time < this._weakeningRingTime + 0.12) {
      const progress = (this.time - this._weakeningRingTime) / 0.12;
      const radius = 10 + progress * 18; // 10->28px
      this.transientVFX.addRing(px, py, radius, 0.12, "#8b5cf6");
    }
    
    // Update debuff states
    const debuffs = this.playerDebuffVFX;
    
    // Weakening: downward streaks
    if (debuffs.weakening.active && this.playerWeakenUntil > this.time) {
      debuffs.weakening.active = true;
      debuffs.weakening.until = this.playerWeakenUntil;
      debuffs.weakening.streakTimer = (debuffs.weakening.streakTimer || 0) + dt;
      if (debuffs.weakening.streakTimer >= 0.25) {
        debuffs.weakening.streakTimer = 0;
        // Spawn downward streak
        const streakX = px + (Math.random() - 0.5) * this.player.size;
        this.particlePool.spawn(streakX, py - this.player.size / 2, 0, 50, 0.3, 2, "#8b5cf6");
      }
    } else {
      debuffs.weakening.active = false;
    }
    
    // Slow: pale-blue ring + rotating arcs
    if (debuffs.slow.active && this.playerSlowUntil > this.time) {
      debuffs.slow.active = true;
      debuffs.slow.until = this.playerSlowUntil;
    } else {
      debuffs.slow.active = false;
    }
    
    // Burn: embers drifting upward
    if (debuffs.burn.active && this.playerBurnUntil > this.time) {
      debuffs.burn.active = true;
      debuffs.burn.until = this.playerBurnUntil;
      debuffs.burn.emberTimer = (debuffs.burn.emberTimer || 0) + dt;
      if (debuffs.burn.emberTimer >= 0.5) {
        debuffs.burn.emberTimer = 0;
        // Spawn 2 embers
        for (let i = 0; i < 2; i++) {
          const emberX = px + (Math.random() - 0.5) * this.player.size;
          this.particlePool.spawn(emberX, py, (Math.random() - 0.5) * 20, -30 - Math.random() * 20, 0.8, 2, "#f97316");
        }
      }
    } else {
      debuffs.burn.active = false;
    }
    
    // Weaken: purple crack lines
    if (debuffs.weaken.active && this.playerCursedWeakenUntil > this.time) {
      debuffs.weaken.active = true;
      debuffs.weaken.until = this.playerCursedWeakenUntil;
      debuffs.weaken.crackTimer = (debuffs.weaken.crackTimer || 0) + dt;
      if (debuffs.weaken.crackTimer >= 0.4) {
        debuffs.weaken.crackTimer = 0;
        // Spawn crack line segment
        const angle = Math.random() * Math.PI * 2;
        const dist = this.player.size / 2 + Math.random() * 10;
        const x1 = px + Math.cos(angle) * dist;
        const y1 = py + Math.sin(angle) * dist;
        const x2 = x1 + Math.cos(angle + (Math.random() - 0.5) * 0.5) * (5 + Math.random() * 8);
        const y2 = y1 + Math.sin(angle + (Math.random() - 0.5) * 0.5) * (5 + Math.random() * 8);
        this.transientVFX.addLine(x1, y1, x2, y2, 0.3, "#8b5cf6", 1);
      }
    } else {
      debuffs.weaken.active = false;
    }
    
    // Stun: yellow stars orbiting
    if (debuffs.stun.active && this.stunTimer > 0) {
      debuffs.stun.active = true;
      debuffs.stun.until = this.time + this.stunTimer;
    } else {
      debuffs.stun.active = false;
    }
  }

  updateAuras(dt) {
    if (this.activeAuras.size === 0) return;
    const maxHp = this.currentStats.maxHealth;
    if (maxHp <= 0) return;

    let totalUpkeep = 0;
    for (const auraId of this.activeAuras) {
      const def = SKILL_DEFS.find((s) => s.id === auraId);
      if (def && def.auraUpkeep) totalUpkeep += def.auraUpkeep * maxHp * dt;
    }

    if (totalUpkeep > 0) {
      this.currentHealth -= totalUpkeep;
      if (this.currentHealth <= 0) {
        this.currentHealth = 0;
        this.activeAuras.clear();
        this.updateHealthBar();
        this.updateSkillUI();
        this.showGameOver();
        return;
      }
      this.updateHealthBar();
    }

    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const auraRadius = 100;

    if (this.activeAuras.has("frostAura")) {
      const hit = this.enemiesInRadius(px, py, auraRadius);
      for (const e of hit) {
        e.slowUntil = this.time + 0.5;
        e.slowMult = 0.75;
        mirrorAncestorDebuffToPlayer(this, "slow");
      }
    }
    if (this.activeAuras.has("flameAura")) {
      this.flameAuraAccum = (this.flameAuraAccum || 0) + dt;
      const flameMults = this.getSkillMultipliersFor("flameAura");
      const flameTickRate = 5 * (flameMults.attackSpeedMult || 1);
      const flameTickInterval = Math.max(0.05, 1 / flameTickRate);
      if (this.flameAuraAccum >= flameTickInterval) {
        this.flameAuraAccum = 0;
        const hit = this.enemiesInRadius(px, py, auraRadius);
        const dmg = Math.max(1, Math.round(this.currentStats.attack * 0.2 * (flameMults.damageMult || 1)));
        for (const e of hit) {
          this.dealDamageToEnemy(e, dmg, { isSkill: true });
          e.burnUntil = this.time + 3;
          e.burnDps = Math.max(e.burnDps || 0, dmg * 0.15);
          e.burnAccum = 0;
          mirrorAncestorDebuffToPlayer(this, "burn");
        }
        // Destroy nearby ice blocks
        if (this.obstacles) {
          for (const obstacle of this.obstacles) {
            if (obstacle.destroyed || obstacle.type !== "iceBlock") continue;
            const ox = obstacle.position.x + obstacle.size.w / 2;
            const oy = obstacle.position.y + obstacle.size.h / 2;
            const dist = Math.sqrt((px - ox) ** 2 + (py - oy) ** 2);
            if (dist < auraRadius) {
              obstacle.destroyed = true;
            }
          }
        }
      }
    }
    if (this.activeAuras.has("thunderAura")) {
      this.thunderAuraAccum = (this.thunderAuraAccum || 0) + dt;
      const thunderMults = this.getSkillMultipliersFor("thunderAura");
      const thunderInterval = Math.max(0.1, 1.5 / (thunderMults.attackSpeedMult || 1));
      if (this.thunderAuraAccum >= thunderInterval) {
        this.thunderAuraAccum = 0;
        const target = this.getNearestEnemy(px, py, 200);
        if (target) {
          const dmg = this.computeSkillDamage(target, 0.6, null, { skillId: "thunderAura", skillMults: thunderMults });
          this.dealDamageToEnemy(target, dmg, { isSkill: true });
        }
      }
    }
  }

  dealDamageToEnemy(enemy, amount, opts = {}) {
    let dmg = Math.round(amount);
    const skillSlot = opts.skillSlot;
    const resolvedSkillId = opts.skillId || (skillSlot != null ? this.skills?.[skillSlot] : null);
    if (typeof this.runPillarEvent === "function") {
      const beforeDealDamage = this.runPillarEvent("beforeDealDamage", {
        source: "player",
        enemy,
        amount: dmg,
        opts,
        skillSlot,
        skillId: resolvedSkillId,
        isSkill: !!opts.isSkill,
        isDot: !!opts.isDot,
        time: this.time
      });
      if (beforeDealDamage?.cancel) {
        return;
      }
      dmg = Math.round(beforeDealDamage?.amount ?? dmg);
    }
    let isMeleeHit = !!opts.isMeleeHit;
    if (!isMeleeHit && resolvedSkillId) {
      const ctx = this.buildSkillContext(resolvedSkillId);
      isMeleeHit = ctx.tagsSet.has("melee");
    }
    const ringHitInfo = { isDirectAttack: !opts.isSkill && !opts.isDot && !opts.isReflect, previewDamage: dmg, forceExecute: false };
    dmg = Math.max(1, Math.round(dmg * getRingDamageMultiplierForHit(this, enemy, ringHitInfo)));
    if (ringHitInfo.forceExecute && !opts.isDot) {
      dmg = Math.max(dmg, enemy.health);
    }
    const isRangedHit = !isMeleeHit;
    dmg = Math.max(1, Math.round(dmg * getAncestorOutgoingDamageMult(this, enemy, { isMeleeHit, isRangedHit, skillId: resolvedSkillId, isSkill: !!opts.isSkill })));
    if (typeof this.getPillarOutgoingDamageMultiplier === "function") {
      dmg = Math.max(1, Math.round(dmg * this.getPillarOutgoingDamageMultiplier({
        enemy,
        skillId: resolvedSkillId,
        isMeleeHit,
        isRangedHit,
        isSkill: !!opts.isSkill,
        isDot: !!opts.isDot
      })));
    }
    if (this.playerInWeakeningPatch) dmg = Math.max(1, Math.round(dmg * 0.7));
    if (this.hasCondition("enemyResist")) dmg = Math.max(1, Math.round(dmg * 0.8));
    const effectiveDefense = (enemy.defense || 0) * (enemy.voidDefenseMult ?? 1);
    dmg = Math.max(1, Math.round(dmg - effectiveDefense));
    if (enemy._armorUntil != null && this.time < enemy._armorUntil) {
      dmg = Math.max(1, Math.round(dmg * (enemy._armorMult ?? 0.5)));
    }
    if (enemy.regenChannelUntil != null && this.time < enemy.regenChannelUntil && enemy.regenBreakThreshold != null) {
      enemy.regenBreakDamage = (enemy.regenBreakDamage || 0) + dmg;
      if (enemy.regenBreakDamage >= enemy.regenBreakThreshold) {
        enemy.regenChannelUntil = null;
      }
    }
    if (hasTalent("predator") && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= 0.25) {
      dmg = Math.max(1, Math.round(dmg * 1.5));
    }
    if (dmg > 0 && !opts.isDot && (this._lastEnemyHurtSfx == null || this.time - this._lastEnemyHurtSfx >= 0.08)) {
      this._lastEnemyHurtSfx = this.time;
      playSfx("enemyHurt");
    }
    const debuffBefore = {
      burnUntil: enemy.burnUntil || 0,
      slowUntil: enemy.slowUntil || 0,
      stunUntil: enemy.stunUntil || 0,
      toxicUntil: enemy.toxicUntil || 0,
      toxicStacks: enemy.toxicStacks || 0,
      voidDefenseUntil: enemy.voidDefenseUntil || 0,
      bleedTimer: enemy.bleedTimer || 0,
      bleedStacks: enemy.bleedStacks || 0,
      meleeVulnUntil: enemy.meleeVulnUntil || 0,
      meleeVulnStacks: enemy.meleeVulnStacks || 0
    };
    if (dmg > 0 && !opts.isDot && opts.meleeFreeze != null && opts.meleeFreeze > 0) {
      const until = this.time + opts.meleeFreeze;
      enemy.stunUntil = enemy.stunUntil != null ? Math.max(enemy.stunUntil, until) : until;
    }
    const mods = opts.modList != null ? opts.modList : (skillSlot != null ? getModsForSkillSlot(this, skillSlot) : []);
    const mult = getModEffectMult(this);
    if (mods.includes("lifesteal") && dmg > 0) {
      const lifestealPct = 0.15 * mult + (this.hasUpgradeCard("vampiric") ? 0.05 : 0);
      const heal = Math.max(1, Math.round(dmg * lifestealPct));
      this.healPlayer(heal);
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      this.addFloatingText(px, py, `+${heal}`, "heal");
    }
    if (opts.isSkill && dmg > 0 && hasRing(this, "ring_blood_channel")) {
      const skillLifesteal = Math.max(1, Math.round(dmg * 0.05 * getRingCount(this, "ring_blood_channel")));
      this.healPlayer(skillLifesteal);
    }
    const has = (id) => enemy.affixes?.includes(id);

    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const isKillingBlow = enemy.health <= dmg;
    const hitType = opts.isDot ? "dot" : opts.isSkill ? "skill" : opts.isCrit ? "crit" : "normal";
    this.addFloatingText(ex, ey, dmg, hitType, isKillingBlow);

    if (!opts.isDot && mods.length > 0) {
      applyElementDebuffsFromMods(this, enemy, mods, amount, this.time);
    }
    if (!opts.isDot && dmg > 0) {
      handleAncestorOnHit(this, { enemy, hitDamage: dmg, isMeleeHit, isRangedHit, skillId: resolvedSkillId, isSkill: !!opts.isSkill });
      if ((enemy.burnUntil || 0) > Math.max(this.time, debuffBefore.burnUntil)) mirrorAncestorDebuffToPlayer(this, "burn");
      if ((enemy.slowUntil || 0) > Math.max(this.time, debuffBefore.slowUntil)) mirrorAncestorDebuffToPlayer(this, "slow");
      if ((enemy.stunUntil || 0) > Math.max(this.time, debuffBefore.stunUntil)) mirrorAncestorDebuffToPlayer(this, "freeze");
      if ((enemy.toxicUntil || 0) > Math.max(this.time, debuffBefore.toxicUntil) || (enemy.toxicStacks || 0) > debuffBefore.toxicStacks) {
        mirrorAncestorDebuffToPlayer(this, "toxic");
      }
      if ((enemy.voidDefenseUntil || 0) > Math.max(this.time, debuffBefore.voidDefenseUntil)) mirrorAncestorDebuffToPlayer(this, "void");
      if ((enemy.bleedTimer || 0) > Math.max(0, debuffBefore.bleedTimer) || (enemy.bleedStacks || 0) > debuffBefore.bleedStacks) {
        mirrorAncestorDebuffToPlayer(this, "bleed");
      }
      if ((enemy.meleeVulnUntil || 0) > Math.max(0, debuffBefore.meleeVulnUntil) || (enemy.meleeVulnStacks || 0) > debuffBefore.meleeVulnStacks) {
        mirrorAncestorDebuffToPlayer(this, "vulnerability");
      }
    }

    if (has("weakening")) {
      this.playerWeakenUntil = this.time + 2;
      
      // Trigger weakening VFX: shards from enemy to player
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const shardCount = 3 + Math.floor(Math.random() * 3);
      if (!this._weakeningShards) this._weakeningShards = [];
      for (let i = 0; i < shardCount; i++) {
        const delay = i * 0.03;
        const startX = ex + (Math.random() - 0.5) * enemy.size;
        const startY = ey + (Math.random() - 0.5) * enemy.size;
        
        // Store shard for lerp animation
        this._weakeningShards.push({
          startX, startY, px, py,
          t: -delay,
          duration: 0.15,
          size: 3 + Math.random() * 2
        });
      }
      
      // Set arrival time for ring effect
      this._weakeningRingTime = this.time + 0.15;
      this.playerDebuffVFX.weakening.active = true;
      this.playerDebuffVFX.weakening.until = this.playerWeakenUntil;
    }

    if (has("rooted") && !opts.isDot) {
      // Track minions spawned per enemy, not globally
      if (!enemy.rootedMinionsSpawned) enemy.rootedMinionsSpawned = 0;
      if (enemy.rootedMinionsSpawned < 5) {
        enemy.rootedMinionsSpawned++;
        const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
        const size = Math.round(base.size * 0.7);
        const offset = 25 + Math.random() * 20;
        const angle = Math.random() * Math.PI * 2;
        const mx = enemy.position.x + enemy.size / 2 + Math.cos(angle) * offset - size / 2;
        const my = enemy.position.y + enemy.size / 2 + Math.sin(angle) * offset - size / 2;
        const typeDef = { ...base, maxHealth: Math.round(base.maxHealth * 0.4), attack: base.attack, speed: Math.round(base.speed * 1.5), size };
        const minion = new Enemy(mx, my, typeDef);
        minion.worldBounds = enemy.worldBounds;
        minion.activated = true;
        minion.alerted = true;
        minion.moveBehavior = "CHARGE";
        minion.forceDirectChase = true;
        minion.isAffixMinion = true;
        this.enemySystem.enemies.push(minion);
      }
    }

    enemy.takeDamage(dmg);
    if (dmg > 0) {
      tryProcBattleRhythm(this, !!opts.isSkill);
      tryProcEchoEngine(this, enemy, opts);
    }
    if (typeof this.runPillarEvent === "function") {
      this.runPillarEvent("afterDealDamage", {
        source: "player",
        enemy,
        finalDamage: dmg,
        isSkill: !!opts.isSkill,
        isDot: !!opts.isDot,
        skillId: resolvedSkillId,
        skillSlot,
        time: this.time
      });
    }
    
    // Track enemy death for tutorial
    if (enemy.isDead && this.tutorialSystem) {
      // Check if this is a boss
      if (enemy.isBoss || enemy === this.enemySystem?.boss) {
        this.tutorialSystem.onBossKilled();
      } else {
        this.tutorialSystem.onEnemyKilled();
        
        // Spawn more enemies for level up step if needed
        if (this.tutorialMode && this.tutorialEnemiesKilled === 0) {
          this.tutorialEnemiesKilled++;
          // Spawn more enemies after a short delay to help with level up
          setTimeout(() => {
            this.spawnTutorialEnemyForLevelUp();
          }, 1000);
        }
      }
    }

    if (enemy.isDead && has("undying") && !enemy._undyingUsed) {
      enemy._undyingUsed = true;
      enemy.health = Math.ceil(enemy.maxHealth * 0.5);
      enemy._undyingRespawnTime = this.time + 0.8;
    }

    if (enemy.isDead && this.hasBlessing("aftershock")) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const radius = Math.min(this.viewWidth, this.viewHeight) * 0.25;
      const aftershockDmg = Math.max(1, Math.round(enemy.maxHealth * 0.1));
      const hit = this.enemiesInRadius(ex, ey, radius);
      for (const e of hit) {
        if (e !== enemy && !e.isDead) this.dealDamageToEnemy(e, aftershockDmg, { isSkill: true });
      }
    }

    if (this.activeAuras.has("soulAura") && dmg > 0) {
      const heal = Math.round(dmg * 0.5);
      this.healPlayer(heal);
    }
    if (enemy.isDead) {
      if (!enemy._deathSmokeSpawned) {
        enemy._deathSmokeSpawned = true;
        this.spawnEnemyDeathSmokeVfx(enemy);
      }
      if (!enemy._deathSfxPlayed) {
        enemy._deathSfxPlayed = true;
        playSfx("enemyDie");
      }
      if (skillSlot != null && getModsForSkillSlot(this, skillSlot).includes("cooldownCascade")) {
        this.skillCooldowns[skillSlot] = 0;
        this.skillCascadeFlashUntil = this.skillCascadeFlashUntil || {};
        this.skillCascadeFlashUntil[skillSlot] = this.time + 0.3;
        onSkillReadyRefillFocus(this, skillSlot);
        onRingSkillCooldownRestored(this, skillSlot);
        if (typeof this.requestPillarCooldownRefresh === "function") {
          this.requestPillarCooldownRefresh({
            slot: skillSlot,
            skillId: resolvedSkillId,
            source: "cooldownCascade"
          });
        }
      }
      const canTriggeredSkillsTrigger = !opts.triggeredCast || opts.allowTriggeredProcs === true;
      if (canTriggeredSkillsTrigger) {
        this.triggerOnKillMods({ allowTriggeredProcs: opts.allowTriggeredProcs === true });
      }
      handleAncestorOnEnemyKilled(this, enemy, { isSkill: !!opts.isSkill, skillId: resolvedSkillId, skillSlot });
      onRingEnemyKilled(this, enemy);
      if (typeof this.runPillarEvent === "function") {
        this.runPillarEvent("afterKillEnemy", {
          enemy,
          isSkill: !!opts.isSkill,
          skillId: resolvedSkillId,
          skillSlot,
          time: this.time
        });
      }
    }
  }

  dealDamageToBreakable(breakable, amount) {
    if (!breakable || breakable.isDead) return;
    let mult = getAncestorBreakableDamageMult(this);
    if (hasRing(this, "ring_demolisher")) {
      mult *= Math.pow(1.5, getRingCount(this, "ring_demolisher"));
    }
    if (typeof this.getPillarOutgoingDamageMultiplier === "function") {
      mult *= this.getPillarOutgoingDamageMultiplier({
        breakable,
        isBreakable: true,
        time: this.time
      });
    }
    const dmg = Math.max(1, Math.round(amount * mult));
    if (dmg > 0 && (this._lastBreakableHurtSfx == null || this.time - this._lastBreakableHurtSfx >= 0.06)) {
      this._lastBreakableHurtSfx = this.time;
      playSfx("enemyHurt");
    }
    const wasAlive = !breakable.isDead;
    breakable.takeDamage(dmg, this.time, null, this);
    if (wasAlive && breakable.isDead) {
      handleAncestorOnBreakableDestroyed(this, breakable);
      onRingBreakableDestroyed(this, breakable);
      if (typeof this.runPillarEvent === "function") {
        this.runPillarEvent("afterDestroyObject", {
          object: breakable,
          finalDamage: dmg,
          time: this.time
        });
      }
    }
  }

  processEnemyDebuffs(dt, enemy) {
    if (enemy.isDead) return;
    const t = this.time;
    if (enemy.burnUntil != null && t < enemy.burnUntil) {
      enemy.burnAccum = (enemy.burnAccum || 0) + dt;
      if (enemy.burnAccum >= 0.5) {
        enemy.burnAccum = 0;
        const burnDmg = Math.max(1, Math.round((enemy.burnDps || 0) * 0.5));
        this.dealDamageToEnemy(enemy, burnDmg, { isDot: true });
      }
    } else {
      enemy.burnUntil = null;
      enemy.burnDps = 0;
    }
    if (enemy.toxicStacks > 0 && enemy.toxicUntil != null && t < enemy.toxicUntil) {
      enemy.toxicAccum = (enemy.toxicAccum || 0) + dt;
      const dpsPerStack = enemy.maxHealth * 0.05;
      if (enemy.toxicAccum >= 0.5) {
        enemy.toxicAccum = 0;
        const toxicDmg = Math.max(1, Math.round(dpsPerStack * enemy.toxicStacks * 0.5));
        this.dealDamageToEnemy(enemy, toxicDmg, { isDot: true });
      }
    } else if (enemy.toxicUntil != null && t >= enemy.toxicUntil) {
      enemy.toxicStacks = 0;
      enemy.toxicUntil = null;
    }
    if ((enemy.meleeVulnUntil || 0) <= t) {
      enemy.meleeVulnStacks = 0;
      enemy.meleeVulnUntil = 0;
    }
    tickEnemyBleed(this, enemy, dt);
  }

  triggerOnKillMods(triggerOptions = {}) {
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const allowTriggeredProcs = triggerOptions.allowTriggeredProcs === true;
    for (let slot = 0; slot < 4; slot++) {
      const mods = getModsForSkillSlot(this, slot);
      if (!mods.includes("onKill")) continue;
      const skillId = this.skills[slot];
      if (!skillId) continue;
      const def = SKILL_DEFS.find((s) => s.id === skillId);
      if (def && def.category === "aura") continue;
      this.executeSkill(skillId, slot, { noCooldown: true, onKill: true, triggered: true, allowTriggeredProcs });
    }
  }

  computeSkillDamage(enemy, multiplier = 1, slot = null, opts = {}) {
    const skillId = opts.skillId || (slot != null ? this.skills?.[slot] : null);
    const skillMults = opts.skillMults || this.getSkillMultipliersFor(skillId);
    const baseSkillMult = this.equipmentSkillDamageMult ?? 1;
    const flatBonus = getSkillFlatDamageBonus(this, skillId);
    let dmg = Math.round((this.currentStats.attack + flatBonus) * multiplier * baseSkillMult * (skillMults.damageMult || 1));
    const mods = slot != null ? getModsForSkillSlot(this, slot) : [];
    const mult = getModEffectMult(this);
    if (mods.includes("amplify")) dmg = Math.round(dmg * (1 + 0.25 * mult));
    if (mods.includes("recoil")) dmg = Math.round(dmg * (1 + 0.3 * mult));
    if (opts.sacrificeMult) dmg = Math.round(dmg * opts.sacrificeMult);
    if (opts.ringProcDamageMult && opts.ringProcDamageMult !== 1) {
      dmg = Math.round(dmg * opts.ringProcDamageMult);
    }
    if (slot != null && this.empowerStacks && this.empowerStacks[slot] > 0) {
      dmg = Math.round(dmg * (1 + 0.05 * mult * Math.min(10, this.empowerStacks[slot])));
    }
    if (this.hasUpgradeCard("glassCannon")) dmg = Math.round(dmg * 1.5);
    if (this.hasUpgradeCard("doubleStrike")) {
      this.doubleStrikeCounter++;
      if (this.doubleStrikeCounter >= 5) {
        this.doubleStrikeCounter = 0;
        dmg *= 2;
      }
    }
    if (this.hasUpgradeCard("berserkerRage")) {
      const ratio = this.currentStats.maxHealth > 0 ? this.currentHealth / this.currentStats.maxHealth : 1;
      dmg *= 1 + (1 - ratio) * 0.5;
    }
    if (enemy && hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
      dmg = Math.round(dmg * 1.25);
    }
    return dmg;
  }

  getSkillCooldownMult(skillId = null) {
    const skillMults = this.getSkillMultipliersFor(skillId);
    const atkSpdFromRun = 1 + this.getAttackUpgradeValue("attackSpeed") - this.getAttackPenaltyValue("speedPenalty");
    const baseCooldownMult = this.equipmentCooldownRecovery ?? 1;
    let mult = (1 / atkSpdFromRun) * baseCooldownMult * (skillMults.cooldownMult || 1);
    if (this.hasUpgradeCard("berserkerRage")) {
      const ratio = this.currentStats.maxHealth > 0 ? this.currentHealth / this.currentStats.maxHealth : 1;
      mult *= Math.max(0.4, ratio);
    }
    return Math.min(1, mult * 1.2);
  }

  buildSkillContext(skillId) {
    return buildSkillContextBase(skillId);
  }

  getAllPlayerSkillModifiers() {
    return collectAllPlayerModifiers(this);
  }

  getSkillMultipliersFor(skillId) {
    if (!skillId) {
      return { damageMult: 1, cooldownMult: 1, attackSpeedMult: 1, effectPowerMult: 1 };
    }
    if (this._skillMultiplierCacheTime !== this.time) {
      this._skillMultiplierCacheTime = this.time;
      this._skillMultiplierCacheMods = this.getAllPlayerSkillModifiers();
      this._skillMultiplierCache = new Map();
    }
    if (this._skillMultiplierCache?.has(skillId)) {
      return this._skillMultiplierCache.get(skillId);
    }
    const { skillDef } = this.buildSkillContext(skillId);
    const mults = computeSkillMultipliers(skillDef, this.currentStats, this._skillMultiplierCacheMods || []);
    this._skillMultiplierCache.set(skillId, mults);
    return mults;
  }

  debugLogSkillMultipliers(skillId, extraModifiers = []) {
    const { skillDef } = this.buildSkillContext(skillId);
    const baseModifiers = this.getAllPlayerSkillModifiers();
    const before = computeSkillMultipliers(skillDef, this.currentStats, baseModifiers);
    const after = computeSkillMultipliers(skillDef, this.currentStats, baseModifiers.concat(extraModifiers));
    console.log("[SkillTagDebug]", skillId, {
      tags: skillDef?.tags || [],
      before,
      after
    });
    return { before, after };
  }

  runSkillTagDebugHarness() {
    const projectileDamage = { id: "projectileDamagePct", statKey: "skillDamage", value: 0.10, appliesTo: { tagsAny: ["projectile"] } };
    const areaDamage = { id: "areaDamagePct", statKey: "skillDamage", value: 0.10, appliesTo: { tagsAny: ["area"] } };
    const utilityCdr = { id: "debugUtilityCooldownPct", statKey: "cooldownRecovery", value: 0.10, appliesTo: { tagsAny: ["utility"] } };
    const tests = [
      { label: "projectileDamagePct", modifier: projectileDamage, shouldIncrease: "projectile", shouldNotIncrease: "fanStrike" },
      { label: "areaDamagePct", modifier: areaDamage, shouldIncrease: "pulseShot", shouldNotIncrease: "thrustStrike" },
      { label: "debugUtilityCooldownPct", modifier: utilityCdr, shouldIncrease: "dashStrike", shouldNotIncrease: "projectile" }
    ];

    console.log("[SkillTagDebug] running tag modifier harness");
    for (const test of tests) {
      const up = this.debugLogSkillMultipliers(test.shouldIncrease, [test.modifier]);
      const down = this.debugLogSkillMultipliers(test.shouldNotIncrease, [test.modifier]);
      console.log("[SkillTagDebug]", test.label, {
        increases: {
          skillId: test.shouldIncrease,
          damageDelta: +(up.after.damageMult - up.before.damageMult).toFixed(4),
          cooldownDelta: +(up.after.cooldownMult - up.before.cooldownMult).toFixed(4)
        },
        unchangedTarget: {
          skillId: test.shouldNotIncrease,
          damageDelta: +(down.after.damageMult - down.before.damageMult).toFixed(4),
          cooldownDelta: +(down.after.cooldownMult - down.before.cooldownMult).toFixed(4)
        }
      });
    }
  }

  grantSpirit(defId) {
    const spirit = grantAncestorSpiritById(this, defId);
    if (!spirit) {
      console.warn("[AncestorSpirit] Unknown spirit def:", defId);
      return null;
    }
    if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
    console.log("[AncestorSpirit] Granted spirit:", spirit);
    return spirit;
  }

  grantVesselCube() {
    grantAncestorVesselCube(this);
    if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
    console.log("[AncestorSpirit] Granted vesselCubeT1");
  }

  printActiveSpiritsAndClans() {
    recomputeAncestorState(this);
    return printAncestorSummary(this);
  }

  tryCastSkill(slot) {
    if (this.gameOver || this.paused || this.levelUpChoices) return;
    const skillId = this.skills[slot];
    if (!skillId) return;
    if (typeof this.runPillarEvent === "function") {
      const triggerEvent = this.runPillarEvent("onSkillTriggered", {
        slot,
        skillId,
        time: this.time
      });
      if (triggerEvent?.cancel) return;
      const beforeCast = this.runPillarEvent("beforeSkillCast", {
        slot,
        skillId,
        time: this.time
      });
      if (beforeCast?.cancel) return;
    }
    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (def && def.category === "aura") {
      if (this.activeAuras.has(skillId)) {
        this.activeAuras.delete(skillId);
      } else {
        this.activeAuras.add(skillId);
      }
      this.updateSkillUI();
      return;
    }
    if (this.skillCooldowns[slot] > 0) return;
    const mods = getModsForSkillSlot(this, slot);
    if (mods.includes("charged")) {
      this.skillChargeSlot = slot;
      this.skillChargeStartTime = this.time;
      return;
    }
    const consumeFocus = tryConsumeFocusCharge(this, slot);
    this.executeSkill(skillId, slot, { noCooldown: consumeFocus });
    
    // Track skill use for tutorial
    if (this.tutorialSystem) {
      this.tutorialSystem.onSkillUsed();
    }
  }

  tryReleaseChargedSkill(slot) {
    if (this.skillChargeSlot !== slot) return;
    const skillId = this.skills[slot];
    if (!skillId) {
      this.skillChargeSlot = null;
      return;
    }
    const chargeDuration = this.time - this.skillChargeStartTime;
    const chargeMult = 1 + Math.min(1, chargeDuration / 2);
    this.skillChargeSlot = null;
    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (this.skillCooldowns[slot] > 0) return;
    const consumeFocus = tryConsumeFocusCharge(this, slot);
    this.executeSkill(skillId, slot, { chargeMult, noCooldown: consumeFocus });
    if (def) {
      if (consumeFocus) return;
      const cdMult = this.getSkillCooldownMult(skillId);
      const mods = getModsForSkillSlot(this, slot);
      const baseCd = def.baseCd + (mods.includes("amplify") ? 0.5 : 0);
      this.skillCooldowns[slot] = baseCd * cdMult;
    }
  }

  executeSkill(skillId, slot, options = {}) {
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const beforeEffectsCount = this.skillEffects.length;
    let tx = this.lastMouseWorld.x;
    let ty = this.lastMouseWorld.y;
    const mods = getModsForSkillSlot(this, slot);
    const chargeMult = options.chargeMult ?? 1;
    const ringProcDamageMult = options.ringProcDamageMult ?? 1;
    const triggeredCast = !!(
      options.triggered ||
      options.onKill ||
      options.chainCast ||
      options.echo ||
      options.echoProc ||
      options.mirrorProc
    );
    const allowTriggeredProcs = options.allowTriggeredProcs === true;
    const canTriggerOtherSkills = allowTriggeredProcs || !triggeredCast;
    const skillMults = this.getSkillMultipliersFor(skillId);
    const effectPowerMult = skillMults.effectPowerMult || 1;
    const attackSpeedMult = skillMults.attackSpeedMult || 1;

    let sacrificeMult = 1;
    if (mods.includes("sacrifice")) {
      const cost = Math.max(1, Math.round(this.currentStats.maxHealth * 0.03 * getModEffectMult(this)));
      if (this.currentHealth > cost) {
        this.currentHealth -= cost;
        this.updateHealthBar();
        sacrificeMult = 1 + 0.5 * getModEffectMult(this);
      }
    }
    if (mods.includes("adrenaline")) {
      this.playerHasteUntil = this.time + 2;
      this.playerHasteMult = 1 + 0.2 * getModEffectMult(this);
    }
    if (mods.includes("empower")) {
      this.empowerStacks[slot] = Math.min(10, (this.empowerStacks[slot] || 0) + 1);
    }

    if (options.onKill) {
      const nearest = this.getNearestEnemy(px, py, 800);
      if (nearest) {
        tx = nearest.position.x + nearest.size / 2;
        ty = nearest.position.y + nearest.size / 2;
      }
    }

    const pushFireball = (dirX, dirY, mult, modList) => {
      const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const speed = 180;
      const eff = {
        type: "fireball",
        x: px, y: py, vx: (dirX / dist) * speed, vy: (dirY / dist) * speed,
        mult: mult * chargeMult, radius: 60, t: 0, mods: modList || mods,
        maxRange: 360, distanceTraveled: 0,
        slot, modList: modList || mods, sacrificeMult, skillId, skillMults
      };
      if (modList && modList.includes("orbiting")) {
        eff.phase = "orbit";
        eff.orbitT = 0;
        eff.orbitDuration = 3;
        eff.px0 = px;
        eff.py0 = py;
      }
      eff.bouncesLeft = (modList && modList.includes("bouncing")) ? 3 : 0;
      this.skillEffects.push(eff);
    };

    const pushIceShard = (dirX, dirY, mult, modList) => {
      const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const speed = 400;
      const eff = {
        type: "iceShard",
        x: px, y: py, vx: (dirX / dist) * speed, vy: (dirY / dist) * speed,
        mult: mult * chargeMult, pierces: 5, t: 0, mods: modList || mods,
        maxRange: 600, distanceTraveled: 0,
        slot, modList: modList || mods, sacrificeMult, skillId, skillMults
      };
      if (modList && modList.includes("orbiting")) {
        eff.phase = "orbit";
        eff.orbitT = 0;
        eff.orbitDuration = 3;
        eff.px0 = px;
        eff.py0 = py;
      }
      eff.bouncesLeft = (modList && modList.includes("bouncing")) ? 3 : 0;
      this.skillEffects.push(eff);
    };

    if (skillId === "fireball") {
      playSfx("fireball");
      this.damageSkillsUsedThisRun.add("fireball");
      const dx = tx - px;
      const dy = ty - py;
      const baseMult = 1.5;
      if (mods.includes("volley")) {
        const spread = (30 * Math.PI) / 180;
        for (let i = -1; i <= 1; i++) {
          const angle = Math.atan2(dy, dx) + i * (spread / 2);
          pushFireball(Math.cos(angle), Math.sin(angle), baseMult * 0.7, mods);
        }
      } else {
        pushFireball(dx, dy, baseMult, mods);
      }
    } else if (skillId === "iceShard") {
      playSfx("iceHard");
      this.damageSkillsUsedThisRun.add("iceShard");
      const dx = tx - px;
      const dy = ty - py;
      const baseMult = 0.8;
      if (mods.includes("volley")) {
        const spread = (30 * Math.PI) / 180;
        for (let i = -1; i <= 1; i++) {
          const angle = Math.atan2(dy, dx) + i * (spread / 2);
          pushIceShard(Math.cos(angle), Math.sin(angle), baseMult * 0.7, mods);
        }
      } else {
        pushIceShard(dx, dy, baseMult, mods);
      }
    } else if (skillId === "lightningBolt") {
      this.damageSkillsUsedThisRun.add("lightningBolt");
      const target = this.getNearestEnemy(px, py, 400);
      if (target) {
        const tx1 = target.position.x + target.size / 2;
        const ty1 = target.position.y + target.size / 2;
        let dmg = this.computeSkillDamage(target, 1, slot, { sacrificeMult, skillId, skillMults, ringProcDamageMult });
        this.dealDamageToEnemy(target, dmg, { isSkill: true, skillSlot: slot, modList: mods, triggeredCast, allowTriggeredProcs });
        const chain = this.getNearestEnemy(tx1, ty1, 120, target);
        let chainPos = null;
        if (chain) {
          chainPos = { x: chain.position.x + chain.size / 2, y: chain.position.y + chain.size / 2 };
          this.dealDamageToEnemy(chain, Math.round(dmg * 0.5), { isSkill: true, skillSlot: slot, modList: mods, triggeredCast, allowTriggeredProcs });
        }
        this.skillEffects.push({
          type: "lightningBolt",
          fromX: px, fromY: py, toX: tx1, toY: ty1, chain: chainPos,
          t: 0, duration: 0.2
        });
      }
    } else if (skillId === "healPulse") {
      const heal = Math.max(15, Math.round(this.currentStats.maxHealth * 0.15 * effectPowerMult));
      this.currentHealth = Math.min(this.currentStats.maxHealth, this.currentHealth + heal);
      const hpx = this.player.position.x + this.player.size / 2;
      const hpy = this.player.position.y + this.player.size / 2;
      this.addFloatingText(hpx, hpy, `+${heal}`, "heal");
      this.updateHealthBar();
    } else if (skillId === "shieldBash") {
      this.damageSkillsUsedThisRun.add("shieldBash");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "shieldBash",
        x: px, y: py, dirX: dx / dist, dirY: dy / dist, t: 0, duration: 0.15,
        mult: 0.5, stun: 0.5 * effectPowerMult, knockback: 120 * effectPowerMult,
        slot, modList: mods, sacrificeMult, skillId, skillMults
      });
    } else if (skillId === "rapidFire") {
      this.damageSkillsUsedThisRun.add("rapidFire");
      this.skillEffects.push({
        type: "rapidFire",
        t: 0,
        duration: 3,
        shotsPerSecond: 3 * attackSpeedMult,
        slot,
        modList: mods,
        sacrificeMult,
        skillId,
        skillMults
      });
    } else if (skillId === "iceRain") {
      playSfx("iceHard");
      this.damageSkillsUsedThisRun.add("iceRain");
      this.skillEffects.push({
        type: "iceRain",
        x: px,
        y: py,
        t: 0,
        duration: 4,
        radius: 180,
        tickRate: 4 * attackSpeedMult,
        slot,
        modList: mods,
        sacrificeMult,
        skillId,
        skillMults
      });
    } else if (skillId === "lightningSpear") {
      this.damageSkillsUsedThisRun.add("lightningSpear");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.skillEffects.push({
        type: "lightningSpear",
        x: px, y: py, vx: (dx / dist) * 600, vy: (dy / dist) * 600,
        mult: 1.2, t: 0, chargeTime: 0.5, stun: 1 * effectPowerMult,
        slot, modList: mods, sacrificeMult, skillId, skillMults
      });
    } else if (skillId === "meteor") {
      this.damageSkillsUsedThisRun.add("meteor");
      this.skillEffects.push({
        type: "meteor",
        targetX: tx, targetY: ty, t: 0, delay: 1, mult: 2.5, radius: 100, burnDuration: 5,
        slot, modList: mods, sacrificeMult, skillId, skillMults
      });
    } else if (skillId === "voidRift") {
      this.damageSkillsUsedThisRun.add("voidRift");
      this.skillEffects.push({
        type: "voidRift",
        x: px, y: py, t: 0, duration: 3, radius: 150, mult: 1.5,
        slot, modList: mods, sacrificeMult, skillId, skillMults
      });
    } else if (skillId === "phoenixStrike") {
      this.damageSkillsUsedThisRun.add("phoenixStrike");
      this.skillEffects.push({
        type: "phoenixStrike",
        x: px, y: py, t: 0, duration: 0.1, radius: 120, mult: 2, invulnDuration: 3,
        slot, modList: mods, sacrificeMult, skillId, skillMults
      });
    } else if (skillId === "chainFrost") {
      this.damageSkillsUsedThisRun.add("chainFrost");
      this.skillEffects.push({ type: "chainFrost", t: 0, freezeDuration: 2 * effectPowerMult, skillId, skillMults });
    } else if (skillId === "stormCall") {
      this.damageSkillsUsedThisRun.add("stormCall");
      this.skillEffects.push({
        type: "stormCall",
        t: 0,
        duration: 6,
        mult: 0.6,
        strikeInterval: Math.max(0.1, 0.5 / attackSpeedMult),
        slot,
        modList: mods,
        sacrificeMult,
        skillId,
        skillMults
      });
    } else if (skillId === "timeWarp") {
      this.timeWarpUntil = this.time + 4;
      this.skillEffects.push({ type: "timeWarp", t: 0, duration: 4 });
    } else if (skillId === "bladeDash") {
      this.damageSkillsUsedThisRun.add("bladeDash");
      const dx = tx - px; const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.bladeDashActive = true;
      this.bladeDashTimer = 0.25;
      this.bladeDashHitIds.clear();
      this.bladeDashHitBreakableIds = new Set();
      this.bladeDashDirection.set(dx / dist, dy / dist);
      this.bladeDashSpeed = 600;
      this.bladeDashMult = 0.8;
      this.bladeDashSlot = slot;
      this.bladeDashSacrificeMult = sacrificeMult;
      this.bladeDashTriggeredCast = triggeredCast;
      this.bladeDashAllowTriggeredProcs = allowTriggeredProcs;
      this.skillEffects.push({
        type: "bladeDash",
        x: px, y: py, dirX: dx / dist, dirY: dy / dist, t: 0, duration: 0.25,
        mult: 0.8, speed: 600,
        slot, modList: mods, sacrificeMult, skillId, skillMults
      });
    } else if (skillId === "whirlwind") {
      this.damageSkillsUsedThisRun.add("whirlwind");
      this.whirlwindActive = true;
      this.skillEffects.push({
        type: "whirlwind",
        t: 0,
        duration: 2,
        mult: 0.4,
        radius: 80,
        hitInterval: Math.max(0.05, 0.15 / attackSpeedMult),
        slot,
        modList: mods,
        sacrificeMult,
        skillId,
        skillMults
      });
    } else if (skillId === "groundSlam") {
      this.damageSkillsUsedThisRun.add("groundSlam");
      this.skillEffects.push({
        type: "groundSlam",
        x: px, y: py, t: 0, duration: 0.2, mult: 1, radius: 120, knockback: 150 * effectPowerMult,
        slot, modList: mods, sacrificeMult, skillId, skillMults
      });
    } else if (skillId === "bladeStorm") {
      this.damageSkillsUsedThisRun.add("bladeStorm");
      this.skillEffects.push({ type: "bladeStorm", x: px, y: py, t: 0, duration: 3, mult: 0.5, bladeCount: 8, slot, modList: mods, sacrificeMult, skillId, skillMults });
    } else if (skillId === "earthquake") {
      this.damageSkillsUsedThisRun.add("earthquake");
      this.skillEffects.push({
        type: "earthquake",
        t: 0,
        duration: 3,
        mult: 0.3,
        slowMult: 0.6,
        slowDuration: 3 * effectPowerMult,
        tickRate: 4 * attackSpeedMult,
        slot,
        modList: mods,
        sacrificeMult,
        skillId,
        skillMults
      });
    }

    for (let i = beforeEffectsCount; i < this.skillEffects.length; i++) {
      if (this.skillEffects[i] && this.skillEffects[i].ringProcDamageMult == null) {
        this.skillEffects[i].ringProcDamageMult = ringProcDamageMult;
      }
      if (this.skillEffects[i] && this.skillEffects[i].triggeredCast == null) {
        this.skillEffects[i].triggeredCast = triggeredCast;
      }
      if (this.skillEffects[i] && this.skillEffects[i].allowTriggeredProcs == null) {
        this.skillEffects[i].allowTriggeredProcs = allowTriggeredProcs;
      }
    }

    const def = SKILL_DEFS.find((s) => s.id === skillId);
    if (!options.noCooldown && !options.chainCast && def) {
      const cdMult = this.getSkillCooldownMult(skillId);
      const baseCd = def.baseCd + (mods.includes("amplify") ? 0.5 : 0);
      this.skillCooldowns[slot] = baseCd * cdMult;
    }
    handleAncestorOnSkillCast(this, slot, skillId);
    if (mods.includes("recoil")) {
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const push = 80;
      this.player.position.x -= (dx / dist) * push;
      this.player.position.y -= (dy / dist) * push;
    }
    if (canTriggerOtherSkills && mods.includes("chainCast") && !options.chainCast) {
      this.chainCastQueue.push({ t: this.time + 0.2, skillId, slot, allowTriggeredProcs });
    }
    if (canTriggerOtherSkills && mods.includes("echo") && Math.random() < 0.3) {
      this.executeSkill(skillId, slot, { noCooldown: true, echo: true, triggered: true, allowTriggeredProcs });
    }
    if (typeof this.runPillarEvent === "function") {
      this.runPillarEvent("onSkillCast", {
        slot,
        skillId,
        options,
        triggeredCast,
        time: this.time
      });
    }
  }

  getNearestEnemy(cx, cy, maxDist, exclude = null) {
    let best = null; let bestD = maxDist * maxDist;
    const es = this.enemySystem;
    const excludeSet = exclude && exclude instanceof Set ? exclude : null;
    const excludeSingle = exclude && !excludeSet ? exclude : null;
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      if (excludeSet && excludeSet.has(e.id)) continue;
      if (excludeSingle && e === excludeSingle) continue;
      const dx = e.position.x + e.size / 2 - cx; const dy = e.position.y + e.size / 2 - cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  updateSkillEffects(dt) {
    this.timeWarpUntil = this.timeWarpUntil || 0;
    const surviving = [];
    for (const eff of this.skillEffects) {
      eff.t += dt;
      if (eff.type === "fireball") {
        eff.mods = eff.mods || [];
        eff.maxRange = eff.maxRange ?? 360;
        eff.distanceTraveled = eff.distanceTraveled ?? 0;
        const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
        const w = this.world.width;
        const h = this.world.height;

        if (eff.phase === "orbit") {
          eff.orbitT = (eff.orbitT ?? 0) + dt;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const orbitRadius = 70;
          const angle = (eff.orbitT * 1.2) % (Math.PI * 2);
          eff.x = px + Math.cos(angle) * orbitRadius;
          eff.y = py + Math.sin(angle) * orbitRadius;
          if (eff.orbitT >= (eff.orbitDuration ?? 3)) {
            eff.phase = "seek";
            const target = this.getNearestEnemy(eff.x, eff.y, 600);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 180;
              eff.vx = (dx / dist) * speed;
              eff.vy = (dy / dist) * speed;
            }
          }
        } else {
          if (eff.returning) {
            const px = this.player.position.x + this.player.size / 2;
            const py = this.player.position.y + this.player.size / 2;
            const dx = px - eff.x;
            const dy = py - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = 180;
            eff.vx = (dx / dist) * speed;
            eff.vy = (dy / dist) * speed;
          }
          eff.x += eff.vx * dt;
          eff.y += eff.vy * dt;
          const moveLen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) * dt;
          eff.distanceTraveled += moveLen;
          
          // Check ice block collision
          if (this.obstacles) {
            for (const obstacle of this.obstacles) {
              if (obstacle.destroyed || obstacle.type !== "iceBlock") continue;
              const dist = Math.sqrt((eff.x - (obstacle.position.x + obstacle.size.w / 2)) ** 2 + 
                                     (eff.y - (obstacle.position.y + obstacle.size.h / 2)) ** 2);
              if (dist < 30) {
                obstacle.destroyed = true;
                break;
              }
            }
          }

          if (eff.mods.includes("homing") && eff.distanceTraveled >= 0.2 * eff.maxRange) {
            const excludeHit = (eff.hitIds && eff.hitIds.size > 0) ? eff.hitIds : null;
            const target = this.getNearestEnemy(eff.x, eff.y, 500, excludeHit);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 180;
              eff.vx = (dx / dist) * speed * 0.15 + eff.vx * 0.85;
              eff.vy = (dy / dist) * speed * 0.15 + eff.vy * 0.85;
              const vlen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) || 1;
              eff.vx = (eff.vx / vlen) * speed;
              eff.vy = (eff.vy / vlen) * speed;
            }
          }

          if (eff.mods.includes("boomerang") && !eff.returning && eff.distanceTraveled >= eff.maxRange) {
            eff.returning = true;
            eff.hitIds = eff.hitIds || new Set();
            eff.hitIds.clear();
            eff.vx = -eff.vx;
            eff.vy = -eff.vy;
          }

          if (eff.bouncesLeft != null && eff.bouncesLeft > 0) {
            if (eff.x < margin) {
              eff.x = margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.x > w - margin) {
              eff.x = w - margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.y < margin) {
              eff.y = margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.y > h - margin) {
              eff.y = h - margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.bouncesLeft <= 0 && eff.mods.includes("bouncing")) {
              continue;
            }
          }

          if (eff.mods.includes("rebound") && !eff.rebounded) {
            const hitWall = eff.x <= margin || eff.x >= w - margin || eff.y <= margin || eff.y >= h - margin;
            if (hitWall) {
              eff.rebounded = true;
              const target = this.getNearestEnemy(eff.x, eff.y, 500);
              if (target) {
                const tx = target.position.x + target.size / 2;
                const ty = target.position.y + target.size / 2;
                const dx = tx - eff.x;
                const dy = ty - eff.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const speed = 180;
                eff.vx = (dx / dist) * speed;
                eff.vy = (dy / dist) * speed;
              }
            }
          }
        }

        eff.hitIds = eff.hitIds || new Set();
        const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
        for (const e of hit) {
          if (!eff.hitIds.has(e.id)) {
            eff.hitIds.add(e.id);
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
          }
        }
        if (hit.length > 0 && !eff.mods.includes("piercing")) {
          if (this.hazardSystem) {
            const burnDmg = Math.round(this.currentStats.attack * 0.2);
            this.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
          }
          continue;
        }
        if (eff.t > 2 && !eff.mods.includes("boomerang")) {
          if (this.hazardSystem) {
            const burnDmg = Math.round(this.currentStats.attack * 0.2);
            this.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
          }
          continue;
        }
        if (eff.returning) {
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const d = (eff.x - px) * (eff.x - px) + (eff.y - py) * (eff.y - py);
          if (d < 900) {
            if (this.hazardSystem) {
              const burnDmg = Math.round(this.currentStats.attack * 0.2);
              this.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
            }
            continue;
          }
        }
        surviving.push(eff);
      } else if (eff.type === "iceShard") {
        eff.mods = eff.mods || [];
        eff.maxRange = eff.maxRange ?? 600;
        eff.distanceTraveled = eff.distanceTraveled ?? 0;
        const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
        const w = this.world.width;
        const h = this.world.height;

        if (eff.phase === "orbit") {
          eff.orbitT = (eff.orbitT ?? 0) + dt;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const orbitRadius = 70;
          const angle = (eff.orbitT * 1.2) % (Math.PI * 2);
          eff.x = px + Math.cos(angle) * orbitRadius;
          eff.y = py + Math.sin(angle) * orbitRadius;
          if (eff.orbitT >= (eff.orbitDuration ?? 3)) {
            eff.phase = "seek";
            const target = this.getNearestEnemy(eff.x, eff.y, 600);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 400;
              eff.vx = (dx / dist) * speed;
              eff.vy = (dy / dist) * speed;
            }
          }
        } else {
          if (eff.returning) {
            const px = this.player.position.x + this.player.size / 2;
            const py = this.player.position.y + this.player.size / 2;
            const dx = px - eff.x;
            const dy = py - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = 400;
            eff.vx = (dx / dist) * speed;
            eff.vy = (dy / dist) * speed;
          }
          eff.x += eff.vx * dt;
          eff.y += eff.vy * dt;
          eff.distanceTraveled += Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) * dt;

          if (eff.mods.includes("homing") && eff.distanceTraveled >= 0.2 * eff.maxRange) {
            const excludeHit = (eff.hitIds && eff.hitIds.size > 0) ? eff.hitIds : null;
            const target = this.getNearestEnemy(eff.x, eff.y, 500, excludeHit);
            if (target) {
              const tx = target.position.x + target.size / 2;
              const ty = target.position.y + target.size / 2;
              const dx = tx - eff.x;
              const dy = ty - eff.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const speed = 400;
              eff.vx = (dx / dist) * speed * 0.15 + eff.vx * 0.85;
              eff.vy = (dy / dist) * speed * 0.15 + eff.vy * 0.85;
              const vlen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) || 1;
              eff.vx = (eff.vx / vlen) * speed;
              eff.vy = (eff.vy / vlen) * speed;
            }
          }

          if (eff.mods.includes("boomerang") && !eff.returning && eff.distanceTraveled >= eff.maxRange) {
            eff.returning = true;
            eff.hitIds = eff.hitIds || new Set();
            eff.hitIds.clear();
            eff.vx = -eff.vx;
            eff.vy = -eff.vy;
          }

          if (eff.bouncesLeft != null && eff.bouncesLeft > 0) {
            if (eff.x < margin) {
              eff.x = margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.x > w - margin) {
              eff.x = w - margin;
              eff.vx = -eff.vx;
              eff.bouncesLeft--;
            }
            if (eff.y < margin) {
              eff.y = margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.y > h - margin) {
              eff.y = h - margin;
              eff.vy = -eff.vy;
              eff.bouncesLeft--;
            }
            if (eff.bouncesLeft <= 0 && eff.mods.includes("bouncing")) {
              continue;
            }
          }

          if (eff.mods.includes("rebound") && !eff.rebounded) {
            const hitWall = eff.x <= margin || eff.x >= w - margin || eff.y <= margin || eff.y >= h - margin;
            if (hitWall) {
              eff.rebounded = true;
              const target = this.getNearestEnemy(eff.x, eff.y, 500);
              if (target) {
                const tx = target.position.x + target.size / 2;
                const ty = target.position.y + target.size / 2;
                const dx = tx - eff.x;
                const dy = ty - eff.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const speed = 400;
                eff.vx = (dx / dist) * speed;
                eff.vy = (dy / dist) * speed;
              }
            }
          }
        }

        eff.hitIds = eff.hitIds || new Set();
        const hit = this.enemiesInRadius(eff.x, eff.y, 20);
        for (const e of hit) {
          if (!eff.hitIds.has(e.id)) {
            eff.hitIds.add(e.id);
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            e.slowUntil = this.time + 2;
            e.slowMult = 0.7;
            mirrorAncestorDebuffToPlayer(this, "slow");
            this.iceShardHitsThisRun++;
            if (this.iceShardHitsThisRun >= 5) setSkillUnlock("iceShard5", true);
          }
        }
        if (eff.t > 1.5 && !eff.mods.includes("boomerang") && !eff.returning) continue;
        if (eff.returning) {
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const d = (eff.x - px) * (eff.x - px) + (eff.y - py) * (eff.y - py);
          if (d < 900) continue;
        }
        surviving.push(eff);
      } else if (eff.type === "shieldBash") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInCone(eff.x, eff.y, eff.dirX, eff.dirY, 120, 80);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            e.stunUntil = this.time + eff.stun;
            mirrorAncestorDebuffToPlayer(this, "stun");
            const dx = e.position.x + e.size / 2 - eff.x; const dy = e.position.y + e.size / 2 - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            e.position.x += (dx / dist) * eff.knockback;
            e.position.y += (dy / dist) * eff.knockback;
          }
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "lightningBolt") {
        if (eff.t >= eff.duration) continue;
        surviving.push(eff);
      } else if (eff.type === "rapidFire") {
        if (eff.t >= eff.duration) continue;
        const shotsPerSecond = eff.shotsPerSecond || 3;
        if (Math.floor(eff.t * shotsPerSecond) > Math.floor((eff.t - dt) * shotsPerSecond)) {
          const target = this.getNearestEnemy(this.player.position.x + this.player.size / 2, this.player.position.y + this.player.size / 2, 500);
          if (target) {
            const dmg = this.computeSkillDamage(target, 1, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult });
            this.dealDamageToEnemy(target, dmg, { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            eff.lastTargetX = target.position.x + target.size / 2;
            eff.lastTargetY = target.position.y + target.size / 2;
            eff.lastShotTime = eff.t;
          }
        }
        surviving.push(eff);
      } else if (eff.type === "timeWarp") {
        if (eff.t >= eff.duration) continue;
        this.timeWarpUntil = this.time + 0.1;
        surviving.push(eff);
      } else if (eff.type === "iceRain") {
        if (eff.t >= eff.duration) continue;
        const tickRate = eff.tickRate || 4;
        if (Math.floor(eff.t * tickRate) > Math.floor((eff.t - dt) * tickRate)) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, 0.4, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            e.slowUntil = this.time + 0.5; e.slowMult = 0.5;
            mirrorAncestorDebuffToPlayer(this, "slow");
          }
        }
        surviving.push(eff);
      } else if (eff.type === "lightningSpear") {
        if (eff.t < eff.chargeTime) { surviving.push(eff); continue; }
        eff.x += eff.vx * dt; eff.y += eff.vy * dt;
        const hit = this.enemiesInRadius(eff.x, eff.y, 25);
        for (const e of hit) {
          if (!(eff.hitIds || (eff.hitIds = new Set())).has(e.id)) {
            eff.hitIds.add(e.id);
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            e.stunUntil = this.time + eff.stun;
            mirrorAncestorDebuffToPlayer(this, "stun");
          }
        }
        if (eff.t > 1.5) continue;
        surviving.push(eff);
      } else if (eff.type === "meteor") {
        if (eff.t < eff.delay) { surviving.push(eff); continue; }
        if (eff.t - dt < eff.delay) {
          const hit = this.enemiesInRadius(eff.targetX, eff.targetY, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
          if (this.hazardSystem) {
            const burnDmg = Math.round(this.currentStats.attack * 0.25);
            this.hazardSystem.addTemporaryPatch("burningGround", eff.targetX, eff.targetY, 90, eff.burnDuration, burnDmg, true);
          }
        }
        if (eff.t >= eff.delay + 0.5) continue;
        surviving.push(eff);
      } else if (eff.type === "voidRift") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
          continue;
        }
        const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius * 1.5);
        for (const e of hit) {
          const ex = e.position.x + e.size / 2; const ey = e.position.y + e.size / 2;
          const dx = eff.x - ex; const dy = eff.y - ey;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const pull = 80 * dt;
          e.position.x += (dx / dist) * pull;
          e.position.y += (dy / dist) * pull;
        }
        surviving.push(eff);
      } else if (eff.type === "phoenixStrike") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
          this.phoenixInvulnUntil = this.time + eff.invulnDuration;
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "chainFrost") {
        if (eff.t >= 0.1) {
          const es = this.enemySystem;
          for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
            if (!e.isDead) {
              e.stunUntil = this.time + eff.freezeDuration;
              mirrorAncestorDebuffToPlayer(this, "freeze");
            }
          }
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "stormCall") {
        if (eff.t >= eff.duration) continue;
        eff.lastStrike = eff.lastStrike || 0;
        if (eff.t - eff.lastStrike >= eff.strikeInterval) {
          eff.lastStrike = eff.t;
          const es = this.enemySystem;
          const all = [...es.enemies, ...(es.boss ? [es.boss] : [])].filter((e) => !e.isDead);
          if (all.length > 0) {
            const target = all[Math.floor(Math.random() * all.length)];
            this.dealDamageToEnemy(target, this.computeSkillDamage(target, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
          }
        }
        surviving.push(eff);
      } else if (eff.type === "bladeDash") {
        if (eff.t >= eff.duration) continue;
        surviving.push(eff);
      } else if (eff.type === "whirlwind") {
        if (eff.t >= eff.duration) {
          this.whirlwindActive = false;
          continue;
        }
        eff.lastHit = eff.lastHit || 0;
        if (eff.t - eff.lastHit >= eff.hitInterval) {
          eff.lastHit = eff.t;
          const px = this.player.position.x + this.player.size / 2;
          const py = this.player.position.y + this.player.size / 2;
          const hit = this.enemiesInRadius(px, py, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
        }
        surviving.push(eff);
      } else if (eff.type === "groundSlam") {
        if (eff.t >= eff.duration) {
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            const dx = e.position.x + e.size / 2 - eff.x;
            const dy = e.position.y + e.size / 2 - eff.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            e.position.x += (dx / dist) * eff.knockback;
            e.position.y += (dy / dist) * eff.knockback;
          }
          continue;
        }
        surviving.push(eff);
      } else if (eff.type === "bladeStorm") {
        if (eff.t >= eff.duration) continue;
        if (!eff.blades) {
          eff.blades = [];
          for (let i = 0; i < eff.bladeCount; i++) {
            const angle = (i / eff.bladeCount) * Math.PI * 2;
            eff.blades.push({ x: eff.x, y: eff.y, vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200, hitIds: new Set() });
          }
        }
        const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
        const w = this.world.width - margin * 2;
        const h = this.world.height - margin * 2;
        for (const b of eff.blades) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < margin || b.x > this.world.width - margin) b.vx *= -1;
          if (b.y < margin || b.y > this.world.height - margin) b.vy *= -1;
          b.x = Math.max(margin, Math.min(b.x, this.world.width - margin));
          b.y = Math.max(margin, Math.min(b.y, this.world.height - margin));
          const hit = this.enemiesInRadius(b.x, b.y, 25);
          for (const e of hit) {
            if (!b.hitIds.has(e.id)) {
              b.hitIds.add(e.id);
              this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            }
          }
        }
        surviving.push(eff);
      } else if (eff.type === "legendaryBeam") {
        if (eff.t >= eff.duration) continue;
        surviving.push(eff);
      } else if (eff.type === "earthquake") {
        if (eff.t >= eff.duration) continue;
        this.earthquakeShakeUntil = this.time + 0.1;
        const tickRate = eff.tickRate || 4;
        if (Math.floor(eff.t * tickRate) > Math.floor((eff.t - dt) * tickRate)) {
          const es = this.enemySystem;
          const all = [...es.enemies, ...(es.boss ? [es.boss] : [])].filter((e) => !e.isDead);
          for (const e of all) {
            this.dealDamageToEnemy(e, this.computeSkillDamage(e, eff.mult, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults, ringProcDamageMult: eff.ringProcDamageMult }), { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: !!eff.triggeredCast, allowTriggeredProcs: eff.allowTriggeredProcs === true });
            e.slowUntil = this.time + eff.slowDuration;
            e.slowMult = eff.slowMult;
            mirrorAncestorDebuffToPlayer(this, "slow");
          }
        }
        surviving.push(eff);
      } else if (eff.type === "pulseStrike") {
        if (eff.t >= eff.delay && !eff.done) {
          eff.done = true;
          const hit = this.enemiesInRadius(eff.x, eff.y, eff.radius);
          for (const e of hit) this.dealDamageToEnemy(e, eff.damage);
          const breakHit = this.breakablesInRadius(eff.x, eff.y, eff.radius);
          for (const b of breakHit) this.dealDamageToBreakable(b, eff.damage);
          this.skillEffects.push({ type: "pulseDetonation", x: eff.x, y: eff.y, radius: eff.radius, t: 0, duration: 0.25 });
        }
        if (eff.t >= (eff.duration || 0.6)) continue;
        surviving.push(eff);
      } else if (["attackFanArc", "attackThrustLunge", "dashStrikeSurge", "dashStrikeFan", "backfireTrail", "pulseDetonation"].includes(eff.type)) {
        if (eff.t >= (eff.duration || 0.25)) continue;
        surviving.push(eff);
      }
    }
    this.skillEffects = surviving;
  }

  resolveSquareOverlap(a, b) {
    const ax1 = a.position.x, ay1 = a.position.y, asz = a.size;
    const bx1 = b.position.x, by1 = b.position.y, bsz = b.size;
    const ax2 = ax1 + asz, ay2 = ay1 + asz;
    const bx2 = bx1 + bsz, by2 = by1 + bsz;
    const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
    const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
    if (overlapX <= 0 || overlapY <= 0) return;
    const aRooted = a.affixes && a.affixes.includes("rooted");
    const bRooted = b.affixes && b.affixes.includes("rooted");
    const pushA = bRooted ? 1 : (aRooted ? 0 : 0.5);
    const pushB = aRooted ? 1 : (bRooted ? 0 : 0.5);
    const pushX = overlapX * 0.5;
    const pushY = overlapY * 0.5;
    const acx = ax1 + asz / 2, acy = ay1 + asz / 2;
    const bcx = bx1 + bsz / 2, bcy = by1 + bsz / 2;
    
    // Store original positions
    const aOrigX = a.position.x;
    const aOrigY = a.position.y;
    const bOrigX = b.position.x;
    const bOrigY = b.position.y;
    
    // Helper function to check if position would collide with obstacles/walls
    const wouldCollide = (x, y, size) => {
      const testRect = { x, y, w: size, h: size };
      
      // Check obstacles
      for (const obstacle of this.obstacles || []) {
        if (obstacle.destroyed || !obstacle.blocksMovement) continue;
        if (obstacleIntersectsRect(obstacle, testRect)) {
          return true;
        }
      }
      
      // Check sub-area walls + procedural tile walls
      const walls = this.world.tileWallRects || [];
      for (const wall of walls) {
        const wallRect = getWallCollisionRect(wall);
        if (testRect.x < wallRect.x + wallRect.w && testRect.x + testRect.w > wallRect.x &&
            testRect.y < wallRect.y + wallRect.h && testRect.y + testRect.h > wallRect.y) {
          return true;
        }
      }

      return false;
    };

    if (overlapX < overlapY) {
      if (acx < bcx) {
        // Push A left, B right
        if (pushA > 0) {
          const newAX = aOrigX - pushX * (pushA * 2);
          if (!wouldCollide(newAX, aOrigY, asz)) {
            a.position.x = newAX;
          }
        }
        if (pushB > 0) {
          const newBX = bOrigX + pushX * (pushB * 2);
          if (!wouldCollide(newBX, bOrigY, bsz)) {
            b.position.x = newBX;
          }
        }
      } else {
        // Push A right, B left
        if (pushA > 0) {
          const newAX = aOrigX + pushX * (pushA * 2);
          if (!wouldCollide(newAX, aOrigY, asz)) {
            a.position.x = newAX;
          }
        }
        if (pushB > 0) {
          const newBX = bOrigX - pushX * (pushB * 2);
          if (!wouldCollide(newBX, bOrigY, bsz)) {
            b.position.x = newBX;
          }
        }
      }
    } else {
      if (acy < bcy) {
        // Push A up, B down
        if (pushA > 0) {
          const newAY = aOrigY - pushY * (pushA * 2);
          if (!wouldCollide(aOrigX, newAY, asz)) {
            a.position.y = newAY;
          }
        }
        if (pushB > 0) {
          const newBY = bOrigY + pushY * (pushB * 2);
          if (!wouldCollide(bOrigX, newBY, bsz)) {
            b.position.y = newBY;
          }
        }
      } else {
        // Push A down, B up
        if (pushA > 0) {
          const newAY = aOrigY + pushY * (pushA * 2);
          if (!wouldCollide(aOrigX, newAY, asz)) {
            a.position.y = newAY;
          }
        }
        if (pushB > 0) {
          const newBY = bOrigY - pushY * (pushB * 2);
          if (!wouldCollide(bOrigX, newBY, bsz)) {
            b.position.y = newBY;
          }
        }
      }
    }
  }

  resolveCollisions() {
    const player = this.player;
    const es = this.enemySystem;
    const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
    const maxX = this.world.width - margin - player.size;
    const maxY = this.world.height - margin - player.size;

    const allEnemies = [...es.enemies, ...(es.boss ? [es.boss] : [])].filter((e) => !e.isDead);
    const skipPlayerCollision = this.bladeDashActive;
    for (let iter = 0; iter < 2; iter++) {
      if (!skipPlayerCollision) {
        for (const enemy of allEnemies) {
          if (enemy.intersects(player)) this.resolveCircleOverlap(player, enemy);
        }
      }
      for (let i = 0; i < allEnemies.length; i++) {
        for (let j = i + 1; j < allEnemies.length; j++) {
          if (allEnemies[i].intersects(allEnemies[j])) this.resolveCircleOverlap(allEnemies[i], allEnemies[j]);
        }
      }
    }
    player.position.x = Math.max(margin, Math.min(player.position.x, maxX));
    player.position.y = Math.max(margin, Math.min(player.position.y, maxY));
    for (const e of allEnemies) {
      const emaxX = this.world.width - margin - e.size;
      const emaxY = this.world.height - margin - e.size;
      e.position.x = Math.max(margin, Math.min(e.position.x, emaxX));
      e.position.y = Math.max(margin, Math.min(e.position.y, emaxY));
    }
  }

  enemiesInRadius(cx, cy, r) {
    const out = [];
    const es = this.enemySystem;
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      const ex = e.position.x + e.size / 2; const ey = e.position.y + e.size / 2;
      if ((ex - cx) ** 2 + (ey - cy) ** 2 <= r * r) out.push(e);
    }
    return out;
  }

  enemiesInCone(cx, cy, dirX, dirY, length, angle) {
    const out = [];
    const es = this.enemySystem;
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      const ex = e.position.x + e.size / 2 - cx; const ey = e.position.y + e.size / 2 - cy;
      const dist = Math.sqrt(ex * ex + ey * ey) || 1;
      if (dist > length) continue;
      const dot = (ex * dirX + ey * dirY) / dist;
      if (dot > Math.cos(angle * Math.PI / 180)) out.push(e);
    }
    return out;
  }

  getFirstEnemyInLine(px, py, dirX, dirY, maxDist, halfWidth = 8) {
    const all = this.getEnemiesInLine(px, py, dirX, dirY, maxDist, halfWidth);
    return all.length > 0 ? all[0] : null;
  }

  getEnemiesInLine(px, py, dirX, dirY, maxDist, halfWidth = 8) {
    const es = this.enemySystem;
    const candidates = [];
    for (const e of [...es.enemies, ...(es.boss ? [es.boss] : [])]) {
      if (e.isDead) continue;
      const ex = e.position.x + e.size / 2 - px;
      const ey = e.position.y + e.size / 2 - py;
      const t = ex * dirX + ey * dirY;
      if (t <= 0 || t > maxDist) continue;
      const perp = Math.abs(ex * dirY - ey * dirX);
      if (perp > halfWidth + e.size / 2) continue;
      candidates.push({ e, t });
    }
    candidates.sort((a, b) => a.t - b.t);
    return candidates.map((c) => c.e);
  }

  drawAuraEffects(ctx) {
    if (this.activeAuras.size === 0) return;
    const px = this.player.position.x + this.player.size / 2 - this.camera.position.x;
    const py = this.player.position.y + this.player.size / 2 - this.camera.position.y;
    const AURA_COLORS = {
      frostAura: "rgba(147, 197, 253, 0.4)",
      flameAura: "rgba(251, 146, 60, 0.5)",
      thunderAura: "rgba(253, 224, 71, 0.4)",
      barrierAura: "rgba(96, 165, 250, 0.35)",
      soulAura: "rgba(192, 132, 252, 0.5)"
    };
    const radius = 90 + Math.sin(this.time * 3) * 5;
    for (const auraId of this.activeAuras) {
      const color = AURA_COLORS[auraId] || "rgba(255,255,255,0.3)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawSkillEffects(ctx) {
    const ox = -this.camera.position.x;
    const oy = -this.camera.position.y;
    for (const eff of this.skillEffects) {
      if (eff.type === "fireball") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const r = 14 + 4 * Math.sin(this.time * 8);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, "#fff3a0"); g.addColorStop(0.5, "#f97316"); g.addColorStop(1, "#dc2626");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "iceShard") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.fillStyle = "rgba(147, 197, 253, 0.9)";
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "lightningBolt") {
        const drawBolt = (x0, y0, x1, y1) => {
          const sx0 = x0 + ox; const sy0 = y0 + oy;
          const sx1 = x1 + ox; const sy1 = y1 + oy;
          const dx = sx1 - sx0; const dy = sy1 - sy0;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          for (let i = 1; i < 10; i++) {
            const t = i / 10;
            const jitter = 6 * Math.sin(this.time * 50 + i * 3);
            ctx.lineTo(sx0 + dx * t + Math.cos(this.time * 60 + i) * jitter, sy0 + dy * t + Math.sin(this.time * 60 + i) * jitter);
          }
          ctx.lineTo(sx1, sy1);
          ctx.stroke();
        };
        ctx.strokeStyle = "rgba(253, 224, 71, 0.95)";
        ctx.lineWidth = 3;
        drawBolt(eff.fromX, eff.fromY, eff.toX, eff.toY);
        if (eff.chain) {
          ctx.strokeStyle = "rgba(253, 224, 71, 0.6)";
          ctx.lineWidth = 2;
          drawBolt(eff.toX, eff.toY, eff.chain.x, eff.chain.y);
        }
      } else if (eff.type === "rapidFire") {
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        const pulse = 0.3 + 0.2 * Math.sin(this.time * 12);
        ctx.strokeStyle = `rgba(253, 224, 71, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(this.player.position.x + ox - 4, this.player.position.y + oy - 4, this.player.size + 8, this.player.size + 8);
        if (eff.lastTargetX != null && eff.t - eff.lastShotTime < 0.15) {
          const sx0 = px + ox; const sy0 = py + oy;
          const sx1 = eff.lastTargetX + ox; const sy1 = eff.lastTargetY + oy;
          const fade = 1 - (eff.t - eff.lastShotTime) / 0.15;
          ctx.strokeStyle = `rgba(253, 224, 71, ${0.8 * fade})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(sx1, sy1);
          ctx.stroke();
        }
      } else if (eff.type === "shieldBash" && eff.t < eff.duration) {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.6 - eff.t / eff.duration * 0.4})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        const angle = Math.atan2(eff.dirY, eff.dirX);
        ctx.arc(sx, sy, 60, angle - 0.5, angle + 0.5);
        ctx.stroke();
      } else if (eff.type === "lightningSpear") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.strokeStyle = "rgba(253, 224, 71, 0.9)";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(sx - 12, sy); ctx.lineTo(sx + 12, sy);
        ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy + 12);
        ctx.stroke();
      } else if (eff.type === "meteor") {
        const sx = eff.targetX + ox; const sy = eff.targetY + oy;
        if (eff.t < eff.delay) {
          const pulse = 0.5 + 0.5 * (eff.t / eff.delay);
          ctx.fillStyle = `rgba(251, 146, 60, ${pulse * 0.5})`;
          ctx.beginPath(); ctx.arc(sx, sy, 40 + eff.t * 20, 0, Math.PI * 2); ctx.fill();
        } else {
          const flash = Math.max(0, 1 - (eff.t - eff.delay) / 0.5);
          ctx.fillStyle = `rgba(251, 146, 60, ${flash * 0.6})`;
          ctx.beginPath(); ctx.arc(sx, sy, eff.radius || 100, 0, Math.PI * 2); ctx.fill();
        }
      } else if (eff.type === "voidRift") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const pulse = 0.4 + 0.3 * Math.sin(this.time * 6);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, eff.radius);
        g.addColorStop(0, `rgba(139, 92, 246, ${pulse})`); g.addColorStop(1, "rgba(139, 92, 246, 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, eff.radius, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "phoenixStrike") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.fillStyle = "rgba(251, 146, 60, 0.6)";
        ctx.beginPath(); ctx.arc(sx, sy, eff.radius, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "iceRain") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        ctx.fillStyle = `rgba(147, 197, 253, ${0.2 + 0.15 * Math.sin(this.time * 4)})`;
        ctx.beginPath(); ctx.arc(sx, sy, eff.radius, 0, Math.PI * 2); ctx.fill();
      } else if (eff.type === "stormCall") {
        ctx.fillStyle = `rgba(253, 224, 71, ${0.1 * Math.sin(this.time * 10)})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      } else if (eff.type === "chainFrost" && eff.t < 0.1) {
        ctx.fillStyle = "rgba(147, 197, 253, 0.3)";
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      } else if (eff.type === "timeWarp") {
        ctx.fillStyle = `rgba(139, 92, 246, ${0.15 + 0.05 * Math.sin(this.time * 3)})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      } else if (eff.type === "bladeDash" && this.bladeDashActive) {
        const sx = this.player.position.x + this.player.size / 2 + ox;
        const sy = this.player.position.y + this.player.size / 2 + oy;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.8 - eff.t / eff.duration * 0.5})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - 20, sy - 20, 40, 40);
      } else if (eff.type === "whirlwind") {
        const sx = this.player.position.x + this.player.size / 2 + ox;
        const sy = this.player.position.y + this.player.size / 2 + oy;
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.5 + 0.2 * Math.sin(this.time * 15)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, eff.radius || 80, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eff.type === "groundSlam") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const expand = Math.min(1, eff.t / eff.duration) * (eff.radius || 120);
        ctx.strokeStyle = `rgba(120, 53, 15, ${0.7 - eff.t / eff.duration * 0.5})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sx, sy, expand, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eff.type === "barrelExplosion") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / eff.duration;
        const radius = eff.radius || 60;
        const expand = radius * (1 - alpha);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, expand);
        g.addColorStop(0, `rgba(251, 146, 60, ${0.9 * alpha})`);
        g.addColorStop(0.5, `rgba(239, 68, 68, ${0.6 * alpha})`);
        g.addColorStop(1, `rgba(220, 38, 38, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, expand, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.type === "obstacleImpact") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / eff.duration;
        ctx.fillStyle = `rgba(200, 200, 200, ${0.8 * alpha})`;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const dist = 8 * alpha;
          const px = sx + Math.cos(angle) * dist;
          const py = sy + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.arc(px, py, 3 * alpha, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (eff.type === "bladeStorm" && eff.blades) {
        for (const b of eff.blades) {
          const sx = b.x + ox; const sy = b.y + oy;
          ctx.fillStyle = `rgba(251, 191, 36, ${0.8})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (eff.type === "earthquake") {
        ctx.fillStyle = `rgba(120, 53, 15, ${0.1 * Math.sin(this.time * 20)})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      } else if (eff.type === "legendaryBeam") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const beamHeight = 200 + 50 * Math.sin(this.time * 8);
        const fade = 1 - eff.t / eff.duration;
        const grad = ctx.createLinearGradient(sx, sy, sx, sy - beamHeight);
        grad.addColorStop(0, `rgba(249, 115, 22, ${0.9 * fade})`);
        grad.addColorStop(0.3, `rgba(249, 115, 22, ${0.5 * fade})`);
        grad.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(sx - 15, sy - beamHeight, 30, beamHeight);
      } else if (eff.type === "attackFanArc") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.2);
        const range = eff.range || 65;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.9 * alpha})`;
        ctx.lineWidth = 5;
        const angle = Math.atan2(eff.dirY, eff.dirX);
        ctx.beginPath();
        ctx.arc(sx, sy, range, angle - (120 * Math.PI / 360), angle + (120 * Math.PI / 360));
        ctx.stroke();
      } else if (eff.type === "attackThrustLunge") {
        const sx0 = eff.x + ox; const sy0 = eff.y + oy;
        const sx1 = eff.hitX + ox; const sy1 = eff.hitY + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.15);
        ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx0, sy0);
        ctx.lineTo(sx1, sy1);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(sx1, sy1, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.type === "dashStrikeSurge") {
        const alpha = 1 - eff.t / (eff.duration || 0.25);
        ctx.fillStyle = `rgba(200, 200, 255, ${0.3 * alpha})`;
        const px = this.player.position.x + ox; const py = this.player.position.y + oy;
        ctx.fillRect(px - this.player.size, py - this.player.size, this.player.size * 2, this.player.size * 2);
      } else if (eff.type === "dashStrikeFan") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.12);
        const range = eff.range || 48;
        ctx.strokeStyle = `rgba(251, 191, 36, ${0.85 * alpha})`;
        ctx.lineWidth = 4;
        const angle = Math.atan2(eff.dirY, eff.dirX);
        ctx.beginPath();
        ctx.arc(sx, sy, range, angle - Math.PI / 4, angle + Math.PI / 4);
        ctx.stroke();
      } else if (eff.type === "backfireTrail") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const alpha = 1 - eff.t / (eff.duration || 0.2);
        ctx.strokeStyle = `rgba(248, 250, 252, ${0.6 * alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - eff.dirX * 40, sy - eff.dirY * 40);
        ctx.stroke();
      } else if (eff.type === "pulseStrike") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const progress = eff.delay ? Math.min(1, eff.t / eff.delay) : 1;
        const r = (eff.radius || 55) * (0.3 + 0.7 * progress);
        const alpha = 0.4 + 0.3 * Math.sin(this.time * 12);
        ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (eff.type === "pulseDetonation") {
        const sx = eff.x + ox; const sy = eff.y + oy;
        const r = (eff.radius || 55) * Math.min(1, eff.t / (eff.duration || 0.25));
        const alpha = 1 - eff.t / (eff.duration || 0.25);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, `rgba(147, 197, 253, ${0.7 * alpha})`);
        g.addColorStop(0.6, `rgba(96, 165, 250, ${0.4 * alpha})`);
        g.addColorStop(1, "rgba(96, 165, 250, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  updateSkillUI() {
    const keys = ["1", "2", "3", "4"];
    for (let i = 0; i < 4; i++) {
      const iconEl = document.getElementById(`skill-icon-${i}`);
      const nameEl = document.getElementById(`skill-name-${i}`);
      const cdEl = document.getElementById(`skill-cd-${i}`);
      const slotEl = document.querySelector(`.skill-slot[data-slot="${i}"]`);
      if (!slotEl) continue;
      const skillId = this.skills[i];
      const def = skillId ? SKILL_DEFS.find((s) => s.id === skillId) : null;
      // In tutorial mode, unlock all 4 skill slots
      const availableSlots = this.tutorialMode ? 4 : getAvailableSkillSlots();
      if (i >= availableSlots) {
        slotEl.classList.add("locked");
        if (iconEl) {
          iconEl.innerHTML = "";
          iconEl.textContent = "LOCK";
        }
        if (nameEl) nameEl.textContent = `Beat Diff ${SKILL_SLOT_UNLOCK[i + 1]}`;
      } else {
        slotEl.classList.remove("locked");
        if (iconEl) {
          iconEl.innerHTML = "";
          if (def?.illustration) {
            const img = document.createElement("img");
            img.className = "skill-slot-icon-img";
            img.src = def.illustration;
            img.alt = `${def.name} icon`;
            iconEl.appendChild(img);
          } else {
            iconEl.textContent = "";
          }
        }
        let nameText = def ? def.name : "Empty";
        if (def && def.category === "aura" && this.activeAuras.has(skillId)) {
          nameText += ` (ON)`;
          if (def.auraUpkeep) nameText += ` -${(def.auraUpkeep * 100).toFixed(1)}% HP/s`;
        }
        if (nameEl) nameEl.textContent = nameText;
        const empowerStacks = this.empowerStacks?.[i] || 0;
        const cascadeFlash = this.skillCascadeFlashUntil?.[i] != null && this.time < this.skillCascadeFlashUntil[i];
        slotEl.classList.toggle("skill-cascade-flash", !!cascadeFlash);
        const stackEl = slotEl.querySelector(".skill-empower-stacks");
        if (stackEl) {
          stackEl.textContent = empowerStacks > 0 ? String(empowerStacks) : "";
          stackEl.style.display = empowerStacks > 0 ? "block" : "none";
        }
      }
      const isCharging = this.skillChargeSlot === i;
      slotEl.classList.toggle("skill-slot-charging", isCharging);
      const cd = this.skillCooldowns[i] || 0;
      const baseCd = def ? def.baseCd : 1;
      const isAura = def && def.category === "aura";
      let pct = 0;
      if (isCharging && this.skillChargeStartTime != null) {
        const chargeDur = Math.min(2, this.time - this.skillChargeStartTime);
        pct = chargeDur / 2;
        if (cdEl) {
          cdEl.style.background = `conic-gradient(#eab308 0deg, #f59e0b ${pct * 360}deg, transparent ${pct * 360}deg)`;
        }
      } else {
        const mods = getModsForSkillSlot(this, i);
        const effectiveBaseCd = baseCd + (mods.includes("amplify") ? 0.5 : 0);
        pct = !isAura && effectiveBaseCd > 0 ? Math.min(1, cd / (effectiveBaseCd * this.getSkillCooldownMult(skillId))) : 0;
        if (cdEl) {
          cdEl.style.background = pct > 0 ? `conic-gradient(#374151 0deg, #374151 ${pct * 360}deg, transparent ${pct * 360}deg)` : "none";
        }
      }
      slotEl.classList.toggle("aura-active", isAura && this.activeAuras.has(skillId));
    }
  }

  computePlayerDamage(enemy) {
    let dmg = this.currentStats.attack;
    dmg += this.getAttackUpgradeValue("flatDamage");
    dmg *= 1 + this.getAttackUpgradeValue("damageBoost");
    dmg *= 1 - this.getAttackPenaltyValue("damageReduction");
    if (this.playerCursedWeakenUntil > this.time) dmg = Math.round(dmg * 0.8);
    if (this.hasBlessing("berserking")) dmg = Math.round(dmg * 1.5);
    if (this.hasUpgradeCard("glassCannon")) dmg = Math.round(dmg * 1.5);
    if (this.hasUpgradeCard("doubleStrike")) {
      this.doubleStrikeCounter++;
      if (this.doubleStrikeCounter >= 5) {
        this.doubleStrikeCounter = 0;
        dmg *= 2;
      }
    }
    if (this.hasUpgradeCard("berserkerRage")) {
      const ratio =
        this.currentStats.maxHealth > 0
          ? this.currentHealth / this.currentStats.maxHealth
          : 1;
      dmg *= 1 + (1 - ratio) * 0.5;
    }
    if (enemy && hasTalent("executioner") && enemy.health < enemy.maxHealth * 0.3) {
      dmg = Math.round(dmg * 1.25);
    }
    return dmg;
  }

  updateBoss(dt) {
    const boss = this.enemySystem.boss;
    const player = this.player;
    const es = this.enemySystem;
    const globalSlow = this.timeWarpUntil > this.time ? 0.5 : 1;

    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const bx = boss.position.x + boss.size / 2;
    const by = boss.position.y + boss.size / 2;
    const dx = px - bx;
    const dy = py - by;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Update boss (handles particle trail and transition)
    if (boss.update) boss.update(dt, this.time);

    if (boss.hitFlashTimer > 0) boss.hitFlashTimer -= dt;
    this.processEnemyDebuffs(dt, boss);
    if (boss.stunUntil != null && this.time < boss.stunUntil) return;

    // Charge attack
    if (boss.chargeActive) {
      boss.position.x += boss.chargeDir.x * boss.chargeSpeed * dt * globalSlow;
      boss.position.y += boss.chargeDir.y * boss.chargeSpeed * dt * globalSlow;
      const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
      boss.position.x = Math.max(margin, Math.min(boss.position.x, this.world.width - margin - boss.size));
      boss.position.y = Math.max(margin, Math.min(boss.position.y, this.world.height - margin - boss.size));
      boss.chargeTimer -= dt;
      if (boss.chargeTimer <= 0) boss.chargeActive = false;
      if (boss.intersects(player)) {
        this.onPlayerDamaged(boss.attack * 1.5, true);
        boss.chargeActive = false;
      }
    } else {
      boss.chargeCooldown -= dt;
      boss.projectileTimer -= dt;
      boss.minionTimer -= dt;
      boss.attackTimer -= dt;

      if (boss.chargeCooldown <= 0) {
        boss.chargeCooldown = boss.phase2 ? 2.8 : 4;
        boss.chargeActive = true;
        boss.chargeTimer = 0.6;
        boss.chargeDir.set(dx / dist, dy / dist);
      } else if (boss.projectileTimer <= 0) {
        boss.projectileTimer = boss.projectileCooldown;
        const projCount = boss.phase2 ? 3 : 2;
        for (let i = 0; i < projCount; i++) {
          const angle = Math.atan2(dy, dx) + (i - (projCount - 1) / 2) * 0.4;
          const speed = 280;
          const proj = new Projectile(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed, 12, 14, "#dc2626");
          es.projectiles.push(proj);
        }
      } else if (boss.minionTimer <= 0) {
        boss.minionTimer = boss.minionCooldown;
      } else {
        const moveSpeed = boss.speed * dt * globalSlow;
        boss.position.x += (dx / dist) * moveSpeed;
        boss.position.y += (dy / dist) * moveSpeed;
        const margin = this.world.wallCollisionThickness ?? this.world.wallThickness;
        boss.position.x = Math.max(margin, Math.min(boss.position.x, this.world.width - margin - boss.size));
        boss.position.y = Math.max(margin, Math.min(boss.position.y, this.world.height - margin - boss.size));

        if (boss.intersects(player) && boss.attackTimer <= 0) {
          boss.attackTimer = boss.attackCooldown;
          this.onPlayerDamaged(boss.attack);
        }
      }
    }

    // Player damages boss via projectiles (handled in updatePlayerProjectiles)
    if (boss.intersects(player) && this.hasUpgradeCard("thorns")) {
      const thornsDmg = Math.max(1, Math.round(this.currentStats.defense * 0.5 + 3));
      this.dealDamageToEnemy(boss, thornsDmg);
    }

    if (boss.isDead) {
      const xpMult = DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1;
      this.grantXP(Math.round(BOSS_XP * xpMult));
      const bossGold = rollGoldDrop("boss");
      this.lootSystem.spawnGoldAt(boss.position.x + boss.size / 2, boss.position.y + boss.size / 2, bossGold);
      if (this.pendingMerchantInvestment) {
        if (Math.random() < 0.2) {
        } else {
          if (Math.random() < 0.5) {
            const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
            const type = types[Math.floor(Math.random() * types.length)];
            const def = generateEquipmentItem(type, this.currentMap?.lootQuality ?? 0.5, 0.5);
            this.inventory.push({
              id: 60000 + Math.floor(Math.random() * 10000),
              name: def.name,
              type: def.type,
              stats: def.stats || {},
              cardKey: null,
              description: "",
              weight: def.weight,
              rarity: def.rarity,
              modifiers: def.modifiers || [],
              baseStat: def.baseStat || null,
              sockets: def.sockets ?? 0
            });
          }
        }
        this.pendingMerchantInvestment = null;
      }

      const bx = boss.position.x + boss.size / 2;
      const by = boss.position.y + boss.size / 2;
      const count = 3 + Math.floor(Math.random() * 2);
      this.lootSystem.spawnBurstAt(bx, by, count, 0.6);
      if (hasTalent("warlord")) this.lootSystem.spawnGuaranteedWeaponAt(bx, by);
      const legDropChance = this.difficulty >= 4 ? 0.25 : 0.15;
      if (Math.random() < legDropChance) {
        const cube = LEGENDARY_CUBES[Math.floor(Math.random() * LEGENDARY_CUBES.length)];
        this.lootSystem.spawnCubeAt(bx, by, cube.id);
        this.skillEffects.push({ type: "legendaryBeam", x: bx, y: by, t: 0, duration: 3 });
      }
      const hasGenerative = (item) => item?.modifiers?.some((m) => m.id === "generative");
      const allT3Cubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES].map((c) => `${c.id}T3`);
      for (const [slot, item] of Object.entries(this.equipment)) {
        if (item && hasGenerative(item)) {
          const cubeKey = allT3Cubes[Math.floor(Math.random() * allT3Cubes.length)];
          addToLegacyCubeStash(cubeKey);
        }
      }
      markDifficultyCompleted(this.difficulty);
      if (this.damageSkillsUsedThisRun.size === 1 && this.damageSkillsUsedThisRun.has("lightningBolt")) {
        setSkillUnlock("lightningOnlyRun", true);
      }
      this.bossExtractionActive = false;
      this.bossExtractionTimeLeft = 0;
      es.boss = null;
      this.updateEnemyCountUI();
      const portalSize = 96;
      if (!this.victoryPortal) {
        this.victoryPortal = { x: bx - portalSize / 2, y: by - portalSize / 2, w: portalSize, h: portalSize };
        this.victoryPortalTimer = 3;
      }
      if (hasTalent("livingItem")) {
        const living = this.getLivingItem();
        if (living && (living.modifiers?.length ?? 0) < 6) {
          const pool = getModifierPoolForType(living.type);
          const d = Math.min(5, Math.max(1, this.difficulty ?? 1));
          for (let add = 0; add < 2 && (living.modifiers?.length ?? 0) < 6; add++) {
            const available = pool.filter((p) => !living.modifiers?.some((m) => m.id === p.id));
            if (available.length === 0) break;
            const m = available[Math.floor(Math.random() * available.length)];
            const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(d) : rollModifierValueForDifficulty(d, m.id);
            living.modifiers = living.modifiers || [];
            living.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
          }
          this.rebuildItemStats(living);
          this.recalculateStats();
          this.updateEquippedUI();
        }
      }
      if (this.difficulty === 5) {
        if (hasTalent("forgeMastery") && Math.random() < 0.1) {
          this.mapInteractables.push({ type: "foresightShrine", x: bx + 100, y: by - 60, w: 64, h: 64 });
        }
        if (hasTalent("perfectCraft") && Math.random() < 0.05) {
          this.mapInteractables.push({ type: "perfectionWorkshop", x: bx - 100, y: by - 60, w: 64, h: 64 });
        }
      }
    }
  }

  interactWithMapObject(obj) {
    if (obj.type === "shop") {
      this.showNotification("Shop", "A merchant has set up shop here.");
      return;
    }
    if (obj.type === "socketWorkshop") {
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item && (item.sockets ?? 0) < 2) {
          let add = 1;
          if (item.rarity === "rare" && (item.sockets ?? 0) === 1 && hasTalent("tinkererSocketMastery") && Math.random() < 0.05) add = 2;
          item.sockets = Math.min(3, (item.sockets ?? 0) + add);
          this.rebuildItemStats(item);
          this.recalculateStats();
          this.updateEquippedUI();
          break;
        }
      }
    } else if (obj.type === "foresightShrine") {
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item) {
          item.modifiers = item.modifiers || [];
          if (!item.modifiers.some((m) => m.id === "foresight")) {
            item.modifiers.push({ id: "foresight", label: "Foresight", statKey: null, value: 0, addedAt: Date.now() });
            this.rebuildItemStats(item);
            this.recalculateStats();
            this.updateEquippedUI();
            break;
          }
        }
      }
    } else if (obj.type === "perfectionWorkshop") {
      for (const slot of ["Helmet", "Body Armour", "Weapon", "Boots"]) {
        const item = this.equipment[slot];
        if (item && item.modifiers?.length > 0) {
          const idx = Math.floor(Math.random() * item.modifiers.length);
          if (!LEGENDARY_MODIFIER_IDS.includes(item.modifiers[idx].id)) {
            item.modifiers[idx].value = 0.45 + Math.random() * 0.05;
            this.rebuildItemStats(item);
            this.recalculateStats();
            this.updateEquippedUI();
          }
          break;
        }
      }
    } else if (obj.type === "shrine" && !obj.used) {
      this.openShrineInteraction(obj);
    }
  }

  // Helper function to remove the most recent upgrade/penalty of a given ID
  removeUpgradeById(upgradeId) {
    if (!this.runAttackUpgrades) return null;
    // Find the last occurrence (most recent)
    let lastIndex = -1;
    for (let i = this.runAttackUpgrades.length - 1; i >= 0; i--) {
      if (this.runAttackUpgrades[i].id === upgradeId) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) return null;
    const removed = this.runAttackUpgrades[lastIndex];
    this.runAttackUpgrades.splice(lastIndex, 1);
    if (this.buildLogRefresh) this.buildLogRefresh();
    return removed;
  }

  removePenaltyById(penaltyId) {
    if (!this.runAttackPenalties) return null;
    // Find the last occurrence (most recent)
    let lastIndex = -1;
    for (let i = this.runAttackPenalties.length - 1; i >= 0; i--) {
      if (this.runAttackPenalties[i].id === penaltyId) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) return null;
    const removed = this.runAttackPenalties[lastIndex];
    this.runAttackPenalties.splice(lastIndex, 1);
    if (this.buildLogRefresh) this.buildLogRefresh();
    return removed;
  }

  // Get standard upgrades/penalties only
  getStandardUpgrades() {
    const defs = ATTACK_UPGRADE_DEFS[this.attackType];
    if (!defs) return [];
    return (this.runAttackUpgrades || []).filter(u => {
      const def = (defs.standardUpgrades || []).find(su => su.id === u.id);
      return def !== undefined;
    });
  }

  getStandardPenalties() {
    const defs = ATTACK_UPGRADE_DEFS[this.attackType];
    if (!defs) return [];
    return (this.runAttackPenalties || []).filter(p => {
      const def = (defs.standardPenalties || []).find(sp => sp.id === p.id);
      return def !== undefined;
    });
  }

  // Add shrine interaction to build log
  addShrineInteraction(shrineName, message) {
    if (!this.shrineInteractions) this.shrineInteractions = [];
    this.shrineInteractions.push({ shrineName, message, time: this.time });
    if (this.buildLogRefresh) this.buildLogRefresh();
  }

  openShrineInteraction(shrineObj) {
    this.currentShrine = shrineObj;
    const overlay = document.getElementById("shrine-overlay");
    const titleEl = document.getElementById("shrine-title");
    const descEl = document.getElementById("shrine-desc");
    const upgradeSelect = document.getElementById("shrine-upgrade-select");
    const penaltySelect = document.getElementById("shrine-penalty-select");
    const upgradeList = document.getElementById("shrine-upgrade-list");
    const penaltyList = document.getElementById("shrine-penalty-list");
    const confirmBtn = document.getElementById("shrine-confirm");
    const cancelBtn = document.getElementById("shrine-cancel");

    if (!overlay || !titleEl || !descEl) return;

    titleEl.textContent = shrineObj.shrineName;
    descEl.textContent = shrineObj.shrineDescription;
    overlay.classList.remove("hidden");
    upgradeSelect.classList.add("hidden");
    penaltySelect.classList.add("hidden");
    upgradeList.innerHTML = "";
    penaltyList.innerHTML = "";
    this.selectedUpgradeId = null;
    this.selectedPenaltyId = null;

    // Setup confirm/cancel buttons
    const handleConfirm = () => {
      // Check if selection is required and made
      if (shrineObj.shrineId === "purification" && !this.selectedPenaltyId) return;
      if (["frenzy", "restoration", "trial"].includes(shrineObj.shrineId) && !this.selectedUpgradeId) return;
      
      if (this.currentShrine && !this.currentShrine.used) {
        this.executeShrineEffect(this.currentShrine);
        this.currentShrine.used = true;
      }
      overlay.classList.add("hidden");
      this.currentShrine = null;
      this.selectedUpgradeId = null;
      this.selectedPenaltyId = null;
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
    };

    const handleCancel = () => {
      overlay.classList.add("hidden");
      this.currentShrine = null;
      this.selectedUpgradeId = null;
      this.selectedPenaltyId = null;
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
    };

    confirmBtn.disabled = true;
    if (!["purification", "frenzy", "restoration", "trial"].includes(shrineObj.shrineId)) {
      confirmBtn.disabled = false; // No selection needed for chaos/ascension
    }
    
    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);

    // Show selection UI based on shrine type
    if (shrineObj.shrineId === "purification") {
      // Show penalty selection
      const standardPenalties = this.getStandardPenalties();
      if (standardPenalties.length === 0) {
        handleCancel();
        return;
      }
      penaltySelect.classList.remove("hidden");
      const uniquePenalties = new Set();
      standardPenalties.forEach(p => {
        if (!uniquePenalties.has(p.id)) {
          uniquePenalties.add(p.id);
          const li = document.createElement("li");
          li.textContent = `spr_ui_sword ${p.name}`;
          li.dataset.penaltyId = p.id;
          li.addEventListener("click", () => {
            penaltyList.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
            li.classList.add("selected");
            this.selectedPenaltyId = p.id;
            confirmBtn.disabled = false;
          });
          penaltyList.appendChild(li);
        }
      });
    } else if (["frenzy", "restoration", "trial"].includes(shrineObj.shrineId)) {
      // Show upgrade selection
      const upgrades = this.runAttackUpgrades || [];
      if (upgrades.length === 0) {
        handleCancel();
        return;
      }
      upgradeSelect.classList.remove("hidden");
      const uniqueUpgrades = new Set();
      upgrades.forEach(u => {
        if (!uniqueUpgrades.has(u.id)) {
          uniqueUpgrades.add(u.id);
          const li = document.createElement("li");
          const defs = ATTACK_UPGRADE_DEFS[this.attackType];
          const def = defs ? [...(defs.standardUpgrades || []), ...(defs.uniqueUpgrades || [])].find(d => d.id === u.id) : null;
          li.textContent = `spr_ui_sword ${u.name}`;
          li.dataset.upgradeId = u.id;
          li.addEventListener("click", () => {
            upgradeList.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
            li.classList.add("selected");
            this.selectedUpgradeId = u.id;
            confirmBtn.disabled = false;
          });
          upgradeList.appendChild(li);
        }
      });
    }
  }

  executeShrineEffect(shrineObj) {
    const shrineId = shrineObj.shrineId;
    
    if (shrineId === "purification") {
      // Remove chosen standard penalty and random standard upgrade
      if (!this.selectedPenaltyId) return;
      const removedPenalty = this.removePenaltyById(this.selectedPenaltyId);
      const standardUpgrades = this.getStandardUpgrades();
      if (standardUpgrades.length > 0) {
        const randomUpgrade = standardUpgrades[Math.floor(Math.random() * standardUpgrades.length)];
        const removedUpgrade = this.removeUpgradeById(randomUpgrade.id);
        const penaltyName = removedPenalty ? removedPenalty.name : "Unknown";
        const upgradeName = removedUpgrade ? removedUpgrade.name : "Unknown";
        this.addShrineInteraction(shrineObj.shrineName, `Removed penalty: ${penaltyName}. Removed upgrade: ${upgradeName}.`);
      } else {
        const penaltyName = removedPenalty ? removedPenalty.name : "Unknown";
        this.addShrineInteraction(shrineObj.shrineName, `Removed penalty: ${penaltyName}. No standard upgrades to remove.`);
      }
    } else if (shrineId === "chaos") {
      // Add two random standard upgrades, remove one random upgrade
      const defs = ATTACK_UPGRADE_DEFS[this.attackType];
      if (!defs) return;
      const standardPool = (defs.standardUpgrades || []).filter(u => {
        const taken = (this.runAttackUpgrades || []).map(up => up.id);
        return !taken.includes(u.id);
      });
      const added = [];
      for (let i = 0; i < 2 && standardPool.length > 0; i++) {
        const def = standardPool[Math.floor(Math.random() * standardPool.length)];
        const value = rollUpgradeValue(def);
        this.runAttackUpgrades.push({
          id: def.id,
          name: def.name,
          description: def.description,
          value: value,
          percent: !!def.valueRange?.percent
        });
        added.push(def.name);
        standardPool.splice(standardPool.indexOf(def), 1);
      }
      const allUpgrades = this.runAttackUpgrades || [];
      if (allUpgrades.length > 0) {
        const randomUpgrade = allUpgrades[Math.floor(Math.random() * allUpgrades.length)];
        const removed = this.removeUpgradeById(randomUpgrade.id);
        const removedName = removed ? removed.name : "Unknown";
        this.addShrineInteraction(shrineObj.shrineName, `Added upgrades: ${added.join(", ")}. Removed upgrade: ${removedName}.`);
      } else {
        this.addShrineInteraction(shrineObj.shrineName, `Added upgrades: ${added.join(", ")}.`);
      }
      if (this.buildLogRefresh) this.buildLogRefresh();
    } else if (shrineId === "frenzy") {
      // Remove chosen upgrade, gain buffs for 30s
      if (!this.selectedUpgradeId) return;
      const removed = this.removeUpgradeById(this.selectedUpgradeId);
      if (removed) {
        this.frenzyBuffUntil = this.time + 30;
        this.addShrineInteraction(shrineObj.shrineName, `Removed upgrade: ${removed.name}. Gained 40% movement speed, 30% attack speed, and 20% XP for 30 seconds.`);
      }
    } else if (shrineId === "ascension") {
      // Transform random standard upgrade to unique upgrade
      const standardUpgrades = this.getStandardUpgrades();
      if (standardUpgrades.length === 0) {
        this.addShrineInteraction(shrineObj.shrineName, "No standard upgrades to transform.");
        return;
      }
      const randomUpgrade = standardUpgrades[Math.floor(Math.random() * standardUpgrades.length)];
      const defs = ATTACK_UPGRADE_DEFS[this.attackType];
      if (!defs) return;
      const takenUnique = new Set((this.runAttackUpgrades || []).map(u => u.id));
      const uniquePool = (defs.uniqueUpgrades || []).filter(u => !takenUnique.has(u.id));
      if (uniquePool.length === 0) {
        this.addShrineInteraction(shrineObj.shrineName, `No unique upgrades available.`);
        return;
      }
      const newUnique = uniquePool[Math.floor(Math.random() * uniquePool.length)];
      this.removeUpgradeById(randomUpgrade.id);
      this.runAttackUpgrades.push({
        id: newUnique.id,
        name: newUnique.name,
        description: newUnique.description,
        value: undefined,
        percent: false
      });
      this.addShrineInteraction(shrineObj.shrineName, `Transformed ${randomUpgrade.name} into ${newUnique.name}.`);
      if (this.buildLogRefresh) this.buildLogRefresh();
    } else if (shrineId === "restoration") {
      // Remove chosen upgrade, restore full health
      if (!this.selectedUpgradeId) return;
      const removed = this.removeUpgradeById(this.selectedUpgradeId);
      if (removed) {
        this.currentHealth = this.currentStats.maxHealth;
        this.addShrineInteraction(shrineObj.shrineName, `Removed upgrade: ${removed.name}. Health restored to full.`);
      }
    } else if (shrineId === "trial") {
      // Remove chosen upgrade, spawn two mini-bosses
      if (!this.selectedUpgradeId) return;
      const removed = this.removeUpgradeById(this.selectedUpgradeId);
      if (removed) {
        const px = this.player.position.x + this.player.size / 2;
        const py = this.player.position.y + this.player.size / 2;
        this.trialBosses = [];
        this.trialTimer = 30;
        this.trialCompleted = false;
        for (let i = 0; i < 2; i++) {
          const enemy = this.enemySystem.spawnOne("miniBoss", null, { x: px, y: py });
          if (enemy) {
            this.trialBosses.push(enemy.id);
            this.enemySystem.enemies.push(enemy);
          }
        }
        this.addShrineInteraction(shrineObj.shrineName, `Removed upgrade: ${removed.name}. Two mini-bosses summoned. Defeat both within 30 seconds to earn 1 Legacy Point.`);
      }
    }
  }

  playerInVictoryPortal() {
    if (!this.victoryPortal) return false;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const p = this.victoryPortal;
    return px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h;
  }

  spawnExtractionPortalNearPlayer() {
    if (this.victoryPortal) return;
    const portalSize = 96;
    const margin = this.world?.wallCollisionThickness ?? this.world?.wallThickness ?? 16;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const half = portalSize / 2;

    const clampPortalPos = (x, y) => ({
      x: Math.max(margin, Math.min(x, this.world.width - margin - portalSize)),
      y: Math.max(margin, Math.min(y, this.world.height - margin - portalSize)),
    });

    const overlapsBlocking = (x, y) => {
      if (typeof this.overlapsTileWall === "function" && this.overlapsTileWall(x, y, portalSize, portalSize)) return true;
      for (const obstacle of this.obstacles || []) {
        if (obstacle?.destroyed || !obstacle?.blocksMovement) continue;
        if (obstacleIntersectsRect(obstacle, { x, y, w: portalSize, h: portalSize })) return true;
      }
      for (const b of this.breakables || []) {
        if (b?.isDead) continue;
        const bw = b.hitbox?.w ?? b.size ?? 40;
        const bh = b.hitbox?.h ?? b.size ?? 40;
        if (x < b.position.x + bw && x + portalSize > b.position.x && y < b.position.y + bh && y + portalSize > b.position.y) return true;
      }
      return false;
    };

    const radii = [140, 180, 100, 220];
    const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
    const candidates = [];
    for (const r of radii) {
      for (const a of angles) {
        const x = px + Math.cos(a) * r - half;
        const y = py + Math.sin(a) * r - half;
        candidates.push(clampPortalPos(x, y));
      }
    }
    candidates.push(clampPortalPos(px - half, py - half));

    let placed = null;
    for (const c of candidates) {
      if (!overlapsBlocking(c.x, c.y)) {
        placed = c;
        break;
      }
    }
    if (!placed) {
      placed = clampPortalPos(px - half, py - half);
    }

    this.victoryPortal = { x: placed.x, y: placed.y, w: portalSize, h: portalSize };
    this.victoryPortalTimer = 3;
    this.updateVictoryPortalUI();
  }

  checkVictoryPortal(dt) {
    if (!this.victoryPortal) {
      this.updateVictoryPortalUI();
      return;
    }
    if (this.playerInVictoryPortal()) {
      this.victoryPortalTimer -= dt;
      this.updateVictoryPortalUI();
      if (this.victoryPortalTimer <= 0) {
        this.showVictory();
        this.victoryPortal = null;
        const el = document.getElementById("victory-portal-countdown");
        if (el) el.classList.add("hidden");
      }
    } else {
      this.victoryPortalTimer = 3;
      this.updateVictoryPortalUI();
    }
  }

  updateVictoryPortalUI() {
    const el = document.getElementById("victory-portal-countdown");
    if (!el) return;
    if (!this.victoryPortal) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    const secs = Math.ceil(this.victoryPortalTimer);
    el.textContent = this.playerInVictoryPortal() ? `Enter portal: ${secs}` : "Stand in the portal to escape";
  }

  grantXPFromEnemy(enemy) {
    const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
    if (!baseType) return;
    const minXp = baseType.minXp ?? 10;
    const maxXp = baseType.maxXp ?? 20;
    let xp = minXp + Math.floor(Math.random() * (maxXp - minXp + 1));
    const mult = DIFFICULTY_STAT_MULTIPLIER[this.difficulty] ?? 1;
    const tierMult = enemy.tierXpMult ?? 1;
    xp = Math.max(1, Math.round(xp * mult * tierMult));
    this.grantXP(xp);
  }

  dropLootFromEnemy(enemy) {
    if (enemy.isAffixMinion) return [];
    const goldType = enemy.enemyTier === "miniBoss" || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian
      ? "elite"
      : (enemy.enemyTier === "elite" || enemy.isElite ? "elite" : "mob");
    addGold(this, rollGoldDrop(goldType), "enemy_drop", { enemyType: goldType });
    this.updateMapUI();
    const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isMiniBoss || enemy.isFiery || enemy.isCursedChestGuardian);
    if (isMiniBoss) {
      this.activeBlessings = [];
      const hasBlessed = (item) => item?.modifiers?.some((m) => m.id === "blessed");
      const activeIds = new Set();
      for (const [slot, item] of Object.entries(this.equipment)) {
        if (item && hasBlessed(item)) {
          let def = BLESSING_DEFS[Math.floor(Math.random() * BLESSING_DEFS.length)];
          let attempts = 0;
          while (activeIds.has(def.id) && attempts < 20) {
            def = BLESSING_DEFS[Math.floor(Math.random() * BLESSING_DEFS.length)];
            attempts++;
          }
          activeIds.add(def.id);
          this.activeBlessings.push({ ...def, until: this.time + 20 });
        }
      }
    }
    const martyrMinions = [];
    if (enemy.affixes?.includes("martyr")) {
      const base = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 20 + Math.random() * 15;
        const mx = ex + Math.cos(angle) * dist - 12;
        const my = ey + Math.sin(angle) * dist - 12;
        const typeDef = { ...base, maxHealth: Math.round(base.maxHealth * 0.35), attack: base.attack, speed: base.speed, size: 24 };
        const minion = new Enemy(mx, my, typeDef);
        minion.worldBounds = enemy.worldBounds;
        minion.activated = true;
        minion.isAffixMinion = true;
        martyrMinions.push(minion);
      }
    }
    if (enemy.isCursedChestGuardian) {
      this.tryDropCubeFromEnemy(enemy);
      this.cursedChestBlocked = false;
      this.grantXP(50);
      this.lootSystem.spawnBurstAt(enemy.position.x + enemy.size / 2, enemy.position.y + enemy.size / 2, 2, 0.6);
      return martyrMinions;
    }
    if (enemy.isFiery && !this.fieryKilled) {
      this.tryDropCubeFromEnemy(enemy);
      this.fieryKilled = true;
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      if (this.fieryTimer > 0) {
        const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
        const type = types[Math.floor(Math.random() * types.length)];
        const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
        const def = generateEquipmentItem(type, 1, 0.8, null, { difficulty: diff });
        const item = new LootItem(this.lootSystem.nextId++, ex - 10, ey - 10, def, ex, ey);
        this.lootSystem.items.push(item);
        this.grantXP(80);
      }
      return martyrMinions;
    }
    this.grantXPFromEnemy(enemy);
    this.tryDropCubeFromEnemy(enemy);

    const tier = enemy.enemyTier || (enemy.isMiniBoss ? "miniBoss" : enemy.isElite ? "elite" : "minion");
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const types = ["Helmet", "Boots", "Body Armour", "Weapon"];
    const lootQual = this.currentMap?.lootQuality ?? 0.5;

    let dropMult = enemy.affixes?.includes("evasive") ? 2 : 1;
    if (this.hasBlessing("fortune")) dropMult *= 2;
    const equipDropMult = hasTalent("keenEye") ? 1.15 : 1;
    const difficulty = Math.min(5, Math.max(1, this.difficulty ?? 1));
    const equipOpts = { qualityEye: hasTalent("qualityEye"), socketSense: hasTalent("socketSense"), difficulty };
    if (tier === "minion") {
      if (Math.random() < 0.05 * dropMult * equipDropMult) {
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, lootQual, 0, "common", equipOpts);
        this.lootSystem.spawnEquipmentAt(ex, ey, def);
      }
    } else if (tier === "elite") {
      if (Math.random() < 0.2 * dropMult * equipDropMult) {
        const type = types[Math.floor(Math.random() * types.length)];
        const def = generateEquipmentItem(type, Math.min(1, lootQual + 0.35), 0.3, "magic", equipOpts);
        this.lootSystem.spawnEquipmentAt(ex, ey, def);
      }
    } else if (tier === "miniBoss") {
      const type = types[Math.floor(Math.random() * types.length)];
      const def = generateEquipmentItem(type, 1, 0.8, "rare", equipOpts);
      this.lootSystem.spawnEquipmentAt(ex, ey, def);
      if (Math.random() < 0.1 * dropMult * equipDropMult) {
        const type2 = types[Math.floor(Math.random() * types.length)];
        const def2 = generateEquipmentItem(type2, 1, 0.8, "rare", equipOpts);
        this.lootSystem.spawnEquipmentAt(ex + 25, ey, def2);
      }
      if (hasTalent("philosophersStone") && Math.random() < 0.05) {
        const legType = types[Math.floor(Math.random() * types.length)];
        const legDef = this.generateLegendaryEquipment(legType);
        this.lootSystem.spawnEquipmentAt(ex + 15, ey - 20, legDef);
      }
      if (hasTalent("livingItem")) {
        const living = this.getLivingItem();
        if (living && (living.modifiers?.length ?? 0) < 6) {
          const pool = getModifierPoolForType(living.type).filter((p) => !living.modifiers?.some((m) => m.id === p.id));
          if (pool.length > 0) {
            const m = pool[Math.floor(Math.random() * pool.length)];
            const d = Math.min(5, Math.max(1, this.difficulty ?? 1));
            const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(d) : rollModifierValueForDifficulty(d, m.id);
            living.modifiers = living.modifiers || [];
            living.modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
            this.rebuildItemStats(living);
            this.recalculateStats();
            this.updateEquippedUI();
          }
        }
      }
    }

    const baseType = ENEMY_TYPES.find((t) => t.name === enemy.name);
    if (baseType && hasTalent("battleHardened") && Math.random() < 0.1) {
      this.lootSystem.spawnGuaranteedWeaponAt(ex, ey);
    }
    if (hasTalent("jackpot") && !this.jackpotUsed) {
      this.jackpotUsed = true;
      this.lootSystem.spawnBurstAt(ex, ey, 1, 1);
    }
    return martyrMinions;
  }

  updateProjectiles(dt) {
    const es = this.enemySystem;
    const surviving = [];
    const playerInset = Math.max(0, PLAYER_WALL_COLLISION_INSET || 0);
    const playerBase = Math.max(1, this.player.size - playerInset * 2);
    const playerW = Math.max(1, playerBase * 0.25);
    const playerH = Math.max(1, playerBase * 0.5);
    const playerOffX = playerInset + (playerBase - playerW) / 2;
    const playerOffY = playerInset + (playerBase - playerH) / 2;
    const playerRect = {
      x: this.player.position.x + playerOffX,
      y: this.player.position.y + playerOffY,
      w: playerW,
      h: playerH
    };
    const rectsOverlap = (a, b) => (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
    const projectileHitsPlayer = (proj) => {
      const nowRect = { x: proj.position.x, y: proj.position.y, w: proj.size, h: proj.size };
      if (rectsOverlap(nowRect, playerRect)) return true;
      const prev = proj.prevPosition;
      if (!prev) return false;
      const minX = Math.min(prev.x, proj.position.x);
      const minY = Math.min(prev.y, proj.position.y);
      const sweptRect = {
        x: minX,
        y: minY,
        w: Math.abs(proj.position.x - prev.x) + proj.size,
        h: Math.abs(proj.position.y - prev.y) + proj.size
      };
      return rectsOverlap(sweptRect, playerRect);
    };
    for (const p of es.projectiles) {
      p.update(dt);
      if (p.isExpired && p.isExpired()) continue;

      // Check obstacle collision
      let hitObstacle = false;
      for (const obstacle of this.obstacles || []) {
        if (obstacle.destroyed || !obstacle.blocksProjectiles) continue;
        if (p.intersects(obstacle)) {
          hitObstacle = true;
          // Barrel explosion
          if (obstacle.type === "barrel") {
            obstacle.destroyed = true;
            const ex = obstacle.position.x + obstacle.size.w / 2;
            const ey = obstacle.position.y + obstacle.size.h / 2;
            const hitArea = this.enemiesInRadius(ex, ey, obstacle.typeDef.explosionRadius);
            for (const e of hitArea) {
              this.dealDamageToEnemy(e, obstacle.typeDef.explosionDamage);
            }
            // Damage player if in range
            const px = this.player.position.x + this.player.size / 2;
            const py = this.player.position.y + this.player.size / 2;
            const dist = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);
            if (dist < obstacle.typeDef.explosionRadius) {
              this.onPlayerDamaged(obstacle.typeDef.explosionDamage, false);
            }
            this.skillEffects.push({ 
              type: "barrelExplosion", 
              x: ex, 
              y: ey, 
              radius: obstacle.typeDef.explosionRadius, 
              t: 0, 
              duration: 0.3 
            });
          }
          break;
        }
      }
      
      // Check sub-area wall collision
      if (!hitObstacle && this.world.tileWallRects) {
        for (const wall of this.world.tileWallRects) {
          const wallRect = getWallCollisionRect(wall);
            const projRect = { x: p.position.x, y: p.position.y, w: p.size, h: p.size };
            
            if (projRect.x < wallRect.x + wallRect.w && projRect.x + projRect.w > wallRect.x &&
                projRect.y < wallRect.y + wallRect.h && projRect.y + projRect.h > wallRect.y) {
              hitObstacle = true;
              break;
            }
          }
          if (hitObstacle) break;
        }
      // Procedural tile walls (enemy projectiles do not penetrate)
      if (!hitObstacle && this.world.tileWallRects) {
        const projRect = { x: p.position.x, y: p.position.y, w: p.size, h: p.size };
        for (const wall of this.world.tileWallRects) {
          if (projRect.x < wall.x + wall.w && projRect.x + projRect.w > wall.x &&
              projRect.y < wall.y + wall.h && projRect.y + projRect.h > wall.y) {
            hitObstacle = true;
            break;
          }
        }
      }

      if (hitObstacle) {
        if (p.slowZone && this.hazardSystem) {
          this.hazardSystem.addTemporaryPatch("slowZone", p.position.x + p.size / 2, p.position.y + p.size / 2, p.slowRadius ?? 50, p.slowDuration ?? 1.5, 0, false, 0.6);
        }
        continue;
      }

      if (projectileHitsPlayer(p)) {
        if (p.sourceEnemy) this.lastDamagingEnemy = p.sourceEnemy;
        this.onPlayerDamaged(p.damage, true);
        if (p.slowZone && this.hazardSystem) {
          this.hazardSystem.addTemporaryPatch("slowZone", p.position.x + p.size / 2, p.position.y + p.size / 2, p.slowRadius ?? 50, p.slowDuration ?? 1.5, 0, false, 0.6);
        }
      } else {
        const margin = -20;
        if (p.position.x >= margin && p.position.x <= this.world.width - margin &&
            p.position.y >= margin && p.position.y <= this.world.height - margin) {
          surviving.push(p);
        }
      }
    }
    es.projectiles = surviving;
  }

  onPlayerDamaged(rawAmount, fromEnemy = false) {
    if (this.gameOver) return;
    if (fromEnemy && (this.ghostLooterUntargetableUntil > this.time || this.phantomExtractorUntil > this.time)) return;
    if (fromEnemy && this.hasCondition("enemyDmg")) rawAmount = Math.round(rawAmount * 1.15);
    if (fromEnemy && this.lastDamagingEnemy?._auraBuffed) rawAmount = Math.round(rawAmount * 1.2);
    if (fromEnemy && this.lastDamagingEnemy?.affixes?.includes("cursing")) {
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      
      // Base proc: green puff particles
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 30;
        this.particlePool.spawn(px, py, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.3, 2, "#22c55e");
      }
      
      const roll = Math.random();
      if (roll < 0.25) {
        this.playerSlowUntil = this.time + 2;
        this.playerSlowMult = 0.7;
        this.playerDebuffVFX.slow.active = true;
        this.playerDebuffVFX.slow.until = this.time + 2;
        notifyAncestorDebuffApplied(this);
      } else if (roll < 0.5) {
        this.playerBurnUntil = this.time + 3;
        this.playerBurnDmg = 4;
        this.playerDebuffVFX.burn.active = true;
        this.playerDebuffVFX.burn.until = this.time + 3;
        this.playerDebuffVFX.burn.emberTimer = 0;
        notifyAncestorDebuffApplied(this);
      } else if (roll < 0.75) {
        this.playerCursedWeakenUntil = this.time + 2;
        this.playerDebuffVFX.weaken.active = true;
        this.playerDebuffVFX.weaken.until = this.time + 2;
        this.playerDebuffVFX.weaken.crackTimer = 0;
        notifyAncestorDebuffApplied(this);
      } else {
        this.stunTimer = Math.max(this.stunTimer || 0, 0.5);
        this.playerDebuffVFX.stun.active = true;
        this.playerDebuffVFX.stun.until = this.time + 0.5;
        notifyAncestorDebuffApplied(this);
      }
    }
    if (this.hasUpgradeCard("glassCannon")) rawAmount = Math.round(rawAmount * 1.3);
    if (this.activeAuras.has("barrierAura")) rawAmount = Math.round(rawAmount * 0.85);
    rawAmount = applyRingIncomingDamageMods(this, rawAmount, fromEnemy);
    rawAmount = Math.max(0, Math.round(rawAmount * getAncestorIncomingDamageMult(this)));
    if (typeof this.getPillarIncomingDamageMultiplier === "function") {
      rawAmount = Math.max(0, Math.round(rawAmount * this.getPillarIncomingDamageMultiplier({ fromEnemy })));
    }
    if (typeof this.runPillarEvent === "function") {
      const beforeTakeDamage = this.runPillarEvent("beforeTakeDamage", {
        rawAmount,
        fromEnemy,
        time: this.time
      });
      if (beforeTakeDamage?.cancel) {
        return;
      }
      rawAmount = Math.max(0, Math.round(beforeTakeDamage?.rawAmount ?? rawAmount));
    }

    // Ghost Step: invulnerability window
    if (this.hasUpgradeCard("ghostForm") && this.ghostStepTimer > 0) return;

    // Phoenix Strike: invulnerability
    if (this.phoenixInvulnUntil && this.time < this.phoenixInvulnUntil) return;

    // Dash: invulnerability at midpoint
    if (this.dashActive && this.dashTimer < 0.2 && this.dashTimer >= 0.1) return;

    // Blade Dash: full invulnerability
    if (this.bladeDashActive) return;

    // Iron Skin: absorbs one hit
    if (this.hasUpgradeCard("ironWill") && this.ironSkinShieldReady) {
      this.ironSkinShieldReady = false;
      return;
    }

    // Immortal: regenerating shield absorbs damage first
    if (hasTalent("immortal") && this.immortalShield > 0) {
      const absorb = Math.min(this.immortalShield, rawAmount);
      this.immortalShield -= absorb;
      rawAmount -= absorb;
      if (rawAmount <= 0) return;
    }

    const defenseValue = Math.max(0, this.currentStats?.defense || 0);
    const defenseReduction = defenseValue / (50 + defenseValue);
    const effectiveDamageFloat = rawAmount * (1 - defenseReduction);
    const effectiveDamage = effectiveDamageFloat > 0 ? Math.max(1, Math.round(effectiveDamageFloat)) : 0;
    if (effectiveDamage <= 0) return;
    handleAncestorOnPlayerDamaged(this, { rawAmount, effectiveDamage, fromEnemy });

    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    this.addFloatingText(px, py, effectiveDamage, "playerDamage");
    if (this._lastPlayerDamagedSfx == null || this.time - this._lastPlayerDamagedSfx >= 0.08) {
      this._lastPlayerDamagedSfx = this.time;
      playSfx("playerDamaged");
    }

    this.currentHealth -= effectiveDamage;
    onRingPlayerDamaged(this, effectiveDamage, fromEnemy);
    if (typeof this.runPillarEvent === "function") {
      this.runPillarEvent("afterTakeDamage", {
        rawAmount,
        effectiveDamage,
        fromEnemy,
        time: this.time
      });
    }
    this.timeSinceLastHit = 0;
    this.damageFlashTimer = 0.3; // Trigger red screen flash (0.3 seconds)

    if (this.hasUpgradeCard("ghostForm")) {
      this.ghostStepTimer = 1.5;
    }

    if (this.currentHealth <= 0) {
      if (tryGuardianPreDeath(this)) {
        this.updateHealthBar();
        return;
      }
      if (hasTalent("secondWind") && !this.secondWindUsed) {
        this.secondWindUsed = true;
        setSkillUnlock("secondWindUsed", true);
        this.currentHealth = 1;
      } else {
        this.currentHealth = 0;
        this.showGameOver();
      }
    }

    this.updateStatsUI();
    this.updateHealthBar();
  }

  spawnEnemyDeathSmokeVfx(enemy) {
    if (!enemy) return;
    const cx = enemy.position.x + enemy.size / 2;
    const cy = enemy.position.y + enemy.size / 2;
    const row = Math.random() < 0.5 ? 6 : 7; // 7th or 8th row (0-based)
    const base = this.enemyDeathSmokeFrameW || 64;
    const scale = Math.max(0.9, Math.min(2.2, (enemy.size || 64) / base * 1.15));
    this.enemyDeathSmokeVfx.push({
      x: cx,
      y: cy,
      row,
      t: 0,
      frameCount: this.enemyDeathSmokeFrames || 11,
      fps: this.enemyDeathSmokeFps || 20,
      scale
    });
  }

  updateEnemyDeathSmokeVfx(dt) {
    if (!this.enemyDeathSmokeVfx || this.enemyDeathSmokeVfx.length === 0) return;
    for (let i = this.enemyDeathSmokeVfx.length - 1; i >= 0; i--) {
      const v = this.enemyDeathSmokeVfx[i];
      v.t += dt;
      const lifetime = (v.frameCount || 11) / (v.fps || 20);
      if (v.t >= lifetime) this.enemyDeathSmokeVfx.splice(i, 1);
    }
  }

  drawEnemyDeathSmokeVfx(ctx) {
    const sheet = this.enemyDeathSmokeSheet;
    if (!sheet || !sheet.complete || !this.enemyDeathSmokeVfx || this.enemyDeathSmokeVfx.length === 0) return;
    const fw = this.enemyDeathSmokeFrameW || 64;
    const fh = this.enemyDeathSmokeFrameH || 64;
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    for (const v of this.enemyDeathSmokeVfx) {
      const frameCount = v.frameCount || 11;
      const fps = v.fps || 20;
      const frame = Math.min(frameCount - 1, Math.floor(v.t * fps));
      const sx = frame * fw;
      const sy = (v.row || 6) * fh;
      const dw = fw * (v.scale || 1);
      const dh = fh * (v.scale || 1);
      const dx = Math.floor(v.x - this.camera.position.x - dw / 2);
      const dy = Math.floor(v.y - this.camera.position.y - dh / 2);
      const life = v.t / (frameCount / fps);
      ctx.globalAlpha = life > 0.75 ? Math.max(0, 1 - (life - 0.75) / 0.25) : 1;
      ctx.drawImage(sheet, sx, sy, fw, fh, dx, dy, dw, dh);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = prevSmoothing;
  }

  drawObstacleHitboxDebug(ctx) {
    if (!this.debugDrawObstacleHitboxes) return;
    for (const obstacle of this.obstacles || []) {
      if (!obstacle || obstacle.destroyed) continue;
      const hb = getObstacleCollisionRect(obstacle);
      const sx = Math.floor(hb.x - this.camera.position.x);
      const sy = Math.floor(hb.y - this.camera.position.y);
      ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
      ctx.fillRect(sx, sy, hb.w, hb.h);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 0.5, sy - 0.5, hb.w + 1, hb.h + 1);
    }
  }

  drawPlayerHitboxDebug(ctx) {
    if (!this.debugDrawPlayerHitbox || !this.player) return;
    const pi = PLAYER_WALL_COLLISION_INSET;
    const pBase = Math.max(1, this.player.size - 2 * pi);
    const w = Math.max(1, pBase * 0.25);
    const h = Math.max(1, pBase * 0.5);
    const pxo = pi + (pBase - w) / 2;
    const pyo = pi + (pBase - h) / 2;
    const x = Math.floor(this.player.position.x + pxo - this.camera.position.x);
    const y = Math.floor(this.player.position.y + pyo - this.camera.position.y);
    ctx.fillStyle = "rgba(0, 255, 120, 0.18)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(0, 255, 120, 0.95)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }

  applyMagnetEffect(dt) {
    const radius = 160;
    const pullSpeed = 260;

    for (const item of this.lootSystem.items) {
      if ((item.age || 0) < 1.0) continue;
      if (item.burstFrom && item.burstProgress < 1) continue;
      const pos = item.displayPosition;
      const dx = this.player.position.x - pos.x;
      const dy = this.player.position.y - pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) {
        const dist = Math.sqrt(distSq) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        item.position.x += nx * pullSpeed * dt;
        item.position.y += ny * pullSpeed * dt;
      }
    }
  }

  updateUpgradeCardEffects(dt) {
    if (this.hasUpgradeCard("ironWill")) {
      this.ironSkinTimer += dt;
      if (this.ironSkinTimer >= 10 && !this.ironSkinShieldReady) {
        this.ironSkinShieldReady = true;
        this.ironSkinTimer = 0;
      }
    } else {
      this.ironSkinTimer = 0;
      this.ironSkinShieldReady = false;
    }

    if (this.hasUpgradeCard("ghostForm")) {
      if (this.ghostStepTimer > 0) {
        this.ghostStepTimer -= dt;
        if (this.ghostStepTimer < 0) this.ghostStepTimer = 0;
      }
    } else {
      this.ghostStepTimer = 0;
    }
  }

  drawTreasureSenseArrows(ctx) {
    if (!hasTalent("treasureSense")) return;
    const props = (this.searchableProps || []).filter((p) => !p.isSearched);
    if (props.length === 0) return;
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const cx = this.viewWidth / 2;
    const cy = this.viewHeight / 2;
    const edgePad = 22;
    const maxArrows = 6;

    const byDist = props
      .map((p) => {
        const tx = p.position.x + p.width / 2;
        const ty = p.position.y + p.height / 2;
        const dx = tx - px;
        const dy = ty - py;
        return { p, tx, ty, d2: dx * dx + dy * dy };
      })
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, maxArrows);

    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = "#f8fafc";
    for (const n of byDist) {
      const sx = n.tx - this.camera.position.x;
      const sy = n.ty - this.camera.position.y;
      if (sx >= 0 && sx <= this.viewWidth && sy >= 0 && sy <= this.viewHeight) continue;
      const vx = sx - cx;
      const vy = sy - cy;
      const len = Math.hypot(vx, vy) || 1;
      const ux = vx / len;
      const uy = vy / len;

      const rx = (this.viewWidth / 2 - edgePad) / Math.max(Math.abs(ux), 0.0001);
      const ry = (this.viewHeight / 2 - edgePad) / Math.max(Math.abs(uy), 0.0001);
      const t = Math.min(Math.abs(rx), Math.abs(ry));
      const ax = cx + ux * t;
      const ay = cy + uy * t;
      const ang = Math.atan2(uy, ux);
      const s = 9;

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.75, s * 0.55);
      ctx.lineTo(-s * 0.75, -s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  isNpcInteractable(obj) {
    if (!obj) return false;
    return (
      obj.type === "npcOldWoman" ||
      obj.type === "npcOldMan" ||
      obj.type === "npcPriest" ||
      obj.type === "npcSchemaMonk" ||
      obj.type === "npcElderSchemaMonk" ||
      obj.type === "npcEquipmentCollector" ||
      obj.type === "npcBlacksmith" ||
      obj.type === "npcRogue"
    );
  }

  drawNpcInteractable(ctx, obj, renderScale = 1) {
    const sx = obj.x - this.camera.position.x;
    const sy = obj.y - this.camera.position.y;
    const label = obj.npcName || "Wanderer";
    const npcWorldW = Math.max(1, Math.round(obj.npcWorldW || obj.w || 56));
    const npcWorldH = Math.max(1, Math.round(obj.npcWorldH || obj.h || 56));
    let drewSprite = false;
    let npcDebugText = "";

    if (this.roguesAtlas && this.roguesAtlas.complete && obj.spriteAtlas === "rogues") {
      const src = obj.spriteRect || { x: 0, y: 0, w: 32, h: 32 };
      const srcX = Math.max(0, src.x || 0);
      const srcY = Math.max(0, src.y || 0);
      const srcW = Math.max(1, src.w || 32);
      const srcH = Math.max(1, src.h || 32);
      const centerX = sx + (obj.w || npcWorldW) / 2;
      const footY = sy + (obj.h || npcWorldH);
      const dx = Math.floor(centerX - npcWorldW / 2);
      const dy = Math.floor(footY - npcWorldH);
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.globalAlpha = obj.used ? 0.55 : 0.95;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.roguesAtlas, srcX, srcY, srcW, srcH, dx, dy, npcWorldW, npcWorldH);
      ctx.imageSmoothingEnabled = prevSmoothing;
      ctx.globalAlpha = 1;
      const finalRenderW = Math.round(npcWorldW * renderScale);
      const finalRenderH = Math.round(npcWorldH * renderScale);
      npcDebugText = `${srcW}x${srcH}px | world ${npcWorldW}x${npcWorldH} | final ${finalRenderW}x${finalRenderH}`;
      drewSprite = true;
    } else {
      ctx.fillStyle = obj.used ? "#475569" : "#1e293b";
      ctx.globalAlpha = obj.used ? 0.3 : 0.6;
      ctx.fillRect(sx, sy, obj.w || npcWorldW, obj.h || npcWorldH);
      ctx.globalAlpha = 1;
    }

    if (this.debugDrawNpcScale && npcDebugText) {
      const textX = sx + (obj.w || npcWorldW) / 2;
      const textY = sy - 12;
      ctx.save();
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const textWidth = ctx.measureText(npcDebugText).width;
      const pad = 4;
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(textX - textWidth / 2 - pad, textY - 10, textWidth + pad * 2, 14);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(npcDebugText, textX, textY);
      ctx.restore();
    }

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = drewSprite ? "alphabetic" : "middle";
    ctx.fillStyle = obj.used ? "#94a3b8" : "#fff";
    const labelY = drewSprite ? (sy + (obj.h || npcWorldH) + 14) : (sy + (obj.h || npcWorldH) / 2);
    ctx.fillText(label, sx + (obj.w || npcWorldW) / 2, labelY);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  drawWorldActorsYSorted(ctx, renderScale = 1) {
    const actors = [];
    for (const obstacle of this.obstacles || []) {
      if (!obstacle || obstacle.destroyed) continue;
      actors.push({
        sortY: obstacle.position.y + (obstacle.size?.h || 0),
        draw: () => obstacle.draw(ctx, this.camera)
      });
    }
    for (const b of this.breakables || []) {
      if (!b || b.isDead) continue;
      actors.push({
        sortY: b.position.y + (b.hitbox?.h || b.size || 0),
        draw: () => b.draw(ctx, this.camera, this.time)
      });
    }
    for (const p of this.searchableProps || []) {
      if (!p || p.isSearched) continue;
      actors.push({
        sortY: p.position.y + (p.height || 0),
        draw: () => p.draw(ctx, this.camera, this.time)
      });
    }
    for (const obj of this.mapInteractables || []) {
      if (!this.isNpcInteractable(obj)) continue;
      actors.push({
        sortY: obj.y + (obj.h || obj.npcWorldH || 0),
        draw: () => this.drawNpcInteractable(ctx, obj, renderScale)
      });
    }
    for (const enemy of this.enemySystem?.enemies || []) {
      if (!enemy || enemy.isDead) continue;
      actors.push({
        sortY: enemy.position.y + (enemy.size || 0),
        draw: () => enemy.draw(ctx, this.camera, this.time)
      });
    }
    if (this.enemySystem?.boss && !this.enemySystem.boss.isDead) {
      const boss = this.enemySystem.boss;
      actors.push({
        sortY: boss.position.y + (boss.size || 0),
        draw: () => boss.draw(ctx, this.camera, this.time)
      });
    }
    if (this.player) {
      actors.push({
        sortY: this.player.position.y + this.player.size,
        draw: () => this.player.draw(ctx, this.camera, this.dashActive)
      });
    }

    actors.sort((a, b) => a.sortY - b.sortY);
    for (const actor of actors) actor.draw();
  }

  render() {
    const { ctx, canvas } = this;
    ctx.save();

    if (this.earthquakeShakeUntil > this.time) {
      const shake = 4;
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }
    if (this.cameraShakeUntil > this.time) {
      const fade = (this.cameraShakeUntil - this.time) / CAMERA_SHAKE_DURATION;
      const shake = this.cameraShakeAmount * fade;
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    const scaleX = canvas.width / this.viewWidth;
    const scaleY = canvas.height / this.viewHeight;
    const scale = Math.min(scaleX, scaleY);
    ctx.scale(scale, scale);

    this.world.draw(ctx, this.camera);

    if (this.hazardSystem) this.hazardSystem.draw(ctx, this.camera, this.time);
    this.lootSystem.draw(ctx, this.camera, this.time);
    this.drawWorldActorsYSorted(ctx, scale);
    this.drawObstacleHitboxDebug(ctx);
    this.drawPlayerHitboxDebug(ctx);
    if (this.searchingProp) {
      this.searchingProp.drawProgressBar(ctx, this.camera);
    }
    this.drawTreasureSenseArrows(ctx);
    for (const p of this.enemySystem?.projectiles || []) {
      p.draw(ctx, this.camera);
    }
    this.drawEnemyDeathSmokeVfx(ctx);
    
    // Draw tutorial highlights
    if (this.tutorialSystem) {
      this.tutorialSystem.render(ctx, this.camera);
    }

    if (this.victoryPortal) {
      const p = this.victoryPortal;
      const sx = p.x - this.camera.position.x;
      const sy = p.y - this.camera.position.y;
      const pulse = 0.6 + Math.sin(this.time * 8) * 0.2;
      ctx.fillStyle = `rgba(139, 92, 246, ${0.3 + pulse * 0.2})`;
      ctx.fillRect(sx, sy, p.w, p.h);
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.8 + pulse * 0.2})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(sx, sy, p.w, p.h);
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e9d5ff";
      ctx.fillText("PORTAL", sx + p.w / 2, sy + p.h / 2);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    for (const obj of this.mapInteractables) {
      if (this.isNpcInteractable(obj)) continue;
      const sx = obj.x - this.camera.position.x;
      const sy = obj.y - this.camera.position.y;
      const pulse = 0.7 + Math.sin(this.time * 4 + obj.x) * 0.15;
      let fill = "#60a5fa";
      let label = "?";
      let drewSprite = false;
      if (obj.type === "socketWorkshop") {
        fill = "#38bdf8";
        label = " Vessel";
      } else if (obj.type === "shop") {
        fill = "#22c55e";
        label = " Shop";
      } else if (obj.type === "foresightShrine") {
        fill = "#a78bfa";
        label = " Foresight";
      } else if (obj.type === "perfectionWorkshop") {
        fill = "#fbbf24";
        label = " Perfect";
      } else if (obj.type === "shrine") {
        fill = obj.used ? "#4b5563" : obj.shrineColor || "#60a5fa";
        label = obj.shrineIcon || "";
        // Draw aura for active shrines
        if (!obj.used && obj.shrineAuraColor) {
          const auraPulse = 0.3 + Math.sin(this.time * 3) * 0.2;
          ctx.globalAlpha = auraPulse;
          ctx.fillStyle = obj.shrineAuraColor;
          ctx.beginPath();
          ctx.arc(sx + obj.w / 2, sy + obj.h / 2, obj.w * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      if (!drewSprite) {
        ctx.fillStyle = fill;
        ctx.globalAlpha = obj.used ? 0.3 : (0.4 + pulse * 0.3);
        ctx.fillRect(sx, sy, obj.w, obj.h);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = obj.used ? "#64748b" : "#fff";
      ctx.lineWidth = 3;
      ctx.strokeRect(sx, sy, obj.w, obj.h);
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = obj.used ? "#94a3b8" : "#fff";
      ctx.fillText(label, sx + obj.w / 2, sy + obj.h / 2);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    if (this.nearInteractable) {
      const sx = this.viewWidth / 2 - 80;
      const sy = this.viewHeight - 50;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sx, sy, 160, 28);
      ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(sx, sy, 160, 28);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Press E to interact", this.viewWidth / 2, sy + 16);
      ctx.textAlign = "start";
    } else if (this.nearSearchableProp && !this.nearSearchableProp.isSearched && !this.searchingProp) {
      const sx = this.viewWidth / 2 - 90;
      const sy = this.viewHeight - 50;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sx, sy, 180, 28);
      ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(sx, sy, 180, 28);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Hold E to Search", this.viewWidth / 2, sy + 16);
      ctx.textAlign = "start";
    }

    if (this.dashTrail.length > 0) {
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < this.dashTrail.length; i++) {
        const t = this.dashTrail[i];
        const alpha = (i / this.dashTrail.length) * 0.4;
        const sx = Math.floor(t.x - this.camera.position.x);
        const sy = Math.floor(t.y - this.camera.position.y);
        ctx.globalAlpha = alpha;
        
        // Draw player sprite in trail (use walking sprite frame 0)
        const trailSprite = this.player.getTrailSpriteDrawData ? this.player.getTrailSpriteDrawData() : null;
        if (trailSprite && trailSprite.image) {
          ctx.drawImage(
            trailSprite.image,
            0, 0,
            trailSprite.frameWidth,
            trailSprite.frameHeight,
            sx, sy,
            this.player.size, this.player.size
          );
        } else {
          // Fallback to colored rectangle if sprite not loaded
          ctx.fillStyle = "#ffff4d";
          ctx.fillRect(sx, sy, this.player.size, this.player.size);
        }
      }
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
    }
    if (this.adrenalineTrail && this.adrenalineTrail.length > 0) {
      for (let i = 0; i < this.adrenalineTrail.length; i++) {
        const t = this.adrenalineTrail[i];
        const alpha = 0.15 + (i / this.adrenalineTrail.length) * 0.25;
        const sx = Math.floor(t.x - this.camera.position.x);
        const sy = Math.floor(t.y - this.camera.position.y);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(sx + 2, sy + 2, this.player.size - 4, this.player.size - 4);
      }
      ctx.globalAlpha = 1;
    }

    this.drawPlayerHealthBarAbovePlayer(ctx);
    this.drawDashChargesAbovePlayer(ctx);

    // Draw boss health bar on canvas (at top center of screen)
    this.drawBossHealthBar(ctx);


    // Paused overlay drawn on the canvas
    if (this.paused) {
      ctx.fillStyle = "rgba(5, 6, 10, 0.55)";
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      ctx.fillStyle = "#f5f7ff";
      ctx.font = "bold 36px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", this.viewWidth / 2, this.viewHeight / 2 - 60);
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("Press  Esc / P  or click Resume", this.viewWidth / 2, this.viewHeight / 2 - 16);
      
      // Store button positions for click detection
      const centerX = this.viewWidth / 2;
      const centerY = this.viewHeight / 2;
      const buttonWidth = 200;
      const buttonHeight = 40;
      const buttonY = centerY + 40;
      const buttonSpacing = 50;
      
      // Resume button
      this.pauseResumeButton = {
        x: centerX - buttonWidth / 2,
        y: buttonY,
        w: buttonWidth,
        h: buttonHeight
      };
      
      // Return to Main Menu button
      this.pauseMainMenuButton = {
        x: centerX - buttonWidth / 2,
        y: buttonY + buttonSpacing,
        w: buttonWidth,
        h: buttonHeight
      };
      
      // Draw Resume button
      ctx.fillStyle = "rgba(34, 197, 94, 0.2)";
      ctx.fillRect(this.pauseResumeButton.x, this.pauseResumeButton.y, buttonWidth, buttonHeight);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.pauseResumeButton.x, this.pauseResumeButton.y, buttonWidth, buttonHeight);
      ctx.fillStyle = "#86efac";
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Resume", centerX, buttonY + buttonHeight / 2);
      
      // Draw Return to Main Menu button
      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(this.pauseMainMenuButton.x, this.pauseMainMenuButton.y, buttonWidth, buttonHeight);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.pauseMainMenuButton.x, this.pauseMainMenuButton.y, buttonWidth, buttonHeight);
      ctx.fillStyle = "#fca5a5";
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Return to Main Menu", centerX, buttonY + buttonSpacing + buttonHeight / 2);
      
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    } else {
      this.pauseResumeButton = null;
      this.pauseMainMenuButton = null;
    }

    // Darkness condition: reduced vision radius
    if (this.hasCondition("darkness")) {
      const px = this.player.position.x + this.player.size / 2 - this.camera.position.x;
      const py = this.player.position.y + this.player.size / 2 - this.camera.position.y;
      const radius = 280;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.6, "rgba(0,0,0,0.4)");
      gradient.addColorStop(1, "rgba(0,0,0,0.95)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    for (const orb of this.pulseOrbs) {
      const sx = orb.x - this.camera.position.x;
      const sy = orb.y - this.camera.position.y;
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 8);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
      g.addColorStop(0, "#e0f2fe");
      g.addColorStop(0.5, "#7dd3fc");
      g.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, 14 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const proj of this.playerProjectiles) {
      proj.draw(ctx, this.camera);
    }

    // Floating combat text: on top of everything
    const camX = this.camera.position.x;
    const camY = this.camera.position.y;
    for (const entry of this.floatingCombatText) {
      const age = this.time - entry.t;
      if (age > 0.8) continue;
      const yOffset = age * 80;
      const alpha = 1 - age / 0.8;
      const sx = entry.x - camX + entry.offsetX;
      const sy = entry.y - camY - yOffset;

      let color = "#fff";
      let size = 16;
      if (entry.type === "crit") {
        color = "#facc15";
        size = 22;
      } else if (entry.type === "skill") {
        color = "#fb923c";
        size = 16;
      } else if (entry.type === "dot") {
        color = "#4ade80";
        size = 12;
      } else if (entry.type === "playerDamage") {
        color = "#ef4444";
        size = 18;
      } else if (entry.type === "heal") {
        color = "#22c55e";
        size = 18;
      }
      if (entry.isKillingBlow) size = Math.round(size * 1.25);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${entry.isKillingBlow ? "bold " : ""}${size}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(entry.text, sx, sy);
      ctx.restore();
    }

    this.drawAuraEffects(ctx);
    this.drawSkillEffects(ctx);
    renderFanStrikeVfx(ctx, this.camera);

    // Draw red screen flash when player takes damage
    if (this.damageFlashTimer > 0) {
      const alpha = (this.damageFlashTimer / 0.3) * 0.3; // Fade from 0.3 to 0
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      ctx.globalAlpha = 1;
    }

    // Draw VFX systems
    this.particlePool.draw(ctx, this.camera);
    this.transientVFX.draw(ctx, this.camera);
    this.drawPlayerDebuffVFX(ctx);

    ctx.restore();
  }
  
  drawDashChargesAbovePlayer(ctx) {
    const fullIcon = this.dashChargeIconFull;
    const emptyIcon = this.dashChargeIconEmpty;
    if (!fullIcon?.complete || !emptyIcon?.complete) return;

    const maxCharges = Math.max(1, this.dashMaxCharges || 1);
    const charges = Math.max(0, Math.min(maxCharges, this.dashCharges || 0));
    const iconSize = 14;
    const spacing = 2;
    const totalWidth = maxCharges * iconSize + (maxCharges - 1) * spacing;
    const playerCenterX = this.player.position.x + this.player.size / 2 - this.camera.position.x;
    const topY = this.player.position.y - this.camera.position.y - 28;
    const startX = Math.floor(playerCenterX - totalWidth / 2);
    const drawY = Math.floor(topY - iconSize);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < maxCharges; i++) {
      const icon = i < charges ? fullIcon : emptyIcon;
      const x = startX + i * (iconSize + spacing);
      ctx.drawImage(icon, x, drawY, iconSize, iconSize);
    }
    ctx.restore();
  }

  drawPlayerHealthBarAbovePlayer(ctx) {
    const maxHp = Math.max(1, this.currentStats?.maxHealth || 1);
    const hp = Math.max(0, Math.min(maxHp, this.currentHealth || 0));
    const pct = hp / maxHp;

    const barW = 48;
    const barH = 6;
    const playerCenterX = this.player.position.x + this.player.size / 2 - this.camera.position.x;
    const barX = Math.floor(playerCenterX - barW / 2);
    const barY = Math.floor(this.player.position.y - this.camera.position.y - 14);
    const fillW = Math.round(barW * pct);

    let fillColor = "#4ade80";
    if (pct <= 0.25) fillColor = "#ef4444";
    else if (pct <= 0.5) fillColor = "#facc15";

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(barX, barY, barW, barH);
    if (fillW > 0) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(barX, barY, fillW, barH);
    }
    ctx.strokeStyle = "rgba(248, 250, 252, 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);
    ctx.restore();
  }
  
  drawPlayerDebuffVFX(ctx) {
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    const debuffs = this.playerDebuffVFX;
    
    // Draw weakening shards
    if (this._weakeningShards) {
      for (const shard of this._weakeningShards) {
        if (shard.t < 0) continue;
        const progress = shard.t / shard.duration;
        const x = shard.startX + (shard.px - shard.startX) * progress;
        const y = shard.startY + (shard.py - shard.startY) * progress;
        const sx = Math.floor(x - this.camera.position.x);
        const sy = Math.floor(y - this.camera.position.y);
        const alpha = 1 - progress;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#8b5cf6";
        ctx.beginPath();
        ctx.arc(sx, sy, shard.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    
    // Weakening: purple aura
    if (debuffs.weakening.active) {
      ctx.save();
      ctx.strokeStyle = "rgba(139,92,246,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.floor(px - this.camera.position.x), Math.floor(py - this.camera.position.y), this.player.size / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    // Slow: pale-blue ring + rotating arcs
    if (debuffs.slow.active) {
      const sx = Math.floor(px - this.camera.position.x);
      const sy = Math.floor(py - this.camera.position.y);
      ctx.save();
      ctx.strokeStyle = "rgba(147,197,253,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, this.player.size / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
      
      // Rotating arcs
      const arcAngle = this.time * 2;
      for (let i = 0; i < 3; i++) {
        const a = arcAngle + (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, this.player.size / 2 + 6, a, a + Math.PI / 3);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    // Weaken: purple aura (crack lines drawn in update)
    if (debuffs.weaken.active) {
      ctx.save();
      ctx.strokeStyle = "rgba(139,92,246,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.floor(px - this.camera.position.x), Math.floor(py - this.camera.position.y), this.player.size / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    // Stun: yellow stars orbiting
    if (debuffs.stun.active) {
      const sx = Math.floor(px - this.camera.position.x);
      const sy = Math.floor(py - this.camera.position.y);
      const starRadius = this.player.size / 2 + 12;
      const starAngle = this.time * 4;
      ctx.save();
      ctx.fillStyle = "#facc15";
      for (let i = 0; i < 3; i++) {
        const a = starAngle + (i / 3) * Math.PI * 2;
        const starX = sx + Math.cos(a) * starRadius;
        const starY = sy + Math.sin(a) * starRadius;
        ctx.beginPath();
        ctx.arc(starX, starY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBossHealthBar(ctx) {
    const boss = this.enemySystem.boss;
    if (!boss || boss.isDead) return;

    const barWidth = 400;
    const barHeight = 20;
    let barX = (this.viewWidth - barWidth) / 2;
    let barY = 60; // Top of screen with some margin
    const padding = 8;
    const labelHeight = 14;

    // Apply shake effect when boss takes damage
    if (boss.healthBarShakeTimer > 0) {
      const shakeIntensity = boss.healthBarShakeTimer / 0.3; // Fade from 1 to 0
      const shakeAmount = 8 * shakeIntensity; // Max shake of 8 pixels
      // Use time-based oscillation for smoother shake
      const shakeX = Math.sin(this.time * 30) * shakeAmount;
      const shakeY = Math.cos(this.time * 25) * shakeAmount;
      barX += shakeX;
      barY += shakeY;
    }

    // Draw background box
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(barX - padding, barY - padding - labelHeight - 4, barWidth + padding * 2, barHeight + padding * 2 + labelHeight + 4);
    
    // Draw border
    ctx.strokeStyle = "#7f1d1d";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - padding, barY - padding - labelHeight - 4, barWidth + padding * 2, barHeight + padding * 2 + labelHeight + 4);

    // Draw health bar track (background)
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Calculate health percentage
    const pct = Math.max(0, boss.health / boss.maxHealth);
    
    // Draw health bar fill
    const fillColor = pct > 0.5 ? "#dc2626" : pct > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barWidth * pct, barHeight);

    // Draw health bar border
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Draw label (with shake offset applied)
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#fca5a5";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelText = `${boss.name}: ${Math.round(boss.health)} / ${boss.maxHealth}${boss.phase2 ? " (ENRAGED)" : ""}`;
    ctx.fillText(labelText, this.viewWidth / 2, barY - padding - labelHeight);
  }
  
  handleLootPickup(lootItem) {
    if (lootItem.type === "Cube" && lootItem.cubeKey) {
      this.addCubeToInventory(lootItem.cubeKey);
      if (hasTalent("secureFooting")) this.secureFootingUntil = this.time + 1;
      if (this.hasUpgradeCard("secureFooting")) this.swiftFeetTimer = 2.0;
      this.updateInventoryUI();
      return;
    }

    const newItem = {
      id: lootItem.id,
      name: lootItem.name,
      type: lootItem.type,
      stats: lootItem.stats || {},
      cardKey: lootItem.cardKey || null,
      description: lootItem.description || "",
      weight: lootItem.weight || null,
      rarity: lootItem.rarity || null,
      modifiers: lootItem.modifiers || [],
      baseStat: lootItem.baseStat || null,
      sockets: lootItem.sockets ?? 0
    };

    this.inventory.push(newItem);

    if (hasTalent("secureFooting")) this.secureFootingUntil = this.time + 1;
    if (hasTalent("ghostLooter")) this.ghostLooterUntargetableUntil = this.time + 0.5;
    const isRareOrBetter = lootItem.rarity === "rare" || lootItem.rarity === "legendary" || lootItem.rarity === "magic";
    if (hasTalent("phantomExtractor") && isRareOrBetter && this.time >= (this.phantomExtractorCooldownUntil || 0)) {
      this.phantomExtractorUntil = this.time + 3;
      this.phantomExtractorCooldownUntil = this.time + 20;
    }

    if (this.hasUpgradeCard("secureFooting")) {
      this.swiftFeetTimer = 2.0;
    }
    if (this.hasUpgradeCard("vampiric") && !this.hasCondition("noHealthDrops")) {
      this.healPlayer(5);
      const u = getSkillUnlocks();
      const count = (u.vampiricTriggers || 0) + 1;
      setSkillUnlock("vampiricTriggers", count);
    }

    this.updateInventoryUI();
  }

  generateLegendaryEquipment(type) {
    const baseKey = EQUIPMENT_BASE_STAT[type];
    const range = EQUIPMENT_BASE_RANGES[type];
    const baseValue = Math.round(range.min + (range.max - range.min) * 0.9);
    const baseStat = { [baseKey]: baseValue };
    const sec = EQUIPMENT_SECONDARY_BASE[type];
    if (sec) {
      const secValue = Math.round(sec.range.min + (sec.range.max - sec.range.min) * 0.9);
      baseStat[sec.statKey] = secValue;
    }
    const modifiers = [];
    const legPool = [...LEGENDARY_CUBES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 2; i++) {
      const c = legPool[i];
      modifiers.push({ id: c.modifierId, label: c.modifierLabel, statKey: null, value: 0, addedAt: Date.now() });
    }
    const pool = getModifierPoolForType(type).sort(() => Math.random() - 0.5);
    const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
    for (let i = 0; i < 2; i++) {
      const m = pool[i];
      const val = LOCAL_STAT_SCALE_MOD_IDS.includes(m.id) ? rollLocalStatScaleValueForDifficulty(diff) : rollModifierValueForDifficulty(diff, m.id);
      modifiers.push({ id: m.id, label: m.label, statKey: m.statKey, value: val, addedAt: Date.now() });
    }
    const baseNames = EQUIPMENT_BASE_NAMES[type];
    const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
    const name = `Legendary ${baseName}`;
    const stats = { ...baseStat };
    for (const m of modifiers) {
      if (LEGENDARY_MODIFIER_IDS.includes(m.id)) continue;
      if (m.id === "defenseStatScale") stats.defense = Math.round((stats.defense || 0) * (1 + m.value));
      else if (m.id === "maxHealthStatScale") stats.maxHealth = Math.round((stats.maxHealth || 0) * (1 + m.value));
      else if (m.statKey === "attackSpeed") stats.attackSpeed = (stats.attackSpeed || 1) * (1 + m.value);
      else if (m.statKey === "cooldownRecovery") stats.cooldownRecovery = (stats.cooldownRecovery || 1) * (1 - m.value);
      else if (m.statKey) {
        const key = ["attack", "maxHealth", "defense", "speed"].includes(m.statKey) ? `${m.statKey}Percent` : m.statKey;
        stats[key] = (stats[key] || 0) + m.value;
      }
    }
    return { type, name, rarity: "legendary", baseStat, modifiers, stats, sockets: 0 };
  }

  addCubeToInventory(cubeKey) {
    if (hasTalent("cubeExpert")) {
      const match = cubeKey.match(/^(.+?)T1$/);
      if (match && MODIFIER_CUBES.some((c) => cubeKey.startsWith(c.id))) {
        cubeKey = match[1] + "T2";
      }
    }
    this.cubeInventory[cubeKey] = (this.cubeInventory[cubeKey] || 0) + 1;
    if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
    if (hasTalent("tinkerersEye") && Math.random() < 0.15) {
      const tierMatch = cubeKey.match(/T(\d)$/);
      const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
      const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
      const cube = allCubes[Math.floor(Math.random() * allCubes.length)];
      const bonusKey = tierMatch ? `${cube.id}T${tier}` : cube.id;
      this.cubeInventory[bonusKey] = (this.cubeInventory[bonusKey] || 0) + 1;
    }
  }

  tryDropCubeFromEnemy(enemy) {
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const isMiniBoss = !!(enemy.enemyTier === "miniBoss" || enemy.isFiery || enemy.isCursedChestGuardian);
    const isElite = !!(enemy.enemyTier === "elite" || enemy.isElite);
    let dropMult = this.hasBlessing("fortune") ? 2 : 1;
    if (hasTalent("cubeMagnet")) dropMult *= 1.2;

    const allCubes = [...MODIFIER_CUBES, ...UPGRADE_CUBES];
    const upgradeCubes = [...UPGRADE_CUBES];
    const magicRareCubes = UPGRADE_CUBES.filter((c) => c.id === "magicCube" || c.id === "rareCube");
    const pickRandomCube = (tier) => {
      let cube;
      if (hasTalent("transmuter") && magicRareCubes.length > 0 && Math.random() < 0.2) {
        cube = magicRareCubes[Math.floor(Math.random() * magicRareCubes.length)];
      } else {
        cube = allCubes[Math.floor(Math.random() * allCubes.length)];
      }
      this.lootSystem.spawnCubeAt(ex, ey, `${cube.id}T${tier}`);
    };

    if (isMiniBoss) {
      if (hasTalent("rarityRush") && this.difficulty >= 3 && Math.random() < 0.05) {
        const cube = LEGENDARY_CUBES[Math.floor(Math.random() * LEGENDARY_CUBES.length)];
        this.lootSystem.spawnCubeAt(ex, ey, cube.id);
      }
      if (Math.random() < 0.05 * dropMult) pickRandomCube(3);
    } else if (isElite) {
      if (Math.random() < 0.1 * dropMult) pickRandomCube(2);
    } else {
      if (Math.random() < 0.5 * dropMult) pickRandomCube(1);
    }
  }

  healPlayer(amount) {
    this.currentHealth = Math.min(
      this.currentHealth + amount,
      this.currentStats.maxHealth
    );
    const px = this.player.position.x + this.player.size / 2;
    const py = this.player.position.y + this.player.size / 2;
    this.addFloatingText(px, py, `+${Math.round(amount)}`, "heal");
    this.updateStatsUI();
    this.updateHealthBar();
  }

  addFloatingText(worldX, worldY, text, type, isKillingBlow = false) {
    this.floatingCombatText.push({
      x: worldX,
      y: worldY,
      text: String(text),
      type: type || "normal",
      t: this.time,
      isKillingBlow: !!isKillingBlow,
      offsetX: (Math.random() - 0.5) * 24
    });
  }

  updateHealthBar() {
    const bar = document.getElementById("player-health-fill");
    const label = document.getElementById("player-health-label");
    if (!bar || !label) return;
    const pct = this.currentStats.maxHealth > 0
      ? Math.max(0, this.currentHealth / this.currentStats.maxHealth)
      : 0;
    bar.style.width = `${Math.round(pct * 100)}%`;
    label.textContent = `${Math.round(this.currentHealth)} / ${this.currentStats.maxHealth}`;
    bar.style.backgroundColor =
      pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
  }

  updateDashUI() {
    const fill = document.getElementById("dash-cooldown-fill");
    const label = document.getElementById("dash-label");
    if (!fill || !label) return;
    const maxCharges = Math.max(1, this.dashMaxCharges || 2);
    const charges = Math.max(0, Math.min(maxCharges, this.dashCharges ?? maxCharges));
    const partial = charges < maxCharges && this.dashCooldownTime > 0
      ? (1 - Math.max(0, this.dashCooldown) / this.dashCooldownTime)
      : 0;
    const pct = Math.max(0, Math.min(1, (charges + partial) / maxCharges));
    fill.style.width = `${Math.round(pct * 100)}%`;
    label.textContent = charges >= maxCharges
      ? `${charges}/${maxCharges}`
      : `${charges}/${maxCharges} (${Math.round(this.dashCooldown * 10) / 10}s)`;
  }

  hasUpgradeCard(key) {
    return hasTalent(key);
  }

  getProjectileShotEvolution() {
    const evoId = this.weaponEvolutions?.ProjectileShot;
    if (!evoId) return null;
    return getAttackEvolutionById(evoId);
  }

  getProjectileShotEvolutionOverrides() {
    return this.getProjectileShotEvolution()?.overrides || null;
  }

  hasAttackUpgrade(id) {
    return (this.runAttackUpgrades || []).some((u) => u.id === id);
  }

  getAttackUpgradeValue(id) {
    const u = (this.runAttackUpgrades || []).find((x) => x.id === id);
    if (!u || u.value === undefined) return 0;
    return u.percent ? u.value / 100 : u.value;
  }

  hasAttackPenalty(id) {
    return (this.runAttackPenalties || []).some((p) => p.id === id);
  }

  getAttackPenaltyValue(id) {
    const p = (this.runAttackPenalties || []).find((x) => x.id === id);
    if (!p || p.value === undefined) return 0;
    return p.percent ? p.value / 100 : p.value;
  }

  hasBlessing(id) {
    return this.activeBlessings.some((b) => b.id === id && b.until > this.time);
  }

  updateBlessings(dt) {
    this.activeBlessings = this.activeBlessings.filter((b) => b.until > this.time);
    this.updateBlessingsUI();
    if (this.hasBlessing("vitality")) {
      this.healPlayer(30 * dt);
    }
    if (this.hasBlessing("chaos") && Math.floor(this.time * 4) > Math.floor((this.time - dt) * 4)) {
      const px = this.player.position.x + this.player.size / 2;
      const py = this.player.position.y + this.player.size / 2;
      const angle = Math.random() * Math.PI * 2;
      const dist = 400;
      const tx = px + Math.cos(angle) * dist;
      const ty = py + Math.sin(angle) * dist;
      const damage = this.computePlayerDamage(null);
      const proj = new PlayerProjectile(px - PLAYER_PROJECTILE_SIZE / 2, py - PLAYER_PROJECTILE_SIZE / 2, tx, ty, damage);
      if (this.hasUpgradeCard("homing")) proj.maxLifetime = 3;
      proj.piercing = !!this.hasUpgradeCard("piercing");
      this.playerProjectiles.push(proj);
    }
  }

  updateBlessingsUI() {
    const el = document.getElementById("blessings-bar");
    if (!el) return;
    const active = this.activeBlessings.filter((b) => b.until > this.time);
    if (active.length === 0) {
      el.innerHTML = "";
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML = active.map((b) => {
      const secs = Math.ceil(b.until - this.time);
      return `<span class="blessing-buff" title="${b.name}: ${b.desc}" style="background:${b.color}20;border-color:${b.color}">${b.icon} ${secs}s</span>`;
    }).join("");
  }

  // ---- Inventory & equipment UI ----

  updateInventoryUI() {
    if (!this.inventoryListEl) return;
    this.inventoryListEl.innerHTML = "";

    if (this.inventory.length === 0) {
      const li = document.createElement("li");
      li.className = "inventory-empty";
      li.textContent = "No items collected";
      this.inventoryListEl.appendChild(li);
      return;
    }

    for (const item of this.inventory) {
      const li = document.createElement("li");
      li.className = "inventory-item";

      const equippable = this.isItemEquippable(item) || this.isUpgradeCard(item);
      if (!equippable) li.classList.add("inventory-item--non-equippable");

      const nameSpan = document.createElement("span");
      nameSpan.className = "inventory-item-name" + (item.rarity === "legendary" ? " inventory-item-legendary" : "");
      nameSpan.style.color = getItemRarityColor(item);
      nameSpan.textContent = item.name;

      const typeSpan = document.createElement("span");
      typeSpan.className = "inventory-item-type";
      typeSpan.textContent = item.type;

      li.appendChild(nameSpan);
      li.appendChild(typeSpan);

      if (equippable) {
        li.title =
          item.type === "Upgrade Card"
            ? "Click to equip upgrade card"
            : "Click to equip";
      }

      li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
      li.addEventListener("mouseleave", hideItemTooltip);
      li.addEventListener("click", () => this.handleInventoryItemClick(item));
      this.inventoryListEl.appendChild(li);
    }
  }

  isItemEquippable(item) {
    return (
      item.type === "Helmet" ||
      item.type === "Boots" ||
      item.type === "Body Armour" ||
      item.type === "Weapon"
    );
  }

  isUpgradeCard(_item) {
    return false;
  }

  handleInventoryItemClick(item) {
    const index = this.inventory.indexOf(item);
    if (index === -1) return;

    if (this.isUpgradeCard(item)) {
      this.equipUpgradeCardAtIndex(index);
    } else if (this.isItemEquippable(item)) {
      const slot = item.type;
      const currentlyEquipped = this.equipment[slot];
      if (currentlyEquipped) this.inventory.push(currentlyEquipped);
      this.equipment[slot] = item;
      this.inventory.splice(index, 1);
      this.updateInventoryUI();
      this.updateEquippedUI();
      this.recalculateStats();
      if (this.inventoryOverlayOpen) this.populateInventoryOverlay();
    }
  }

  equipUpgradeCardAtIndex(_index) {
    // Upgrade cards removed
  }

  updateEquippedUI() {
    if (!this.equippedListEl) return;
    this.equippedListEl.innerHTML = "";

    const slots = ["Helmet", "Body Armour", "Weapon", "Boots"];
    for (const slot of slots) {
      const li = document.createElement("li");
      li.className = "equipped-item";

      const slotLabel = document.createElement("div");
      slotLabel.className = "equipped-slot-label";
      slotLabel.textContent = slot;

      const nameDiv = document.createElement("div");
      nameDiv.className = "equipped-item-name";
      const item = this.equipment[slot];
      if (item) {
        nameDiv.style.color = getItemRarityColor(item);
        nameDiv.textContent = item.name;
      } else {
        nameDiv.textContent = "None";
      }

      if (item) {
        li.addEventListener("mouseenter", (e) => showItemTooltip(e, item, this));
        li.addEventListener("mouseleave", hideItemTooltip);
      }

      li.appendChild(slotLabel);
      li.appendChild(nameDiv);
      this.equippedListEl.appendChild(li);
    }
  }

  recalculateStats() {
    if (this.devStatsOverride) {
      this.currentStats = { ...this.devStatsOverride };
      this.currentHealth = Math.min(this.currentHealth, this.currentStats.maxHealth);
      this.updateStatsUI();
      this.updateHealthBar();
      return;
    }
    const stats = { ...this.baseStats };
    const percentMods = { attack: 0, maxHealth: 0, defense: 0, speed: 0, xpGained: 0, skillDamage: 0 };
    let equipmentAttackSpeedMult = 1;
    let equipmentCooldownRecovery = 1;
    let equipmentSpeedPenalty = 0;
    let hasHeavyArmour = false;
    const WEIGHT_PENALTIES = { light: 0, medium: 0.1, heavy: 0.15 };
    for (const slot of Object.keys(this.equipment)) {
      const item = this.equipment[slot];
      if (!item || !item.stats) continue;
      if ((slot === "Helmet" || slot === "Body Armour") && item.weight) {
        equipmentSpeedPenalty += WEIGHT_PENALTIES[item.weight] || 0;
        if (item.weight === "heavy") hasHeavyArmour = true;
      }
      for (const [k, v] of Object.entries(item.stats)) {
        if (k === "attackSpeed") {
          equipmentAttackSpeedMult *= v;
        } else if (k === "cooldownRecovery") {
          equipmentCooldownRecovery *= v;
        } else if (k === "attackPercent" || k === "maxHealthPercent" || k === "defensePercent" || k === "speedPercent") {
          const baseKey = k.replace("Percent", "");
          percentMods[baseKey] = (percentMods[baseKey] || 0) + v;
        } else if (k === "xpGainedPercent") {
          percentMods.xpGained += v;
        } else if (k === "skillDamagePercent") {
          percentMods.skillDamage += v;
        } else {
          stats[k] = (stats[k] || 0) + v;
        }
      }
    }
    this.equipmentAttackSpeedMult = equipmentAttackSpeedMult;
    this.equipmentCooldownRecovery = equipmentCooldownRecovery;
    this.equipmentXpGainedMult = 1 + (percentMods.xpGained || 0);
    this.equipmentSkillDamageMult = 1 + (percentMods.skillDamage || 0);
    equipmentSpeedPenalty = Math.max(0, Math.min(0.95, equipmentSpeedPenalty));
    this.equipmentSpeedMult = 1 - equipmentSpeedPenalty;
    this.equipmentDashCooldownMult = hasHeavyArmour ? 1.2 : 1;
    this.dashCooldownTime = this.baseDashCooldownTime * this.equipmentDashCooldownMult;
    for (const key of ["attack", "maxHealth", "defense", "speed"]) {
      const pct = percentMods[key] || 0;
      if (pct !== 0) stats[key] = Math.round((stats[key] || 0) * (1 + pct));
    }
    if (hasTalent("fortified")) stats.defense = Math.round((stats.defense || 0) * 1.2);
    if (hasTalent("bulwark")) stats.defense = Math.round((stats.defense || 0) * 1.1);
    if (hasTalent("thickSkin")) stats.defense = Math.round((stats.defense || 0) * 1.1);
    stats.maxHealth = Math.round(stats.maxHealth);
    stats.speed = Math.round(stats.speed);
    stats.attack = Math.round(stats.attack);
    if (hasTalent("ironFist")) stats.attack = Math.round(stats.attack * 1.1);
    if (hasTalent("synergyMaster")) {
      const sockets = getSkillModSockets();
      let count = 0;
      const slots = this.skills || [];
      for (let i = 0; i < slots.length; i++) {
        const skillId = slots[i];
        if (!skillId) continue;
        const arr = sockets[skillId];
        if (Array.isArray(arr) && arr.some((c) => c)) count++;
      }
      const filled = (this.skills || []).filter(Boolean).length;
      const allFour = filled >= 4 && count >= 4;
      const mult = 1 + count * (allFour ? 0.1 : 0.06);
      stats.attack = Math.round(stats.attack * mult);
    }
    if (hasTalent("grandSocketeer")) {
      const sockets = getSkillModSockets();
      let hasAny = false;
      for (const skillId of (this.skills || [])) {
        if (!skillId) continue;
        const arr = sockets[skillId];
        if (Array.isArray(arr) && arr.some((c) => c)) { hasAny = true; break; }
      }
      if (hasAny) stats.attack = Math.round(stats.attack * 1.5);
    }
    this.currentStats = stats;
    this.currentHealth = Math.min(this.currentHealth, stats.maxHealth);
    this.updateStatsUI();
    this.updateHealthBar();
  }

  updateStatsUI() {
    if (!this.playerStatsEl) return;
    const stats = this.currentStats;
    this.playerStatsEl.innerHTML = "";

    const spdMult = this.equipmentSpeedMult ?? 1;
    const baseSpeed = Math.round(stats.speed);
    const effectiveArmourSpeed = Math.round(baseSpeed * spdMult);
    const speedLabel = spdMult < 1 ? `${effectiveArmourSpeed} (${baseSpeed} base)` : `${baseSpeed}`;
    const rows = [
      ["Health", `${Math.round(this.currentHealth)}/${stats.maxHealth}`],
      ["Defense", `${stats.defense}`],
      ["Speed", speedLabel],
      ["Attack", `${stats.attack}`]
    ];
    const atkSpd = this.equipmentAttackSpeedMult || 1;
    const cdRec = this.equipmentCooldownRecovery ?? 1;
    const dashCd = this.equipmentDashCooldownMult ?? 1;
    if (atkSpd !== 1) rows.push(["Atk Spd", `+${Math.round((atkSpd - 1) * 100)}%`]);
    if (cdRec !== 1) rows.push(["CD Rec", `${Math.round((1 - cdRec) * 100)}% less`]);
    if (spdMult < 1) rows.push(["Armour", `-${Math.round((1 - spdMult) * 100)}% speed`]);
    if (dashCd > 1) rows.push(["Dash CD", `+${Math.round((dashCd - 1) * 100)}%`]);

    for (const [label, value] of rows) {
      const labelEl = document.createElement("div");
      labelEl.className = "player-stat-label";
      labelEl.textContent = label;

      const valueEl = document.createElement("div");
      valueEl.className = "player-stat-value";
      valueEl.textContent = value;

      this.playerStatsEl.appendChild(labelEl);
      this.playerStatsEl.appendChild(valueEl);
    }
  }

  // ---- Dev helpers ----

  spawnUpgradeCardToInventory(_cardDef) {
    // Upgrade cards removed
  }

  handleDevGiveAllCards() {
    // Upgrade cards removed
  }

  handleDevGiveAllCubes() {
    for (const cube of MODIFIER_CUBES) {
      for (let t = 1; t <= 3; t++) this.addCubeToInventory(`${cube.id}T${t}`);
    }
    for (const cube of UPGRADE_CUBES) {
      for (let t = 1; t <= 3; t++) this.addCubeToInventory(`${cube.id}T${t}`);
    }
    for (const cube of LEGENDARY_CUBES) {
      this.addCubeToInventory(cube.id);
    }
  }

  handleDevRandomItem() {
    const types = ["Helmet", "Body Armour", "Weapon", "Boots"];
    const type = types[Math.floor(Math.random() * types.length)];
    const forceRarity = Math.random() < 0.5 ? "magic" : "rare";
    const lootQuality = this.currentMap?.lootQuality ?? 0.5;
    const diff = Math.min(5, Math.max(1, this.difficulty ?? 1));
    const def = generateEquipmentItem(type, lootQuality, 0.5, forceRarity, { difficulty: diff });
    this.inventory.push({
      id: 70000 + Math.floor(Math.random() * 10000),
      name: def.name,
      type: def.type,
      stats: def.stats || {},
      cardKey: null,
      description: "",
      weight: def.weight || null,
      rarity: def.rarity || null,
      modifiers: def.modifiers || [],
      baseStat: def.baseStat || null
    });
    this.updateInventoryUI();
  }

  handleDevMaxStats() {
    this.devStatsOverride = {
      maxHealth: 999,
      currentHealth: 999,
      defense: 100,
      speed: 600,
      attack: 200
    };
    this.currentHealth = 999;
    this.recalculateStats();
    this.initDevStatsSliders();
  }

  initDevStatsSliders() {
    const container = document.getElementById("dev-stats-sliders");
    if (!container) return;
    const stats = this.devStatsOverride || { ...this.currentStats };
    const ranges = [
      { key: "maxHealth", label: "Max Health", min: 1, max: 999 },
      { key: "currentHealth", label: "Current Health", min: 0, max: 999 },
      { key: "defense", label: "Defense", min: 0, max: 100 },
      { key: "speed", label: "Speed", min: 50, max: 600 },
      { key: "attack", label: "Attack", min: 1, max: 200 }
    ];
    container.innerHTML = "";
    for (const r of ranges) {
      const val = r.key === "currentHealth" ? this.currentHealth : (stats[r.key] ?? 0);
      const row = document.createElement("div");
      row.className = "dev-stat-row";
      const label = document.createElement("label");
      label.textContent = r.label;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = r.min;
      slider.max = r.max;
      slider.value = Math.round(val);
      slider.className = "dev-stat-slider";
      const valueSpan = document.createElement("span");
      valueSpan.className = "dev-stat-value";
      valueSpan.textContent = Math.round(val);
      slider.addEventListener("input", () => {
        const v = Number(slider.value);
        valueSpan.textContent = Math.round(v);
        if (!this.devStatsOverride) {
          this.devStatsOverride = { ...this.currentStats };
        }
        if (r.key === "currentHealth") {
          this.currentHealth = v;
        } else {
          this.devStatsOverride[r.key] = v;
        }
        this.recalculateStats();
      });
      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(valueSpan);
      container.appendChild(row);
    }
  }

  setupTutorialMap() {
    // Tutorial map setup: spawn specific enemies and items for tutorial steps
    // Note: Enemy for combat tutorial (step 3) will be spawned after step 2 (Dash) completes
    
    // Give player some XP to help with level up step
    // We'll add more enemies after first kill if needed
    this.tutorialEnemiesKilled = 0;
    this.tutorialFirstEnemyKilled = false; // Track if first tutorial enemy has been killed
    
    // Start tutorial after a short delay
    setTimeout(() => {
      if (this.tutorialSystem) {
        this.tutorialSystem.start();
      }
    }, 500);
  }
  
  // Spawn additional tutorial enemies after first kill (for level up step)
  spawnTutorialEnemyForLevelUp() {
    if (!this.tutorialMode) return;
    
    const margin = this.world.wallThickness + 60;
    const centerX = this.world.width / 2;
    const centerY = this.world.height / 2;
    
    // Spawn 2-3 more weak enemies to help player level up
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const dist = 200;
      const enemyX = centerX + Math.cos(angle) * dist;
      const enemyY = centerY + Math.sin(angle) * dist;
      
      const baseEnemy = ENEMY_TYPES[0];
      const tutorialEnemy = new Enemy(enemyX, enemyY, {
        ...baseEnemy,
        maxHealth: 15,
        attack: baseEnemy.attack * 0.5,
        speed: baseEnemy.speed * 0.7,
        size: baseEnemy.size
      });
      tutorialEnemy.worldBounds = { width: this.world.width, height: this.world.height };
      tutorialEnemy.enemyTier = "minion";
      tutorialEnemy.tierXpMult = 0.7;
      tutorialEnemy.activated = true;
      this.enemySystem.enemies.push(tutorialEnemy);
    }
  }
}

// Apply mixin modules
applyGameCoreMixin(Game);
applyGameDevMixin(Game);
applyGameInventoryMixin(Game);
applyGameVictoryMixin(Game);
applyGameStatsMixin(Game);
applyGameUIMixin(Game);
applyGameLevelUpMixin(Game);
applyGameInputMixin(Game);
applyGameLootMixin(Game);
applyGameCollisionMixin(Game);
applyGameMapMixin(Game);
applyGameEventsMixin(Game);
applyGameEnemyAttacksMixin(Game);












