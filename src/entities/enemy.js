import { Vec2 } from '../utils.js';
import { pointToSegmentDist } from '../utils.js';
import { getWallCollisionRect, getObstacleCollisionRect, obstacleIntersectsRect } from '../utils.js';
import { getHumanSquadTypeDef, HUMAN_SQUAD_ENEMY_IDS } from '../data/human-squad-data.js';
import {
  createHumanSquadAnimState,
  setHumanSquadAnimState,
  updateHumanSquadAnim,
  getHumanSquadAnimFrame,
  loadHumanSquadSheets,
} from './human-squad-anim.js';

loadHumanSquadSheets();

// Archetype to color mapping
const ARCHETYPE_COLORS = {
  "Slime": "#4ade80",
  "Bat": "#c084fc",
  "Skeleton": "#e2e8f0",
  "Demon": "#f87171",
  "Wisp": "#67e8f9"
};

// XP band mapping
const XP_BAND_MAP = {
  "basic": { minXp: 10, maxXp: 20 },
  "elite_like": { minXp: 30, maxXp: 50 }
};

// Drop band mapping
const DROP_BAND_MAP = {
  "low": { dropChance: 0.2, minDrop: 1, maxDrop: 1 },
  "mid": { dropChance: 0.45, minDrop: 1, maxDrop: 2 },
  "high": { dropChance: 0.55, minDrop: 1, maxDrop: 2 }
};

// Convert new enemy data format to old format
function convertEnemyData(enemyData) {
  return {
    id: enemyData.id,
    name: enemyData.name,
    color: ARCHETYPE_COLORS[enemyData.archetype] || "#94a3b8",
    size: enemyData.base.size,
    maxHealth: enemyData.base.hp,
    attack: enemyData.base.atk,
    speed: enemyData.base.speed,
    defense: enemyData.base.def,
    ...XP_BAND_MAP[enemyData.xpBand] || XP_BAND_MAP.basic,
    ...DROP_BAND_MAP[enemyData.dropBand] || DROP_BAND_MAP.mid,
    // Store additional metadata
    atlas: enemyData.atlas,
    archetype: enemyData.archetype,
    attackStyle: enemyData.attackStyle,
    xpBand: enemyData.xpBand,
    dropBand: enemyData.dropBand,
    notes: enemyData.notes
  };
}

// New enemy database
const NEW_ENEMY_DATA = [
  // Row 1  Orc/Goblin set (humanoid minions)
  {"id":"m_1a_orc","name":"Orc","atlas":{"row":1,"col":"a"},"archetype":"Skeleton","base":{"size":86,"hp":60,"atk":10,"speed":70,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Baseline bruiser. Good affixes: Volatile, Weakening."},
  {"id":"m_1b_orc_wizard","name":"Orc Wizard","atlas":{"row":1,"col":"b"},"archetype":"Wisp","base":{"size":72,"hp":26,"atk":7,"speed":110,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Caster minion. Good affixes: Lasering, Cursing."},
  {"id":"m_1c_goblin","name":"Goblin","atlas":{"row":1,"col":"c"},"archetype":"Bat","base":{"size":72,"hp":25,"atk":8,"speed":100,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Fast skirmisher."},
  {"id":"m_1d_orc_blademaster","name":"Orc Blademaster","atlas":{"row":1,"col":"d"},"archetype":"Skeleton","base":{"size":86,"hp":55,"atk":11,"speed":85,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Faster undead-tier melee."},
  {"id":"m_1e_orc_warchief","name":"Orc Warchief","atlas":{"row":1,"col":"e"},"archetype":"Demon","base":{"size":103,"hp":95,"atk":15,"speed":55,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Leader brute. Great as Elite/Mini-boss."},
  {"id":"m_1f_goblin_archer","name":"Goblin Archer","atlas":{"row":1,"col":"f"},"archetype":"Bat","base":{"size":72,"hp":22,"atk":7,"speed":105,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"low","notes":"Ranged poke. Works with Volatile for bullet hell moments."},
  {"id":"m_1g_goblin_mage","name":"Goblin Mage","atlas":{"row":1,"col":"g"},"archetype":"Wisp","base":{"size":72,"hp":24,"atk":6,"speed":120,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Glass cannon caster. Great with Lasering."},
  {"id":"m_1h_goblin_brute","name":"Goblin Brute","atlas":{"row":1,"col":"h"},"archetype":"Skeleton","base":{"size":86,"hp":70,"atk":10,"speed":65,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Slow-ish bruiser."},

  // Row 2  Giants
  {"id":"m_2a_ettin","name":"Ettin","atlas":{"row":2,"col":"a"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":14,"speed":50,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Big threat. Great as Elite/Mini-boss."},
  {"id":"m_2b_two_headed_ettin","name":"Two-Headed Ettin","atlas":{"row":2,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":52,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Stronger ettin variant. Perfect Mini-boss."},
  {"id":"m_2c_troll","name":"Troll","atlas":{"row":2,"col":"c"},"archetype":"Demon","base":{"size":103,"hp":90,"atk":13,"speed":58,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Tanky brawler. Good with Regenerating + Weakening."},

  // Row 3  Slimes
  {"id":"m_3a_small_slime","name":"Small Slime","atlas":{"row":3,"col":"a"},"archetype":"Slime","base":{"size":86,"hp":40,"atk":6,"speed":60,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Baseline slime."},
  {"id":"m_3b_big_slime","name":"Big Slime","atlas":{"row":3,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":80,"atk":9,"speed":55,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Bigger slime tank."},
  {"id":"m_3c_slimebody","name":"Slimebody","atlas":{"row":3,"col":"c"},"archetype":"Skeleton","base":{"size":86,"hp":55,"atk":9,"speed":70,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Humanoid slime. Good with Volatile."},
  {"id":"m_3d_merged_slimebodies","name":"Merged Slimebodies","atlas":{"row":3,"col":"d"},"archetype":"Demon","base":{"size":103,"hp":95,"atk":12,"speed":52,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite slime amalgam."},

  // Row 4  Cleric/Monk types
  {"id":"m_4a_faceless_monk","name":"Faceless Monk","atlas":{"row":4,"col":"a"},"archetype":"Bat","base":{"size":72,"hp":30,"atk":8,"speed":115,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast striker. Good with Orbiting."},
  {"id":"m_4b_unholy_cardinal","name":"Unholy Cardinal","atlas":{"row":4,"col":"b"},"archetype":"Wisp","base":{"size":72,"hp":35,"atk":9,"speed":95,"def":1},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"mid","notes":"Support caster feel. Great with Weakening/Cursing."},

  // Row 5  Undead set
  {"id":"m_5a_skeleton","name":"Skeleton","atlas":{"row":5,"col":"a"},"archetype":"Skeleton","base":{"size":86,"hp":60,"atk":10,"speed":70,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Your existing Skeleton baseline."},
  {"id":"m_5b_skeleton_archer","name":"Skeleton Archer","atlas":{"row":5,"col":"b"},"archetype":"Skeleton","base":{"size":86,"hp":55,"atk":9,"speed":75,"def":2},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"mid","notes":"Ranged skeleton. Great with Volatile."},
  {"id":"m_5c_lich","name":"Lich","atlas":{"row":5,"col":"c"},"archetype":"Demon","base":{"size":86,"hp":85,"atk":12,"speed":60,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Caster boss-lite. Great with Lasering."},
  {"id":"m_5d_death_knight","name":"Death Knight","atlas":{"row":5,"col":"d"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":50,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Top-tier melee. Perfect Mini-boss."},
  {"id":"m_5e_zombie","name":"Zombie","atlas":{"row":5,"col":"e"},"archetype":"Slime","base":{"size":86,"hp":70,"atk":8,"speed":55,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Slow tank. Good with Volatile/Orbiting."},
  {"id":"m_5f_ghoul","name":"Ghoul","atlas":{"row":5,"col":"f"},"archetype":"Bat","base":{"size":72,"hp":38,"atk":9,"speed":110,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast undead. Great with Cursing."},

  // Row 6  Ghosts/Cult
  {"id":"m_6a_banshee","name":"Banshee","atlas":{"row":6,"col":"a"},"archetype":"Wisp","base":{"size":72,"hp":22,"atk":6,"speed":125,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast ethereal. Great with Lasering."},
  {"id":"m_6b_reaper","name":"Reaper","atlas":{"row":6,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":90,"atk":15,"speed":55,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite assassin. Great with Weakening/Cursing."},
  {"id":"m_6c_wraith","name":"Wraith","atlas":{"row":6,"col":"c"},"archetype":"Wisp","base":{"size":72,"hp":20,"atk":5,"speed":130,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Your existing Wisp-like baseline."},
  {"id":"m_6d_cultist","name":"Cultist","atlas":{"row":6,"col":"d"},"archetype":"Bat","base":{"size":72,"hp":28,"atk":7,"speed":105,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Ranged/utility. Great with Weakening."},
  {"id":"m_6e_hag_witch","name":"Hag / Witch","atlas":{"row":6,"col":"e"},"archetype":"Wisp","base":{"size":72,"hp":30,"atk":8,"speed":100,"def":1},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Debuff caster. Perfect for Weakening/Cursing."},

  // Row 7  Beasts/Insects (fast + poison-y vibe)
  {"id":"m_7a_giant_centipede","name":"Giant Centipede","atlas":{"row":7,"col":"a"},"archetype":"Bat","base":{"size":72,"hp":28,"atk":7,"speed":120,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Fast skitterer. Great with Orbiting."},
  {"id":"m_7b_lampreymander","name":"Lampreymander","atlas":{"row":7,"col":"b"},"archetype":"Bat","base":{"size":72,"hp":30,"atk":8,"speed":110,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Aggressive lunger."},
  {"id":"m_7c_giant_earthworm","name":"Giant Earthworm","atlas":{"row":7,"col":"c"},"archetype":"Slime","base":{"size":86,"hp":65,"atk":8,"speed":60,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Tanky crawler."},
  {"id":"m_7d_manticore","name":"Manticore","atlas":{"row":7,"col":"d"},"archetype":"Demon","base":{"size":103,"hp":85,"atk":14,"speed":70,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite beast. Great with Volatile/Lasering."},
  {"id":"m_7e_giant_ant","name":"Giant Ant","atlas":{"row":7,"col":"e"},"archetype":"Skeleton","base":{"size":86,"hp":45,"atk":9,"speed":85,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Armored insect feel."},
  {"id":"m_7f_lycanthrope","name":"Lycanthrope","atlas":{"row":7,"col":"f"},"archetype":"Bat","base":{"size":86,"hp":45,"atk":10,"speed":120,"def":1},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Fast melee hunter."},
  {"id":"m_7g_giant_bat","name":"Giant Bat","atlas":{"row":7,"col":"g"},"archetype":"Bat","base":{"size":72,"hp":25,"atk":8,"speed":130,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Your existing Bat baseline."},
  {"id":"m_7h_lesser_giant_ant","name":"Lesser Giant Ant","atlas":{"row":7,"col":"h"},"archetype":"Bat","base":{"size":72,"hp":26,"atk":6,"speed":115,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Small skitterer."},
  {"id":"m_7i_giant_spider","name":"Giant Spider","atlas":{"row":7,"col":"i"},"archetype":"Skeleton","base":{"size":86,"hp":55,"atk":10,"speed":90,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Mid threat. Great with Cursing."},
  {"id":"m_7j_lesser_giant_spider","name":"Lesser Giant Spider","atlas":{"row":7,"col":"j"},"archetype":"Bat","base":{"size":72,"hp":30,"atk":8,"speed":110,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast spider."},
  {"id":"m_7k_warg_dire_wolf","name":"Warg / Dire Wolf","atlas":{"row":7,"col":"k"},"archetype":"Demon","base":{"size":86,"hp":75,"atk":12,"speed":95,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite chaser. Great with Volatile."},
  {"id":"m_7l_giant_rat","name":"Giant Rat","atlas":{"row":7,"col":"l"},"archetype":"Bat","base":{"size":72,"hp":22,"atk":6,"speed":125,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Swarm-y speedster."},

  // Row 8  Mythic forest set
  {"id":"m_8a_dryad","name":"Dryad","atlas":{"row":8,"col":"a"},"archetype":"Wisp","base":{"size":72,"hp":28,"atk":7,"speed":115,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Nature caster. Great with Weakening."},
  {"id":"m_8b_wendigo","name":"Wendigo","atlas":{"row":8,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":95,"atk":15,"speed":60,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Horror bruiser. Great with Cursing."},
  {"id":"m_8c_rock_golem","name":"Rock Golem","atlas":{"row":8,"col":"c"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":12,"speed":50,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Slow tank. Great with Orbiting."},
  {"id":"m_8d_centaur","name":"Centaur","atlas":{"row":8,"col":"d"},"archetype":"Skeleton","base":{"size":86,"hp":70,"atk":11,"speed":90,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Mobile bruiser."},
  {"id":"m_8e_naga","name":"Naga","atlas":{"row":8,"col":"e"},"archetype":"Skeleton","base":{"size":86,"hp":65,"atk":10,"speed":80,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Mid threat. Great with Lasering."},
  {"id":"m_8f_forest_spirit","name":"Forest Spirit","atlas":{"row":8,"col":"f"},"archetype":"Wisp","base":{"size":72,"hp":22,"atk":6,"speed":125,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Fast caster."},
  {"id":"m_8g_satyr","name":"Satyr","atlas":{"row":8,"col":"g"},"archetype":"Bat","base":{"size":72,"hp":35,"atk":8,"speed":115,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Quick melee."},
  {"id":"m_8h_minotaur","name":"Minotaur","atlas":{"row":8,"col":"h"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":55,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Classic boss bruiser."},
  {"id":"m_8i_harpy","name":"Harpy","atlas":{"row":8,"col":"i"},"archetype":"Bat","base":{"size":72,"hp":28,"atk":8,"speed":125,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast aerial vibe. Great with Volatile."},
  {"id":"m_8j_gorgon_medusa","name":"Gorgon / Medusa","atlas":{"row":8,"col":"j"},"archetype":"Wisp","base":{"size":86,"hp":45,"atk":10,"speed":80,"def":1},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Control caster feel. Great with Lasering/Weakening."},

  // Row 9  Reptilians/dragons
  {"id":"m_9a_lizardfolk_kobold_reptile","name":"Lizardfolk / Kobold (Reptile)","atlas":{"row":9,"col":"a"},"archetype":"Skeleton","base":{"size":86,"hp":50,"atk":9,"speed":85,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Baseline reptile warrior."},
  {"id":"m_9b_drake_lesser_dragon","name":"Drake / Lesser Dragon","atlas":{"row":9,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":85,"atk":14,"speed":70,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Elite ranged threat."},
  {"id":"m_9c_dragon","name":"Dragon","atlas":{"row":9,"col":"c"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":55,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Boss-grade. Great Mini-boss."},
  {"id":"m_9d_cockatrice","name":"Cockatrice","atlas":{"row":9,"col":"d"},"archetype":"Bat","base":{"size":72,"hp":30,"atk":8,"speed":120,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast pecker. Great with Cursing."},
  {"id":"m_9e_basilisk","name":"Basilisk","atlas":{"row":9,"col":"e"},"archetype":"Skeleton","base":{"size":86,"hp":75,"atk":12,"speed":65,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Heavy reptile. Great with Weakening."},

  // Row 10  Canine kobolds
  {"id":"m_10a_small_kobold_canine","name":"Small Kobold (Canine)","atlas":{"row":10,"col":"a"},"archetype":"Bat","base":{"size":72,"hp":22,"atk":6,"speed":125,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Small fast trash."},
  {"id":"m_10b_kobold_canine","name":"Kobold (Canine)","atlas":{"row":10,"col":"b"},"archetype":"Bat","base":{"size":72,"hp":28,"atk":7,"speed":115,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Slightly tougher kobold."},

  // Row 11  Myconids
  {"id":"m_11a_small_myconid","name":"Small Myconid","atlas":{"row":11,"col":"a"},"archetype":"Slime","base":{"size":72,"hp":35,"atk":7,"speed":60,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Slow fungal minion."},
  {"id":"m_11b_large_myconid","name":"Large Myconid","atlas":{"row":11,"col":"b"},"archetype":"Skeleton","base":{"size":86,"hp":65,"atk":10,"speed":55,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Tanky fungal."},

  // Row 12  Celestial/Infernal
  {"id":"m_12a_angel_archangel","name":"Angel / Archangel","atlas":{"row":12,"col":"a"},"archetype":"Demon","base":{"size":103,"hp":90,"atk":13,"speed":70,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"High-threat ranged. Great with Lasering."},
  {"id":"m_12b_imp_devil","name":"Imp / Devil","atlas":{"row":12,"col":"b"},"archetype":"Wisp","base":{"size":72,"hp":20,"atk":6,"speed":130,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Fast projectile spammer. Great with Volatile."},

  // Row 13  Writhing masses
  {"id":"m_13a_small_writhing_mass","name":"Small Writhing Mass","atlas":{"row":13,"col":"a"},"archetype":"Slime","base":{"size":72,"hp":40,"atk":6,"speed":60,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Creepy slime-equivalent."},
  {"id":"m_13b_large_writhing_mass","name":"Large Writhing Mass","atlas":{"row":13,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":90,"atk":12,"speed":50,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite tank horror."},
  {"id":"m_13c_writhing_humanoid","name":"Writhing Humanoid","atlas":{"row":13,"col":"c"},"archetype":"Skeleton","base":{"size":86,"hp":60,"atk":11,"speed":70,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Medium elite horror. Great with Weakening/Cursing."}
];

const _fromData = NEW_ENEMY_DATA.map(convertEnemyData);
const _humanSquadTypes = HUMAN_SQUAD_ENEMY_IDS.map((id) => getHumanSquadTypeDef(id)).filter(Boolean);
export const ENEMY_TYPES = [..._fromData, ..._humanSquadTypes];

export const BOSS_XP = 200;

export const AFFIX_DEFS = [
  { id: "swift", name: "Swift", icon: "tile_0423_r26_c07", color: "#fbbf24" },
  { id: "volatile", name: "Volatile", icon: "tile_0002_r00_c02", color: "#f97316" },
  { id: "regenerating", name: "Regenerating", icon: "tile_0372_r23_c04", color: "#22c55e" },
  { id: "evasive", name: "Evasive", icon: "tile_0332_r20_c12", color: "#a78bfa" },
  { id: "auraBearer", name: "Aura Bearer", icon: "tile_0371_r23_c03", color: "#ec4899" },
  { id: "martyr", name: "Martyr", icon: "tile_0442_r27_c10", color: "#78716c" },
  { id: "undying", name: "Undying", icon: "tile_0365_r22_c13", color: "#7c3aed" },
  { id: "weakening", name: "Weakening", icon: "tile_0175_r10_c15", color: "#ef4444" },
  { id: "orbiting", name: "Orbiting", icon: "tile_0049_r03_c01", color: "#f59e0b" },
  { id: "lasering", name: "Lasering", icon: "tile_0327_r20_c07", color: "#06b6d4" },
  { id: "phantom", name: "Phantom", icon: "tile_0346_r21_c10", color: "#94a3b8" },
  { id: "cursing", name: "Cursing", icon: "tile_0312_r19_c08", color: "#8b5cf6" },
  { id: "erratic", name: "Erratic", icon: "tile_0259_r16_c03", color: "#e879f9" },
  { id: "rooted", name: "Rooted", icon: "tile_0394_r24_c10", color: "#64748b" }
];

export function getAffixDef(id) {
  return AFFIX_DEFS.find((a) => a.id === id) || { id, name: id, icon: "?", color: "#94a3b8" };
}

export function getXpForLevel(level) {
  if (level <= 1) return 0;
  if (level === 2) return 100;
  if (level === 3) return 250;
  if (level === 4) return 500;
  return 500 * Math.pow(1.5, level - 4);
}

/* Level-up stat bonuses replaced by attack upgrade/penalty cards (see ATTACK_UPGRADE_DEFS and showLevelUpChoices). */

export let ENEMY_ID_COUNTER = 0;

// Shared sprite atlas for all enemies
let enemySpriteAtlas = null;
let enemySpriteAtlasLoaded = false;
let affixIconAtlas = null;
let affixIconAtlasLoaded = false;

// Load the enemy sprite atlas automatically when module loads
function loadEnemySpriteAtlas() {
  if (enemySpriteAtlas) return enemySpriteAtlas;
  
  enemySpriteAtlas = new Image();
  enemySpriteAtlas.onload = () => {
    enemySpriteAtlasLoaded = true;
  };
  enemySpriteAtlas.onerror = () => {
    console.warn('Failed to load enemy sprite atlas');
    enemySpriteAtlasLoaded = false;
  };
  enemySpriteAtlas.src = 'assets/Enemies/monsters.png';
  return enemySpriteAtlas;
}

function loadAffixIconAtlas() {
  if (affixIconAtlas) return affixIconAtlas;
  affixIconAtlas = new Image();
  affixIconAtlas.onload = () => {
    affixIconAtlasLoaded = true;
  };
  affixIconAtlas.onerror = () => {
    console.warn("Failed to load affix icon atlas");
    affixIconAtlasLoaded = false;
  };
  affixIconAtlas.src = "assets/UI/icons64x64.png";
  return affixIconAtlas;
}

// Start loading the sprite atlas immediately
loadEnemySpriteAtlas();
loadAffixIconAtlas();

function parseTileFrameKey(key) {
  const match = /^tile_\d+_r(\d+)_c(\d+)$/.exec(String(key || ""));
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || col < 0) return null;
  return {
    sx: col * 64,
    sy: row * 64,
    sw: 64,
    sh: 64
  };
}

function drawAffixIcon(ctx, iconKey, x, y, size) {
  const frame = parseTileFrameKey(iconKey);
  if (!frame || !affixIconAtlasLoaded || !affixIconAtlas || !affixIconAtlas.complete) return false;
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(affixIconAtlas, frame.sx, frame.sy, frame.sw, frame.sh, x, y, size, size);
  ctx.imageSmoothingEnabled = prevSmoothing;
  return true;
}

// Convert column letter to numeric index (a=0, b=1, c=2, etc.)
function colLetterToIndex(col) {
  if (typeof col === 'number') return col;
  return col.charCodeAt(0) - 'a'.charCodeAt(0);
}

// Sprite atlas dimensions
const ATLAS_WIDTH = 384;
const ATLAS_HEIGHT = 416;

// Sprite coordinate lookup table
// Format: { "row_col": { x, y, width, height } }
// 
// To populate this:
// 1. Open sprite-measurement-tool.html in your browser
// 2. Click on each sprite from the list to select it
// 3. Click and drag on the canvas to draw a rectangle around the sprite
// 4. The coordinates will be automatically saved
// 5. Click "Copy Output Code" to get the SPRITE_COORDS object
// 6. Replace this object with the copied code
const SPRITE_COORDS = {
  // Placeholder - will be replaced with actual measurements
  // Use the sprite-measurement-tool.html to measure each sprite
};

// Track which sprites have been warned about to avoid spam
const warnedSprites = new Set();
let hasShownEmptyWarning = false;

// ===== Movement Behavior Utilities =====
function vecLength(x, y) {
  return Math.sqrt(x * x + y * y);
}

function vecNormalize(x, y) {
  const len = vecLength(x, y);
  if (len < 0.0001) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

function vecPerp(x, y) {
  return { x: -y, y: x };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Behavior assignment based on archetype
function getBehaviorForArchetype(archetype) {
  switch (archetype) {
    case "Slime":
      return "WANDER_BURST";
    case "Bat":
      return "ZIGZAG";
    case "Skeleton":
      return "STRAFE_ORBIT";
    case "Demon":
      return "STRAFE_ORBIT";
    case "Wisp":
    default:
      return "CHARGE";
  }
}

// Helper function to get sprite coordinates
function getSpriteCoords(row, col) {
  const key = `${row}_${col}`;
  const coords = SPRITE_COORDS[key];
  
  if (coords) {
    return coords;
  }
  
  // Check if SPRITE_COORDS is empty (no measurements yet)
  const isEmpty = Object.keys(SPRITE_COORDS).length === 0;
  if (isEmpty && !hasShownEmptyWarning) {
    console.warn(
      ' Sprite coordinates not loaded yet. ' +
      'Use sprite-measurement-tool.html to measure sprites, then copy the SPRITE_COORDS object into enemy.js'
    );
    hasShownEmptyWarning = true;
  }
  
  // Only warn about individual missing sprites if coordinates have been partially loaded
  if (!isEmpty && !warnedSprites.has(key)) {
    console.warn(`Sprite coordinates not found for ${row}.${col}, using fallback`);
    warnedSprites.add(key);
  }
  
  // Fallback: try to estimate (this won't work well for non-uniform grids)
  const estimatedSize = 32;
  const colIndex = colLetterToIndex(col);
  return {
    x: colIndex * estimatedSize,
    y: (row - 1) * estimatedSize,
    width: estimatedSize,
    height: estimatedSize
  };
}

export class Enemy {
  constructor(x, y, typeDef) {
    this.id = ++ENEMY_ID_COUNTER;
    this.position = new Vec2(x, y);
    this.size = typeDef.size;
    this.name = typeDef.name;
    this.enemyTypeId = typeDef.id || null;
    this.color = typeDef.color;
    this.maxHealth = typeDef.maxHealth;
    this.health = typeDef.maxHealth;
    this.attack = typeDef.attack;
    this.speed = typeDef.speed;
    
    // Human squad: use sheet-based animation; else atlas
    this.humanSheets = typeDef.humanSheets || null;
    this.humanAnimState = this.humanSheets ? createHumanSquadAnimState(typeDef.id) : null;
    this.dropTableId = typeDef.dropTableId || null;

    // Store atlas coordinates for sprite rendering (unused when humanSheets)
    this.atlasRow = typeDef.atlas?.row || 1;
    this.atlasCol = typeDef.atlas?.col ? colLetterToIndex(typeDef.atlas.col) : 0;
    this.atlasColLetter = typeDef.atlas?.col || 'a';
    const spriteCoords = getSpriteCoords(this.atlasRow, this.atlasColLetter);
    this.spriteX = spriteCoords.x;
    this.spriteY = spriteCoords.y;
    this.spriteWidth = spriteCoords.width;
    this.spriteHeight = spriteCoords.height;

    // How often the enemy can deal damage (seconds)
    this.attackCooldown = 1.0;
    this.attackTimer = 0;

    // Flash red briefly when hit
    this.hitFlashTimer = 0;

    // Only chase after player enters detection range; once activated, chase forever
    this.activated = false;
    // Alerted when player enters alerted range (3x detection range); moves at 0.4x speed
    this.alerted = false;

    // Debuffs from modification cards (element mods)
    this.defense = typeDef.defense ?? 0;
    this.burnUntil = null;
    this.burnDps = 0;
    this.burnAccum = 0;
    this.toxicStacks = 0;
    this.toxicUntil = null;
    this.toxicAccum = 0;
    this.bleedStacks = 0;
    this.bleedDps = 0;
    this.bleedTimer = 0;
    this.bleedAccum = 0;
    this.voidDefenseUntil = null;
    this.voidDefenseMult = 1;
    
    // VFX state
    this.vfxState = {
      volatile: { telegraphTimer: 0, lastBurstTime: 0 },
      orbiting: { orbTrails: [[], [], [], []], auraAngle: 0, lastContactTime: 0 },
      lasering: { sweepStartTime: 0, lastHitTime: 0, emitterPulse: 0 }
    };
    
    // Track facing direction for sprite flipping (true = facing right)
    this.facingRight = false;
    
    // Walking animation state - size-based parameters
    this.walkingAnimationTimer = 0;
    this.walkingBobOffset = 0;
    this.lastPosition = new Vec2(x, y);
    
    // Determine size category and set animation parameters
    if (this.size <= 80) {
      // Small enemies: 3 pixels, 0.3s each direction
      this.walkingBobAmount = 3;
      this.walkingAnimationHalfCycle = 0.3; // Time for one direction
      this.walkingAnimationCycle = 0.6; // Total cycle time
    } else if (this.size <= 100) {
      // Medium enemies: 5 pixels, 0.6s each direction
      this.walkingBobAmount = 5;
      this.walkingAnimationHalfCycle = 0.6;
      this.walkingAnimationCycle = 1.2;
    } else {
      // Large enemies: 10 pixels, 1s each direction
      this.walkingBobAmount = 10;
      this.walkingAnimationHalfCycle = 1.0;
      this.walkingAnimationCycle = 2.0;
    }
    
    // Movement behavior system
    this.moveBehavior = typeDef.moveBehavior || getBehaviorForArchetype(typeDef.archetype || "Wisp");
    this.moveState = this.moveBehavior === "STRAFE_ORBIT" ? "orbit" : (this.moveBehavior === "WANDER_BURST" ? "wander" : "default");
    this.stateTimer = 0;
    this.stateCooldown = 0;
    this.behaviorSeed = Math.random() * 1000;
    this.behaviorTime = 0;
    this.preferredRange = typeDef.preferredRange || 110;
    
    // WANDER_BURST state
    this.wanderHeading = { x: Math.random() - 0.5, y: Math.random() - 0.5 };
    const wanderLen = vecLength(this.wanderHeading.x, this.wanderHeading.y);
    if (wanderLen > 0.0001) {
      this.wanderHeading = vecNormalize(this.wanderHeading.x, this.wanderHeading.y);
    }
    this.wanderTurnTimer = 0.6 + Math.random() * 0.6;
    
    // STRAFE_ORBIT state
    this.orbitBurstTimer = 1.2 + Math.random() * 0.8; // Start with cooldown, so first state is "orbit"
    this.orbitBurstCooldown = 1.2 + Math.random() * 0.8;
  }

  get center() {
    return new Vec2(
      this.position.x + this.size / 2,
      this.position.y + this.size / 2
    );
  }

  distanceTo(other) {
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const ox = other.position.x + other.size / 2;
    const oy = other.position.y + other.size / 2;
    const dx = cx - ox;
    const dy = cy - oy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Compute desired movement direction based on behavior
  computeBehaviorDirection(dt, player, speedMult) {
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = vecLength(dx, dy);
    
    this.behaviorTime += dt;
    
    switch (this.moveBehavior) {
      case "CHARGE":
        // Direct movement toward player
        if (dist < 0.0001) return { x: 0, y: 0 };
        return vecNormalize(dx, dy);
        
      case "STRAFE_ORBIT": {
        // Update burst timer
        this.orbitBurstTimer -= dt;
        if (this.orbitBurstTimer <= 0) {
          if (this.moveState === "burst") {
            // End burst, return to orbit
            this.moveState = "orbit";
            this.orbitBurstCooldown = 1.2 + Math.random() * 0.8;
            this.orbitBurstTimer = this.orbitBurstCooldown;
          } else {
            // Start burst
            this.moveState = "burst";
            this.orbitBurstTimer = 0.25 + Math.random() * 0.2;
          }
        }
        
        if (this.moveState === "burst") {
          // Charge directly during burst
          if (dist < 0.0001) return { x: 0, y: 0 };
          return vecNormalize(dx, dy);
        }
        
        // Orbit behavior
        if (dist < 0.0001) return { x: 0, y: 0 };
        
        const toPlayer = vecNormalize(dx, dy);
        const perp = vecPerp(toPlayer.x, toPlayer.y);
        const perpNorm = vecNormalize(perp.x, perp.y);
        
        // If far, approach; if close, orbit
        if (dist > this.preferredRange) {
          // Approach
          return toPlayer;
        } else {
          // Orbit with radial correction
          const radialError = dist - this.preferredRange;
          const radialK = 0.8;
          const radialCorrection = {
            x: toPlayer.x * radialError * radialK,
            y: toPlayer.y * radialError * radialK
          };
          
          const orbitDir = {
            x: perpNorm.x * 0.85 + radialCorrection.x,
            y: perpNorm.y * 0.85 + radialCorrection.y
          };
          
          return vecNormalize(orbitDir.x, orbitDir.y);
        }
      }
      
      case "ZIGZAG": {
        // Base direction toward player
        if (dist < 0.0001) return { x: 0, y: 0 };
        const baseDir = vecNormalize(dx, dy);
        const perp = vecPerp(baseDir.x, baseDir.y);
        const perpNorm = vecNormalize(perp.x, perp.y);
        
        // Zigzag oscillation
        const freq = 8;
        const amp = 0.6;
        const phase = this.behaviorTime * freq + this.behaviorSeed;
        const oscillation = Math.sin(phase) * amp;
        
        const zigzagDir = {
          x: baseDir.x + perpNorm.x * oscillation,
          y: baseDir.y + perpNorm.y * oscillation
        };
        
        return vecNormalize(zigzagDir.x, zigzagDir.y);
      }
      
      case "WANDER_BURST": {
        const aggroRange = 140;
        
        // Update wander turn timer
        this.wanderTurnTimer -= dt;
        if (this.wanderTurnTimer <= 0) {
          this.wanderHeading = { x: Math.random() - 0.5, y: Math.random() - 0.5 };
          const wanderLen = vecLength(this.wanderHeading.x, this.wanderHeading.y);
          if (wanderLen > 0.0001) {
            this.wanderHeading = vecNormalize(this.wanderHeading.x, this.wanderHeading.y);
          }
          this.wanderTurnTimer = 0.6 + Math.random() * 0.6;
        }
        
        // Check if player is in aggro range (only if player exists and is close enough)
        if (dist <= aggroRange && this.moveState !== "burst") {
          this.moveState = "burst";
          this.stateTimer = 0.25 + Math.random() * 0.15;
        }
        
        // Update burst timer
        if (this.moveState === "burst") {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0 || dist > aggroRange * 1.5) {
            this.moveState = "wander";
          }
        }
        
        if (this.moveState === "burst") {
          // Burst toward player
          if (dist < 0.0001) return { x: 0, y: 0 };
          return vecNormalize(dx, dy);
        } else {
          // Wander
          return this.wanderHeading;
        }
      }
      
      default:
        // Fallback to CHARGE
        if (dist < 0.0001) return { x: 0, y: 0 };
        return vecNormalize(dx, dy);
    }
  }

  update(dt, player, gameTime = 0, globalSlowMult = 1, detectionRange = 400, game = null) {
    if (this._undyingRespawnTime != null && gameTime < this._undyingRespawnTime) {
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      return;
    }
    if (this._undyingRespawnTime != null && gameTime >= this._undyingRespawnTime) {
      this._undyingRespawnTime = null;
    }
    if (this.stunUntil != null && gameTime < this.stunUntil) {
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      return;
    }
    const hasAffix = (id) => this.affixes && this.affixes.includes(id);
    let speedMult = globalSlowMult;
    if (this.slowUntil != null && gameTime < this.slowUntil) speedMult *= (this.slowMult ?? 0.7);
    if (hasAffix("swift")) {
      speedMult *= 1.2;
      this._swiftTrail = this._swiftTrail || [];
      this._swiftTrail.push({ x: this.position.x, y: this.position.y });
      if (this._swiftTrail.length > 8) this._swiftTrail.shift();
    } else this._swiftTrail = null;
    if (this._auraBuffed) speedMult *= 1.2;
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;
    const margin = 60;

    if (hasAffix("erratic")) {
      this._erraticTimer = (this._erraticTimer ?? 0) + dt;
      if (this._erraticTimer >= 4) {
        this._erraticTimer = 0;
        this._erraticTrail = this._erraticTrail || [];
        for (let i = 0; i < 4; i++) this._erraticTrail.push({ x: this.position.x, y: this.position.y });
        if (this._erraticTrail.length > 12) this._erraticTrail = this._erraticTrail.slice(-12);
        const angle = Math.random() * Math.PI * 2;
        const dashDist = 80;
        this.position.x += Math.cos(angle) * dashDist;
        this.position.y += Math.sin(angle) * dashDist;
      }
    }

    if (hasAffix("rooted")) {
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      if (!this.activated && dist <= detectionRange) this.activated = true;
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      return;
    }

    if (hasAffix("evasive") && this.activated) {
      this._evasiveTrail = this._evasiveTrail || [];
      this._evasiveTrail.push({ x: this.position.x, y: this.position.y });
      if (this._evasiveTrail.length > 6) this._evasiveTrail.shift();
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const fleeSpeed = Math.min(this.speed * 1.5, player.speed || 100);
      const moveX = (dx / dist) * fleeSpeed * speedMult * dt;
      const moveY = (dy / dist) * fleeSpeed * speedMult * dt;
      this.position.x += moveX;
      this.position.y += moveY;
      // Update facing direction for evasive movement
      if (Math.abs(moveX) > 0.1) {
        this.facingRight = moveX > 0;
      }
      const w = this.worldBounds?.width ?? 3600;
      const h = this.worldBounds?.height ?? 900;
      this.position.x = Math.max(margin, Math.min(this.position.x, w - margin - this.size));
      this.position.y = Math.max(margin, Math.min(this.position.y, h - margin - this.size));
    } else this._evasiveTrail = null;
    if (hasAffix("evasive") && !this.activated) this._evasiveTrail = null;
    if (this.isFiery) {
      this.wanderTimer = (this.wanderTimer || 0) - dt;
      if (this.wanderTimer <= 0) {
        this.wanderDirection = this.wanderDirection || new Vec2(0, 0);
        this.wanderDirection.set(Math.random() - 0.5, Math.random() - 0.5);
        const len = Math.sqrt(this.wanderDirection.x ** 2 + this.wanderDirection.y ** 2) || 1;
        this.wanderDirection.x /= len;
        this.wanderDirection.y /= len;
        this.wanderTimer = 0.5 + Math.random() * 1;
      }
      let dx = this.wanderDirection.x;
      let dy = this.wanderDirection.y;
      const moveX = dx * this.speed * speedMult * dt;
      const moveY = dy * this.speed * speedMult * dt;
      this.position.x += moveX;
      this.position.y += moveY;
      // Update facing direction for fiery/wandering movement
      if (Math.abs(moveX) > 0.1) {
        this.facingRight = moveX > 0;
      }
      const w = this.worldBounds?.width ?? 3600;
      const h = this.worldBounds?.height ?? 900;
      this.position.x = Math.max(margin, Math.min(this.position.x, w - margin - this.size));
      this.position.y = Math.max(margin, Math.min(this.position.y, h - margin - this.size));
    } else {
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      
      // Calculate alerted range (3x detection range)
      const alertedRange = detectionRange * 3;
      
      // Check if player enters alerted range
      if (!this.alerted && dist <= alertedRange) {
        this.alerted = true;
      }
      
      // Check if player enters detection range (activates enemy)
      if (!this.activated && dist <= detectionRange) {
        this.activated = true;
      }
      
      // Skip normal movement when performing attack (windup, dash, jump slam)
      const inAttackState = this.attackCtrl && (
        this.attackCtrl.state === "windup" ||
        this._attackDashState ||
        this._jumpSlamState
      );

      // Move based on behavior (WANDER_BURST can move even when not alerted)
      const shouldMove = !inAttackState && ((this.alerted || this.activated) || (this.moveBehavior === "WANDER_BURST"));
      
      if (shouldMove) {
        // Use 0.4x speed if alerted but not activated, full speed if activated
        // WANDER_BURST uses its own multipliers, so base is 1.0 for it
        const baseMovementSpeedMult = (this.moveBehavior === "WANDER_BURST" && !this.alerted && !this.activated) 
          ? 1.0 
          : (this.activated ? 1.0 : 0.4);
        
        // Rooted-affix spawned minions: always chase player directly at full speed.
        const forceDirectChase = !!this.forceDirectChase;
        const behaviorDir = forceDirectChase
          ? vecNormalize(dx, dy)
          : this.computeBehaviorDirection(dt, player, speedMult);
        
        // Apply behavior-specific speed multipliers
        let behaviorSpeedMult = forceDirectChase ? 1.0 : baseMovementSpeedMult;
        if (!forceDirectChase && this.moveBehavior === "WANDER_BURST") {
          if (this.moveState === "burst") {
            behaviorSpeedMult = baseMovementSpeedMult * 1.6; // burstSpeedMult
          } else {
            behaviorSpeedMult = baseMovementSpeedMult * 0.6; // wanderSpeedMult
          }
        } else if (!forceDirectChase && this.moveBehavior === "STRAFE_ORBIT") {
          if (this.moveState === "burst") {
            behaviorSpeedMult = baseMovementSpeedMult * 1.0; // Full speed during burst
          } else {
            // Orbit speed is handled by the behavior itself, but we can adjust here if needed
            behaviorSpeedMult = baseMovementSpeedMult * 0.85; // orbitMult
          }
        }
        
        // Store normalized player direction for use in obstacle avoidance
        const playerDirNorm = dist > 0.0001 ? vecNormalize(dx, dy) : { x: 0, y: 0 };
        
        let moveX = behaviorDir.x * this.speed * speedMult * behaviorSpeedMult * dt;
        let moveY = behaviorDir.y * this.speed * speedMult * behaviorSpeedMult * dt;
        
        // Simple obstacle avoidance: try to move around obstacles and sub-area walls
        if (game && !forceDirectChase) {
          const testX = this.position.x + moveX;
          const testY = this.position.y + moveY;
          const testRect = { x: testX, y: testY, w: this.size, h: this.size };
          
          // Check obstacles
          if (game.obstacles) {
            for (const obstacle of game.obstacles) {
              if (obstacle.destroyed || !obstacle.blocksMovement) continue;
              const obsRect = getObstacleCollisionRect(obstacle);
              if (obstacleIntersectsRect(obstacle, testRect)) {
                // Collision detected, try to move around
                const obsCenterX = obsRect.x + obsRect.w / 2;
                const obsCenterY = obsRect.y + obsRect.h / 2;
                const enemyCenterX = this.position.x + this.size / 2;
                const enemyCenterY = this.position.y + this.size / 2;
                
                const avoidDx = enemyCenterX - obsCenterX;
                const avoidDy = enemyCenterY - obsCenterY;
                const avoidDist = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy) || 1;
                
                const perpX = -avoidDy / avoidDist;
                const perpY = avoidDx / avoidDist;
                
                const dot = (playerDirNorm.x) * perpX + (playerDirNorm.y) * perpY;
                const usePerpX = dot > 0 ? perpX : -perpX;
                const usePerpY = dot > 0 ? perpY : -perpY;
                
                moveX = usePerpX * this.speed * speedMult * behaviorSpeedMult * dt;
                moveY = usePerpY * this.speed * speedMult * behaviorSpeedMult * dt;
                break;
              }
            }
          }
          // Check tile walls - block movement through walls
          const tileWalls = game.world?.tileWallRects;
          if (tileWalls && tileWalls.length > 0) {
            const testXOnly = { x: this.position.x + moveX, y: this.position.y, w: this.size, h: this.size };
            const testYOnly = { x: this.position.x, y: this.position.y + moveY, w: this.size, h: this.size };
            
            let canMoveX = true;
            let canMoveY = true;
            
            for (const wall of tileWalls) {
              const wallRect = getWallCollisionRect(wall);
              
              if (testXOnly.x < wallRect.x + wallRect.w && testXOnly.x + testXOnly.w > wallRect.x &&
                  testXOnly.y < wallRect.y + wallRect.h && testXOnly.y + testXOnly.h > wallRect.y) {
                canMoveX = false;
              }
              if (testYOnly.x < wallRect.x + wallRect.w && testYOnly.x + testYOnly.w > wallRect.x &&
                  testYOnly.y < wallRect.y + wallRect.h && testYOnly.y + testYOnly.h > wallRect.y) {
                canMoveY = false;
              }
            }
            
            if (!canMoveX) moveX = 0;
            if (!canMoveY) moveY = 0;
            
            if (!canMoveX && !canMoveY) {
              let nearestWall = null;
              let minDist = Infinity;
              
              for (const wall of tileWalls) {
                const wallRect = getWallCollisionRect(wall);
                const wallCenterX = wallRect.x + wallRect.w / 2;
                const wallCenterY = wallRect.y + wallRect.h / 2;
                const wallEnemyCenterX = this.position.x + this.size / 2;
                const wallEnemyCenterY = this.position.y + this.size / 2;
                const wallDist = Math.sqrt((wallEnemyCenterX - wallCenterX) ** 2 + (wallEnemyCenterY - wallCenterY) ** 2);
                if (wallDist < minDist) {
                  minDist = wallDist;
                  nearestWall = { wallRect, wallCenterX, wallCenterY };
                }
              }
              
              if (nearestWall) {
                const wallEnemyCenterX = this.position.x + this.size / 2;
                const wallEnemyCenterY = this.position.y + this.size / 2;
                const avoidDx = wallEnemyCenterX - nearestWall.wallCenterX;
                const avoidDy = wallEnemyCenterY - nearestWall.wallCenterY;
                const avoidDist = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy) || 1;
                
                const perpX = -avoidDy / avoidDist;
                const perpY = avoidDx / avoidDist;
                
                const dot = (playerDirNorm.x) * perpX + (playerDirNorm.y) * perpY;
                const usePerpX = dot > 0 ? perpX : -perpX;
                const usePerpY = dot > 0 ? perpY : -perpY;
                
                moveX = usePerpX * this.speed * speedMult * behaviorSpeedMult * dt;
                moveY = usePerpY * this.speed * speedMult * behaviorSpeedMult * dt;
              }
            }
          }
        }
        
        // Hard block against obstacles/walls with axis-separated checks,
        // so enemies cannot tunnel through colliders when avoidance fails.
        const prevX = this.position.x;
        const prevY = this.position.y;
        let nx = this.position.x + moveX;
        let ny = this.position.y + moveY;
        const hitW = Math.max(4, this.size * 0.5);
        const hitH = Math.max(4, this.size * 0.5);
        const hitOffX = (this.size - hitW) / 2;
        const hitOffY = (this.size - hitH) / 2;
        const testX = { x: nx + hitOffX, y: this.position.y + hitOffY, w: hitW, h: hitH };
        const testY = { x: this.position.x + hitOffX, y: ny + hitOffY, w: hitW, h: hitH };

        let canMoveX = true;
        let canMoveY = true;

        if (game?.obstacles) {
          for (const obstacle of game.obstacles) {
            if (obstacle?.destroyed || !obstacle?.blocksMovement) continue;
            if (obstacleIntersectsRect(obstacle, testX)) canMoveX = false;
            if (obstacleIntersectsRect(obstacle, testY)) canMoveY = false;
            if (!canMoveX && !canMoveY) break;
          }
        }

        const tileWalls = game?.world?.tileWallRects || [];
        if (tileWalls.length > 0) {
          for (const wall of tileWalls) {
            const wallRect = getWallCollisionRect(wall);
            if (
              testX.x < wallRect.x + wallRect.w &&
              testX.x + testX.w > wallRect.x &&
              testX.y < wallRect.y + wallRect.h &&
              testX.y + testX.h > wallRect.y
            ) canMoveX = false;
            if (
              testY.x < wallRect.x + wallRect.w &&
              testY.x + testY.w > wallRect.x &&
              testY.y < wallRect.y + wallRect.h &&
              testY.y + testY.h > wallRect.y
            ) canMoveY = false;
            if (!canMoveX && !canMoveY) break;
          }
        }

        if (!canMoveX) nx = this.position.x;
        if (!canMoveY) ny = this.position.y;

        this.position.x = nx;
        this.position.y = ny;
        
        // Update facing direction from player position with 5px dead zone to avoid rapid left/right flipping when player is centered
        const inAttackState = this.attackCtrl && (this.attackCtrl.state === "windup" || this.attackCtrl.state === "active" || this.attackCtrl.state === "recover");
        if (!inAttackState) {
          const ex = this.position.x + this.size / 2;
          if (px >= ex + 5) this.facingRight = true;
          else if (px <= ex - 5) this.facingRight = false;
        }
        
        const moved = Math.sqrt(
          (this.position.x - prevX) ** 2 +
          (this.position.y - prevY) ** 2
        );
        if (this.humanSheets && this.humanAnimState) {
          const inAttack = this.attackCtrl && (this.attackCtrl.state === "windup" || this.attackCtrl.state === "active" || this.attackCtrl.state === "recover");
          const isHeal = this.enemyTypeId === "human_monk" && this.attackCtrl?.currentAttack?.id?.includes("heal");
          if (inAttack && this.humanAnimState.state !== "attack" && this.humanAnimState.state !== "heal") {
            setHumanSquadAnimState(this, isHeal ? "heal" : "attack");
          } else if (!inAttack && this.humanAnimState.state !== "attack" && this.humanAnimState.state !== "heal") {
            setHumanSquadAnimState(this, moved > 0.1 ? "run" : "idle");
          }
        }
        if (moved > 0.1) {
          this.walkingAnimationTimer += dt;
          // Cycle the timer
          if (this.walkingAnimationTimer >= this.walkingAnimationCycle) {
            this.walkingAnimationTimer -= this.walkingAnimationCycle;
          }
          
          // Calculate bob offset: triangle wave
          // First half: 0 to -bobAmount (down)
          // Second half: -bobAmount to 0 (up)
          if (this.walkingAnimationTimer < this.walkingAnimationHalfCycle) {
            // Moving down: 0 to -bobAmount
            this.walkingBobOffset = -(this.walkingAnimationTimer / this.walkingAnimationHalfCycle) * this.walkingBobAmount;
          } else {
            // Moving up: -bobAmount to 0
            this.walkingBobOffset = -this.walkingBobAmount + ((this.walkingAnimationTimer - this.walkingAnimationHalfCycle) / this.walkingAnimationHalfCycle) * this.walkingBobAmount;
          }
        } else {
          // Not moving, reset animation
          this.walkingAnimationTimer = 0;
          this.walkingBobOffset = 0;
        }
      } else {
        // Not moving (shouldMove is false), reset animation
        this.walkingAnimationTimer = 0;
        this.walkingBobOffset = 0;
      }
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    if (this.humanSheets && this.humanAnimState) {
      updateHumanSquadAnim(this, dt);
    }
  }

  intersects(other) {
    // Circular collision detection
    // Use 70% of size for collision radius to better match sprite visuals
    const collisionRadiusMultiplier = 0.7;
    const aCenterX = this.position.x + this.size / 2;
    const aCenterY = this.position.y + this.size / 2;
    const aRadius = (this.size / 2) * collisionRadiusMultiplier;
    
    const bCenterX = other.position.x + other.size / 2;
    const bCenterY = other.position.y + other.size / 2;
    const bRadius = (other.size / 2) * collisionRadiusMultiplier;
    
    const dx = aCenterX - bCenterX;
    const dy = aCenterY - bCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < (aRadius + bRadius);
  }

  takeDamage(amount) {
    this.health -= amount;
    this.hitFlashTimer = 0.12;
    if (this.health < 0) this.health = 0;
    this.activated = true;
  }

  get isDead() {
    return this.health <= 0;
  }

  draw(ctx, camera, gameTime = null) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y + this.walkingBobOffset);
    const half = this.size / 2;
    const hasAffix = (id) => this.affixes?.includes(id);

    // Draw attack telegraphs (above ground, below sprites)
    if (this.attackCtrl) {
      this.attackCtrl.draw(ctx, camera);
    }

    const isMiniBoss = this.enemyTier === "miniBoss" || this.isMiniBoss;
    const isElite = this.enemyTier === "elite" || this.isElite;

    if (hasAffix("phantom")) ctx.globalAlpha = 0.2;

    let fillColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
    if (isMiniBoss) {
      fillColor = this.hitFlashTimer > 0 ? "#ffffff" : "#a855f7";
    }

    // Determine which shadow/glow effect to use (priority: undying > weakening > elite/miniboss glow)
    let shadowColor = null;
    let shadowBlur = 0;
    
    if (this._undyingRespawnTime != null) {
      shadowColor = "#7c3aed";
      shadowBlur = 20;
    } else if (hasAffix("weakening") && this.hitFlashTimer > 0) {
      shadowColor = "#ef4444";
      shadowBlur = 8;
    } else if (isElite) {
      // Blue glow for elites
      shadowColor = "#60a5fa";
      shadowBlur = 8;
    } else if (isMiniBoss) {
      // Yellow glow for minibosses
      shadowColor = "#facc15";
      shadowBlur = 10;
    }
    // No glow for regular minions

    // Human squad: draw from sheet strips with flip
    if (this.humanSheets && this.humanAnimState) {
      const frame = getHumanSquadAnimFrame(this);
      if (frame && frame.image && frame.image.complete) {
        ctx.save();
        if (hasAffix("phantom")) ctx.globalAlpha = 0.2;
        if (this.hitFlashTimer > 0) ctx.globalAlpha *= 0.7;
        const centerX = sx + this.size / 2;
        const centerY = sy + this.size / 2;
        if (!this.facingRight) {
          ctx.translate(centerX, centerY);
          ctx.scale(-1, 1);
          ctx.translate(-centerX, -centerY);
        }
        const fw = frame.frameW;
        const fh = frame.frameH;
        const srcX = frame.frameIndex * fw;
        ctx.drawImage(frame.image, srcX, 0, fw, fh, sx, sy, this.size, this.size);
        if (this.hitFlashTimer > 0) {
          const r = this.size / 2;
          const alpha = (this.hitFlashTimer / 0.12) * 0.4;
          const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, r);
          grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.restore();
      }
    } else if (enemySpriteAtlasLoaded && enemySpriteAtlas && enemySpriteAtlas.complete) {
      ctx.save();
      ctx.imageSmoothingEnabled = false; // Pixel-perfect rendering
      
      // Apply shadow/glow effect if any
      if (shadowColor) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
      }
      
      // Flip sprite horizontally when facing right
      const centerX = sx + this.size / 2;
      const centerY = sy + this.size / 2;
      
      if (this.facingRight) {
        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.translate(-centerX, -centerY);
      }
      
      // Use exact sprite coordinates from lookup table
      ctx.drawImage(
        enemySpriteAtlas,
        this.spriteX, this.spriteY, this.spriteWidth, this.spriteHeight,
        sx, sy, this.size, this.size
      );
      
      // Clear shadow for subsequent drawing
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      
      // Apply hit flash effect (soft white bloom when hit)
      if (this.hitFlashTimer > 0) {
        const cx = sx + this.size / 2;
        const cy = sy + this.size / 2;
        const r = this.size / 2;
        const alpha = (this.hitFlashTimer / 0.12) * 0.5;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.4})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      
      ctx.imageSmoothingEnabled = true;
      ctx.restore();
    } else {
      // Fallback to colored rectangle with glow
      ctx.save();
      
      // Apply shadow/glow effect if any
      if (shadowColor) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
      }
      
      ctx.fillStyle = fillColor;
      ctx.fillRect(sx, sy, this.size, this.size);
      
      // Clear shadow
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.restore();
    }

    if (hasAffix("martyr")) {
      ctx.strokeStyle = "rgba(80,60,40,0.8)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const ax = sx + 4 + (i % 2) * (this.size - 8);
        const ay = sy + 4 + Math.floor(i / 2) * (this.size - 8);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + 6, ay + 6);
        ctx.lineTo(ax + 2, ay + 10);
        ctx.stroke();
      }
    }
    if (hasAffix("rooted")) {
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      const cx = sx + this.size / 2;
      const cy = sy + this.size;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx - 12, cy + 15);
      ctx.moveTo(cx + 8, cy);
      ctx.lineTo(cx + 12, cy + 15);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + 18);
      ctx.stroke();
    }
    if (hasAffix("regenerating")) {
      this._regenParticles = this._regenParticles || [];
      if (Math.random() < 0.3) this._regenParticles.push({ x: sx + this.size / 2 + (Math.random() - 0.5) * this.size, y: sy + this.size, life: 0.5 });
      this._regenParticles = this._regenParticles.filter((p) => {
        p.life -= 0.016;
        if (p.life <= 0) return false;
        ctx.fillStyle = `rgba(34,197,94,${p.life * 2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - p.life * 20, 3, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
    }
    if (hasAffix("swift") && this._swiftTrail) {
      // Draw trail, but skip the last position (current position) to avoid yellow square on enemy
      for (let i = 0; i < this._swiftTrail.length - 1; i++) {
        const t = this._swiftTrail[i];
        const tsx = Math.floor(t.x - camera.position.x);
        const tsy = Math.floor(t.y - camera.position.y);
        const trailLength = this._swiftTrail.length - 1;
        ctx.fillStyle = `rgba(251,191,36,${0.15 * (i / trailLength)})`;
        ctx.fillRect(tsx, tsy, this.size, this.size);
      }
    }
    if (hasAffix("erratic") && this._erraticTrail) {
      for (let i = 0; i < this._erraticTrail.length; i++) {
        const t = this._erraticTrail[i];
        const tsx = Math.floor(t.x - camera.position.x);
        const tsy = Math.floor(t.y - camera.position.y);
        const alpha = 0.2 * (1 - i / this._erraticTrail.length);
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Draw sprite from atlas if available, otherwise fallback to colored rectangle
        if (enemySpriteAtlasLoaded && enemySpriteAtlas && enemySpriteAtlas.complete) {
          ctx.imageSmoothingEnabled = false;
          
          // Draw the sprite
          ctx.drawImage(
            enemySpriteAtlas,
            this.spriteX, this.spriteY, this.spriteWidth, this.spriteHeight,
            tsx, tsy, this.size, this.size
          );
          
          // Apply purple tint overlay
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = "rgba(232,121,249,0.7)";
          ctx.fillRect(tsx, tsy, this.size, this.size);
          ctx.globalCompositeOperation = "source-over";
          
          ctx.imageSmoothingEnabled = true;
        } else {
          // Fallback to purple rectangle if sprite atlas not loaded
          ctx.fillStyle = `rgba(232,121,249,${alpha})`;
          ctx.fillRect(tsx, tsy, this.size, this.size);
        }
        
        ctx.restore();
      }
    }
    if (hasAffix("evasive") && this._evasiveTrail) {
      for (let i = 0; i < this._evasiveTrail.length; i++) {
        const t = this._evasiveTrail[i];
        const tsx = Math.floor(t.x - camera.position.x);
        const tsy = Math.floor(t.y - camera.position.y);
        ctx.fillStyle = `rgba(167,139,250,${0.2 * (i / this._evasiveTrail.length)})`;
        ctx.fillRect(tsx + 2, tsy + this.size - 4, 4, 4);
      }
    }
    if (hasAffix("auraBearer")) {
      const cx = sx + this.size / 2;
      const cy = sy + this.size / 2;
      ctx.strokeStyle = "rgba(236,72,153,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 400, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (hasAffix("orbiting") && this._orbitingAngle != null) {
      const cx = sx + this.size / 2;
      const cy = sy + this.size / 2;
      // Scale orb radius with enemy size: base radius + size-based offset
      // Ensures orbs orbit outside the enemy's collision radius
      const orbRadius = this.size / 2 + 15;
      const vfx = this.vfxState.orbiting;
      
      // Aura ring: faint dashed ring with slow rotation
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(vfx.auraAngle || 0);
      ctx.strokeStyle = "rgba(245,158,11,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, orbRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      
      for (let i = 0; i < 4; i++) {
        const a = this._orbitingAngle + (i / 4) * Math.PI * 2;
        const ox = cx + Math.cos(a) * orbRadius;
        const oy = cy + Math.sin(a) * orbRadius;
        
        // Draw trail
        if (vfx.orbTrails[i] && vfx.orbTrails[i].length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (let j = 0; j < vfx.orbTrails[i].length; j++) {
            const trail = vfx.orbTrails[i][j];
            const trailSx = Math.floor(trail.x - camera.position.x);
            const trailSy = Math.floor(trail.y - camera.position.y);
            const alpha = (j + 1) / vfx.orbTrails[i].length * 0.4;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "#06b6d4";
            ctx.beginPath();
            ctx.arc(trailSx, trailSy, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        
        // Draw orb with glow
        const glowBoost = (gameTime && gameTime - vfx.lastContactTime < 0.08) ? 1.5 : 1.0;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // Outer cyan glow
        ctx.fillStyle = `rgba(6,182,212,${0.6 * glowBoost})`;
        ctx.beginPath();
        ctx.arc(ox, oy, 8, 0, Math.PI * 2);
        ctx.fill();
        // Inner white core
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ox, oy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (hasAffix("lasering")) {
      const cx = sx + this.size / 2;
      const cy = sy + this.size / 2;
      const a = this._laserAngle ?? 0;
      const vfx = this.vfxState.lasering;
      const beamLen = 150;
      const bx = cx + Math.cos(a) * beamLen;
      const by = cy + Math.sin(a) * beamLen;
      
      // Origin emitter: pulsing circle
      const pulse = Math.sin((vfx.emitterPulse || 0)) * 0.3 + 0.7;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(6,182,212,${0.6 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, this.size / 2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Beam: outer soft + inner core
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Outer soft beam (wider, low alpha)
      ctx.strokeStyle = "rgba(6,182,212,0.3)";
      ctx.lineWidth = 30;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // Inner core (narrow, high alpha)
      ctx.strokeStyle = "rgba(6,182,212,0.9)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
    }
    if (hasAffix("volatile")) {
      const cx = sx + this.size / 2;
      const cy = sy + this.size / 2;
      const vfx = this.vfxState.volatile;
      
      // Telegraph: pulsing ring with tick marks
      if (vfx.telegraphTimer > 0) {
        ctx.save();
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - (vfx.telegraphTimer / 0.25);
        ctx.beginPath();
        ctx.arc(cx, cy, vfx.telegraphRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 8 tick marks
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const tickX = cx + Math.cos(angle) * vfx.telegraphRadius;
          const tickY = cy + Math.sin(angle) * vfx.telegraphRadius;
          ctx.beginPath();
          ctx.moveTo(tickX, tickY);
          ctx.lineTo(tickX + Math.cos(angle) * 4, tickY + Math.sin(angle) * 4);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Burst flash (if just fired)
      if (gameTime && gameTime - vfx.lastBurstTime < 0.08) {
        const flashAlpha = 1 - ((gameTime - vfx.lastBurstTime) / 0.08);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(249,115,22,${flashAlpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (hasAffix("phantom")) ctx.globalAlpha = 1;

    const barW = this.size;
    const barH = isMiniBoss ? 7 : 5;
    const barY = sy - (isMiniBoss ? 12 : 8);
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(sx, barY, barW, barH);
    const pct = Math.max(0, this.health / this.maxHealth);
    const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
    ctx.fillStyle = hpColor;
    ctx.fillRect(sx, barY, Math.round(barW * pct), barH);
    if (isMiniBoss) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, barY, barW, barH);
    }

    if (this.affixes && this.affixes.length > 0) {
      const iconSize = 14;
      const iconY = barY - iconSize - 2;
      const totalW = this.affixes.length * (iconSize + 2);
      let iconX = sx + (barW - totalW) / 2 + iconSize / 2 + 1;
      this._affixRects = [];
      for (const affixId of this.affixes) {
        const def = getAffixDef(affixId);
        const rx = iconX - iconSize / 2 - 1;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(iconX, iconY + iconSize / 2, iconSize / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        const spriteDrawn = drawAffixIcon(ctx, def.icon, iconX - iconSize / 2, iconY, iconSize);
        if (!spriteDrawn) {
          const fallback = typeof def.icon === "string" && def.icon.length === 1 ? def.icon : def.name?.charAt(0) || "?";
          ctx.fillStyle = "#fff";
          ctx.font = `${iconSize - 2}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(fallback, iconX, iconY + iconSize / 2);
        }
        this._affixRects.push({ x: rx, y: iconY, w: iconSize + 2, h: iconSize + 2, name: def.name });
        iconX += iconSize + 2;
      }
    }
    const cx = sx + this.size / 2;
    const cy = sy + this.size / 2;
    if (gameTime != null) {
      if (this.burnUntil != null && gameTime < this.burnUntil) {
        ctx.fillStyle = `rgba(251, 146, 60, 0.4)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.burnUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
      }
      if (this.slowUntil != null && gameTime < this.slowUntil) {
        ctx.fillStyle = `rgba(147, 197, 253, 0.45)`;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(sx, sy, this.size, this.size);
        ctx.globalAlpha = 1;
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.slowUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
      }
      if (this.stunUntil != null && gameTime < this.stunUntil) {
        ctx.fillStyle = `rgba(250, 204, 21, 0.6)`;
        ctx.beginPath();
        ctx.arc(cx + 4, cy - 4, 4, 0, Math.PI * 2);
        ctx.arc(cx - 4, cy + 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.stunUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
      }
      if (this.toxicStacks > 0 && this.toxicUntil != null && gameTime < this.toxicUntil) {
        ctx.fillStyle = `rgba(34, 197, 94, 0.5)`;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText((this.toxicUntil - gameTime).toFixed(1) + "s x" + this.toxicStacks, cx, sy - 4);
      }
      if (this.voidDefenseUntil != null && gameTime < this.voidDefenseUntil) {
        ctx.strokeStyle = `rgba(88, 28, 135, 0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, this.size * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#e9d5ff";
        ctx.textAlign = "center";
        ctx.fillText((this.voidDefenseUntil - gameTime).toFixed(1) + "s", cx, sy - 4);
      }
    }
  }
}
