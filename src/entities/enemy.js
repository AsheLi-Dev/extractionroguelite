import { Vec2 } from '../utils.js';
import { pointToSegmentDist } from '../utils.js';
import { getWallCollisionRect, getObstacleCollisionRect, obstacleIntersectsRect, assetUrl } from '../utils.js';
import {
  BRUTE_1_SPRITE_PROFILE,
  WARRIOR_6_SPRITE_PROFILE,
  bruteSheetRecoveringHoldAttackStrip,
  bruteSheetStrikeAnimActive,
  resolveBruteSheetArchetype
} from './brute-sheet-archetype.js';
import { getHumanSquadTypeDef, HUMAN_SQUAD_ENEMY_IDS } from '../data/human-squad-data.js';
import {
  createHumanSquadAnimState,
  setHumanSquadAnimState,
  updateHumanSquadAnim,
  getHumanSquadAnimFrame,
  getSheet,
  getSheetFrameCount,
  loadHumanSquadSheets,
} from './human-squad-anim.js';
import {
  buildHeroPackEnemySpriteSheets,
  getHeroPackDirectionIndexFromWorld,
  mirrorHeroPackDirectionForRow,
  getHeroPackLoopLength,
  mapHeroPackColumn,
} from './hero-pack-enemy-sprites.js';

const DISABLE_ENEMY_SHEET_PRELOADS =
  typeof window !== "undefined" && !!window.__DISABLE_ENEMY_SHEET_PRELOADS__;
if (!DISABLE_ENEMY_SHEET_PRELOADS) {
  loadHumanSquadSheets();
}

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

// Drop band mapping: dropChanceMult (low -50%, mid +10%, high +80%), min/maxDrop for quantity
const DROP_BAND_MAP = {
  "low": { dropChanceMult: 0.5, minDrop: 1, maxDrop: 1 },
  "mid": { dropChanceMult: 1.1, minDrop: 1, maxDrop: 2 },
  "high": { dropChanceMult: 1.8, minDrop: 2, maxDrop: 3 }
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
    spriteSet: enemyData.spriteSet || null,
    archetype: enemyData.archetype,
    attackStyle: enemyData.attackStyle,
    xpBand: enemyData.xpBand,
    dropBand: enemyData.dropBand,
    notes: enemyData.notes,
    spawnPool: enemyData.spawnPool || "default",
    enemyFamily: enemyData.enemyFamily || null,
    sourceEnemyId: enemyData.sourceEnemyId || null,
    spriteProfile: enemyData.spriteProfile || null,
    bruteSheetArchetype: enemyData.bruteSheetArchetype
  };
}

// New enemy database
const NEW_ENEMY_DATA = [
  // Row 1  Orc/Goblin set (humanoid minions)
  {"id":"m_1a_orc","name":"Orc","atlas":{"row":1,"col":"a"},"spriteSet":"orc_regular","archetype":"Skeleton","base":{"size":86,"hp":60,"atk":10,"speed":70,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Baseline bruiser. Good affixes: Volatile, Weakening."},
  {"id":"m_1b_orc_wizard","name":"Orc Wizard","atlas":{"row":1,"col":"b"},"archetype":"Wisp","base":{"size":72,"hp":26,"atk":7,"speed":110,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Caster minion. Good affixes: Lasering, Cursing."},
  {"id":"m_1c_goblin","name":"Goblin","atlas":{"row":1,"col":"c"},"spriteSet":"goblin_regular","archetype":"Bat","base":{"size":72,"hp":25,"atk":8,"speed":100,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Fast skirmisher."},
  {"id":"m_1d_orc_blademaster","name":"Orc Blademaster","atlas":{"row":1,"col":"d"},"archetype":"Skeleton","base":{"size":86,"hp":55,"atk":11,"speed":85,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Faster undead-tier melee."},
  {"id":"m_1e_orc_warchief","name":"Orc Warchief","atlas":{"row":1,"col":"e"},"archetype":"Demon","base":{"size":103,"hp":95,"atk":15,"speed":55,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Leader brute. Great as Elite/Mini-boss."},
  {"id":"m_1f_goblin_archer","name":"Goblin Archer","atlas":{"row":1,"col":"f"},"spriteSet":"goblin_archer_regular","archetype":"Bat","base":{"size":72,"hp":22,"atk":7,"speed":105,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"low","notes":"Ranged poke. Works with Volatile for bullet hell moments."},
  {"id":"m_1g_goblin_mage","name":"Goblin Mage","atlas":{"row":1,"col":"g"},"spriteSet":"goblin_mage_regular","archetype":"Wisp","base":{"size":72,"hp":24,"atk":6,"speed":120,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Glass cannon caster. Great with Lasering."},
  {"id":"m_1h_goblin_brute","name":"Goblin Brute","atlas":{"row":1,"col":"h"},"spriteSet":"goblin_brute_regular","archetype":"Skeleton","base":{"size":86,"hp":70,"atk":10,"speed":65,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Slow-ish bruiser."},
  {"id":"m_gk_goblin_king","name":"GoblinKing","atlas":{"row":1,"col":"a"},"spriteSet":"goblin_king_regular","archetype":"Demon","base":{"size":96,"hp":2000,"atk":14,"speed":55,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","spawnPool":"special","notes":"Special mini-boss. Fixed 2000 HP. Drops 3 rare. Retinue flees on death."},
  {"id":"m_ge_goblin_elite","name":"GoblinElite","atlas":{"row":1,"col":"a"},"spriteSet":"goblin_elite_regular","archetype":"Skeleton","base":{"size":86,"hp":100,"atk":10,"speed":75,"def":1},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","spawnPool":"special","notes":"GoblinKing retinue. Fixed 100 HP. Flees when king dies."},
  {"id":"m_gn_goblin_normal","name":"GoblinNormal","atlas":{"row":1,"col":"a"},"spriteSet":"goblin_normal_regular","archetype":"Bat","base":{"size":72,"hp":50,"atk":7,"speed":95,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","spawnPool":"special","notes":"GoblinKing retinue. Fixed 50 HP. Flees when king dies."},

  // Row 2  Giants
  {"id":"m_2a_ettin","name":"Ettin","atlas":{"row":2,"col":"a"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":14,"speed":50,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Big threat. Great as Elite/Mini-boss."},
  {"id":"m_2b_two_headed_ettin","name":"Two-Headed Ettin","atlas":{"row":2,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":52,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Stronger ettin variant. Perfect Mini-boss."},
  {"id":"m_2c_troll","name":"Troll","atlas":{"row":2,"col":"c"},"spriteSet":"troll_regular","archetype":"Demon","base":{"size":103,"hp":90,"atk":13,"speed":58,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Tanky brawler. Good with Weakening."},
  {"id":"m_2d_rock_giant","name":"RockGiant","atlas":{"row":2,"col":"d"},"spriteSet":"rock_giant_regular","archetype":"Demon","base":{"size":120,"hp":400,"atk":18,"speed":35,"def":4},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Large. Attack A: 5 falling rocks 1s delay. Attack B: cone strike. Heals 10% once under 50%. Hit reaction when hit while walking."},

  // Row 3  Slimes
  {"id":"m_3a_small_slime","name":"Small Slime","atlas":{"row":3,"col":"a"},"spriteSet":"small_slime_regular","archetype":"Slime","base":{"size":86,"hp":40,"atk":6,"speed":60,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Baseline slime."},
  {"id":"m_3e_medium_slime","name":"Medium Slime","atlas":{"row":3,"col":"e"},"spriteSet":"medium_slime_regular","archetype":"Slime","base":{"size":96,"hp":60,"atk":8,"speed":58,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Mid-tier slime. Duplicate of Small Slime with different sprite."},
  {"id":"m_3b_big_slime","name":"Big Slime","atlas":{"row":3,"col":"b"},"spriteSet":"big_slime_regular","archetype":"Demon","base":{"size":103,"hp":80,"atk":9,"speed":55,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Bigger slime tank."},
  {"id":"m_3c_slimebody","name":"Slimebody","atlas":{"row":3,"col":"c"},"archetype":"Skeleton","base":{"size":86,"hp":55,"atk":9,"speed":70,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Humanoid slime. Good with Volatile."},
  {"id":"m_3d_merged_slimebodies","name":"Merged Slimebodies","atlas":{"row":3,"col":"d"},"archetype":"Demon","base":{"size":103,"hp":95,"atk":12,"speed":52,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite slime amalgam."},

  // Row 4  Cleric/Monk types
  {"id":"m_4a_faceless_monk","name":"Faceless Monk","atlas":{"row":4,"col":"a"},"archetype":"Bat","base":{"size":72,"hp":30,"atk":8,"speed":115,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast striker. Good with Orbiting."},
  {"id":"m_4b_unholy_cardinal","name":"Unholy Cardinal","atlas":{"row":4,"col":"b"},"archetype":"Wisp","base":{"size":72,"hp":35,"atk":9,"speed":95,"def":1},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"mid","notes":"Support caster feel. Great with Weakening/Cursing."},

  // Row 5  Undead set
  {"id":"m_5a_skeleton","name":"Skeleton","atlas":{"row":5,"col":"a"},"spriteSet":"skeleton_regular","archetype":"Skeleton","base":{"size":86,"hp":60,"atk":10,"speed":70,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Your existing Skeleton baseline. Randomly uses one of three 4-frame sprite variants."},
  {"id":"m_5b_skeleton_archer","name":"Skeleton Archer","atlas":{"row":5,"col":"b"},"spriteSet":"skeleton_archer_regular","archetype":"Skeleton","base":{"size":172,"hp":58,"atk":9,"speed":94,"def":1},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"mid","notes":"Ranged skeleton archer using Skeleton Archer-Sheet atlas."},
  {"id":"m_5bw_skeleton_warrior","name":"Skeleton Warrior","atlas":{"row":5,"col":"g"},"spriteSet":"skeleton_warrior_regular","archetype":"Skeleton","base":{"size":172,"hp":72,"atk":11,"speed":83,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Melee skeleton with shield sheet; Skeleton_Warrior-Sheet atlas."},
  {"id":"m_5c_lich","name":"Lich","atlas":{"row":5,"col":"c"},"spriteSet":"lich_regular","archetype":"Demon","base":{"size":86,"hp":85,"atk":12,"speed":60,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Caster boss-lite. Great with Lasering."},
  {"id":"m_5d_death_knight","name":"Death Knight","atlas":{"row":5,"col":"d"},"spriteSet":"death_knight_regular","archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":50,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Top-tier melee. Perfect Mini-boss."},
  {"id":"m_5z_death_bringer","name":"DeathBringer","atlas":{"row":5,"col":"e"},"spriteSet":"death_bringer_regular","archetype":"Demon","base":{"size":206,"hp":90,"atk":12,"speed":55,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Caster with cone melee and delayed ground spell at player."},
  {"id":"m_5dl_death_lord","name":"Death Lord","atlas":{"row":5,"col":"i"},"spriteSet":"death_lord_regular","archetype":"Demon","base":{"size":344,"hp":110,"atk":13,"speed":58,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Cone cleave and six-bolt volley; Death Knight-Sheet.png + Effect-Sheet volley (110x80 / 48x8)."},
  {"id":"m_5e_zombie","name":"Zombie","atlas":{"row":5,"col":"e"},"spriteSet":"zombie_regular","archetype":"Slime","base":{"size":86,"hp":70,"atk":8,"speed":55,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Slow tank. Good with Volatile/Orbiting."},
  {"id":"m_5g_small_dummy","name":"Small Dummy","atlas":{"row":5,"col":"e"},"spriteSet":"small_dummy_regular","archetype":"Slime","base":{"size":86,"hp":70,"atk":8,"speed":55,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Zombie-equivalent test enemy."},
  {"id":"m_5k_small_dwarfette","name":"Small Dwarfette","atlas":{"row":5,"col":"e"},"spriteSet":"small_dwarfette_regular","archetype":"Slime","base":{"size":86,"hp":70,"atk":8,"speed":55,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Small dummy variant with dash attack."},
  {"id":"m_5l_medium_dwarfette","name":"Medium Dwarfette","atlas":{"row":5,"col":"e"},"spriteSet":"medium_dwarfette_regular","archetype":"Slime","base":{"size":96,"hp":85,"atk":10,"speed":52,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Rolling attacker that bounces off walls and obstacles."},
  {"id":"m_5m_strong_dwarfette","name":"Strong Dwarfette","atlas":{"row":5,"col":"e"},"spriteSet":"strong_dwarfette_regular","archetype":"Slime","base":{"size":112,"hp":85,"atk":10,"speed":52,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Medium Dwarfette variant with larger hitbox and slower rolling attack."},
  {"id":"m_5n_large_dwarfette_ball","name":"Large Dwarfette Ball","atlas":{"row":5,"col":"e"},"spriteSet":"large_dwarfette_ball_regular","archetype":"Slime","base":{"size":128,"hp":85,"atk":10,"speed":48,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Strong Dwarfette variant with larger hitbox and slower rolling attack."},
  {"id":"m_5o_small_mimic","name":"Small Mimic","atlas":{"row":5,"col":"e"},"spriteSet":"small_mimic_regular","archetype":"Bat","base":{"size":78,"hp":58,"atk":6,"speed":130,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Skittish looter that runs from the player and steals floor loot."},
  {"id":"m_5p_medium_mimic","name":"Medium Mimic","atlas":{"row":5,"col":"e"},"spriteSet":"medium_mimic_regular","archetype":"Bat","base":{"size":92,"hp":92,"atk":6,"speed":130,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Larger mimic variant with the same loot-stealing behavior and higher HP."},
  {"id":"m_5q_strong_mimic","name":"Strong Mimic","atlas":{"row":5,"col":"e"},"spriteSet":"strong_mimic_regular","archetype":"Skeleton","base":{"size":98,"hp":120,"atk":10,"speed":95,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Sword-thrust mimic that disarms the player and is escorted by small mimics."},
  {"id":"m_5r_large_mimic","name":"Large Mimic","atlas":{"row":5,"col":"e"},"spriteSet":"large_mimic_regular","archetype":"Skeleton","base":{"size":116,"hp":150,"atk":12,"speed":72,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Slow dashing mimic that can disarm heavily and launch random projectiles while moving."},
  {"id":"m_5s_small_frog","name":"Small Frog","atlas":{"row":5,"col":"e"},"spriteSet":"small_frog_regular","archetype":"Bat","base":{"size":64,"hp":36,"atk":5,"speed":110,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Very fast mover with no special attack kit."},
  {"id":"m_5t_large_frog","name":"Large Frog","atlas":{"row":5,"col":"e"},"spriteSet":"large_frog_regular","archetype":"Slime","base":{"size":118,"hp":130,"atk":11,"speed":78,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Uses burp-spit and jump slam attacks."},
  {"id":"m_5u_cyclop_archer","name":"Cyclop Archer","atlas":{"row":5,"col":"e"},"spriteSet":"cyclop_archer_regular","archetype":"Skeleton","base":{"size":92,"hp":78,"atk":10,"speed":92,"def":1},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"mid","notes":"Ranged cyclop archer variant."},
  {"id":"m_5v_monsteryfly","name":"Monsteryfly","atlas":{"row":5,"col":"e"},"spriteSet":"monsteryfly_regular","archetype":"Bat","base":{"size":96,"hp":95,"atk":10,"speed":108,"def":1},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Leaping flyer that prepares, slams, then recovers."},
  {"id":"m_5w_monster_slasher","name":"MonsterSlasher","atlas":{"row":5,"col":"e"},"spriteSet":"monster_slasher_regular","archetype":"Skeleton","base":{"size":98,"hp":105,"atk":11,"speed":90,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Roars then performs a two-step cone slash combo."},
  {"id":"m_5x_vampire_archer","name":"Vampire Archer","atlas":{"row":5,"col":"e"},"spriteSet":"vampire_archer_regular","archetype":"Skeleton","base":{"size":96,"hp":82,"atk":10,"speed":96,"def":1},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"mid","notes":"Quick burst archer that restores health on projectile hits."},
  {"id":"m_5y_mercenary","name":"Mercenary","atlas":{"row":5,"col":"e"},"spriteSet":"mercenary_regular","archetype":"Skeleton","base":{"size":104,"hp":110,"atk":10,"speed":72,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Warrior using cyclone spin that advances toward the player."},
  {"id":"m_5h_medium_dummy","name":"Medium Dummy","atlas":{"row":5,"col":"e"},"spriteSet":"medium_dummy_regular","archetype":"Slime","base":{"size":96,"hp":85,"atk":10,"speed":50,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Spin-attack dummy variant."},
  {"id":"m_5i_advanced_dummy","name":"Advanced Dummy","atlas":{"row":5,"col":"e"},"spriteSet":"advanced_dummy_regular","archetype":"Slime","base":{"size":96,"hp":85,"atk":10,"speed":50,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Medium dummy variant with spin and dash attacks."},
  {"id":"m_5j_large_dummy","name":"Large Dummy","atlas":{"row":5,"col":"e"},"spriteSet":"large_dummy_regular","archetype":"Slime","base":{"size":112,"hp":120,"atk":12,"speed":42,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Heavy dummy that performs a slow, slightly homing charge."},
  {"id":"m_5f_ghoul","name":"Ghoul","atlas":{"row":5,"col":"f"},"archetype":"Bat","base":{"size":72,"hp":38,"atk":9,"speed":110,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast undead. Great with Cursing."},

  // Row 6  Ghosts/Cult
  {"id":"m_6a_banshee","name":"Banshee","atlas":{"row":6,"col":"a"},"spriteSet":"banshee_regular","archetype":"Wisp","base":{"size":200,"hp":28,"atk":7,"speed":118,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Sheet: Banshee-Sheet (110x80); melee wail slash + magic scream cone."},
  {"id":"m_6b_reaper","name":"Reaper","atlas":{"row":6,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":90,"atk":15,"speed":55,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite assassin. Great with Weakening/Cursing."},
  {"id":"m_6c_wraith","name":"Wraith","atlas":{"row":6,"col":"c"},"archetype":"Wisp","base":{"size":72,"hp":20,"atk":5,"speed":130,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Your existing Wisp-like baseline."},
  {"id":"m_6d_cultist","name":"Cultist","atlas":{"row":6,"col":"d"},"spriteSet":"cultist_regular","archetype":"Bat","base":{"size":72,"hp":28,"atk":7,"speed":105,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Ranged/utility. Great with Weakening."},
  {"id":"m_6e_hag_witch","name":"Hag / Witch","atlas":{"row":6,"col":"e"},"archetype":"Wisp","base":{"size":72,"hp":30,"atk":8,"speed":100,"def":1},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Debuff caster. Perfect for Weakening/Cursing."},
  {"id":"m_6f_ghost","name":"Ghost","atlas":{"row":6,"col":"f"},"spriteSet":"ghost_regular","archetype":"Wisp","base":{"size":72,"hp":24,"atk":6,"speed":115,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Small ethereal. Randomly uses one of three 4-frame ghost sprites."},

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
  {"id":"m_8f_forest_spirit","name":"Forest Spirit","atlas":{"row":8,"col":"f"},"spriteSet":"forest_spirit_regular","archetype":"Wisp","base":{"size":72,"hp":22,"atk":6,"speed":125,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Fast caster."},
  {"id":"m_8g_satyr","name":"Satyr","atlas":{"row":8,"col":"g"},"archetype":"Bat","base":{"size":72,"hp":35,"atk":8,"speed":115,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Quick melee."},
  {"id":"m_8h_minotaur","name":"Minotaur","atlas":{"row":8,"col":"h"},"spriteSet":"minotaur_regular","archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":55,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Classic boss bruiser."},
  {"id":"m_8i_harpy","name":"Harpy","atlas":{"row":8,"col":"i"},"archetype":"Bat","base":{"size":72,"hp":28,"atk":8,"speed":125,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast aerial vibe. Great with Volatile."},
  {"id":"m_8j_gorgon_medusa","name":"Gorgon / Medusa","atlas":{"row":8,"col":"j"},"archetype":"Wisp","base":{"size":86,"hp":45,"atk":10,"speed":80,"def":1},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Control caster feel. Great with Lasering/Weakening."},

  // Row 9  Reptilians/dragons
  {"id":"m_9a_lizardfolk_kobold_reptile","name":"Lizardfolk / Kobold (Reptile)","atlas":{"row":9,"col":"a"},"archetype":"Skeleton","base":{"size":86,"hp":50,"atk":9,"speed":85,"def":2},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Baseline reptile warrior."},
  {"id":"m_9b_drake_lesser_dragon","name":"Drake / Lesser Dragon","atlas":{"row":9,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":85,"atk":14,"speed":70,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Elite ranged threat."},
  {"id":"m_9c_dragon","name":"Dragon","atlas":{"row":9,"col":"c"},"spriteSet":"dragon_regular","archetype":"Demon","base":{"size":103,"hp":100,"atk":15,"speed":55,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"Boss-grade. Great Mini-boss."},
  {"id":"m_9d_cockatrice","name":"Cockatrice","atlas":{"row":9,"col":"d"},"archetype":"Bat","base":{"size":72,"hp":30,"atk":8,"speed":120,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Fast pecker. Great with Cursing."},
  {"id":"m_9f_bastilisk","name":"Basilisk","atlas":{"row":9,"col":"f"},"spriteSet":"bastilisk_regular","archetype":"Bat","base":{"size":72,"hp":28,"atk":7,"speed":115,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Small reptile. Ignores walls and obstacles. Random 4-frame sprite variant."},

  // Row 10  Canine kobolds
  {"id":"m_10a_small_kobold_canine","name":"Small Kobold (Canine)","atlas":{"row":10,"col":"a"},"archetype":"Bat","base":{"size":72,"hp":22,"atk":6,"speed":125,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Small fast trash."},
  {"id":"m_10b_kobold_canine","name":"Kobold (Canine)","atlas":{"row":10,"col":"b"},"archetype":"Bat","base":{"size":72,"hp":28,"atk":7,"speed":115,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"low","notes":"Slightly tougher kobold."},

  // Row 11  Myconids
  {"id":"m_11a_small_myconid","name":"Small Myconid","atlas":{"row":11,"col":"a"},"spriteSet":"small_myconid_regular","archetype":"Slime","base":{"size":72,"hp":35,"atk":7,"speed":60,"def":1},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Slow fungal minion."},
  {"id":"m_11b_large_myconid","name":"Large Myconid","atlas":{"row":11,"col":"b"},"archetype":"Skeleton","base":{"size":86,"hp":65,"atk":10,"speed":55,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","notes":"Tanky fungal."},

  // Row 12  Celestial/Infernal
  {"id":"m_12a_angel_archangel","name":"Angel / Archangel","atlas":{"row":12,"col":"a"},"archetype":"Demon","base":{"size":103,"hp":90,"atk":13,"speed":70,"def":3},"attackStyle":"ranged_projectile","xpBand":"elite_like","dropBand":"high","notes":"High-threat ranged. Great with Lasering."},
  {"id":"m_12b_imp_devil","name":"Imp / Devil","atlas":{"row":12,"col":"b"},"archetype":"Wisp","base":{"size":72,"hp":20,"atk":6,"speed":130,"def":0},"attackStyle":"ranged_projectile","xpBand":"basic","dropBand":"mid","notes":"Fast projectile spammer. Great with Volatile."},

  // Row 13  Writhing masses
  {"id":"m_13a_small_writhing_mass","name":"Small Writhing Mass","atlas":{"row":13,"col":"a"},"archetype":"Slime","base":{"size":72,"hp":40,"atk":6,"speed":60,"def":0},"attackStyle":"melee_contact","xpBand":"basic","dropBand":"mid","notes":"Creepy slime-equivalent."},
  {"id":"m_13b_large_writhing_mass","name":"Large Writhing Mass","atlas":{"row":13,"col":"b"},"archetype":"Demon","base":{"size":103,"hp":90,"atk":12,"speed":50,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Elite tank horror."},
  {"id":"m_13c_writhing_humanoid","name":"Writhing Humanoid","atlas":{"row":13,"col":"c"},"archetype":"Skeleton","base":{"size":86,"hp":60,"atk":11,"speed":70,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"high","notes":"Medium elite horror. Great with Weakening/Cursing."},
  {"id":"m_ud_brute","name":"Undead Brute","atlas":{"row":5,"col":"e"},"archetype":"Skeleton","base":{"size":172,"hp":88,"atk":12,"speed":100,"def":3},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","spawnPool":"default","spriteProfile":BRUTE_1_SPRITE_PROFILE,"notes":"1Brute assets; brute-sheet archetype (see brute-sheet-archetype.js, auto-enabled for this id)."},
  {"id":"m_ud_warrior","name":"Undead Warrior","atlas":{"row":5,"col":"f"},"archetype":"Skeleton","base":{"size":160,"hp":76,"atk":11,"speed":102,"def":2},"attackStyle":"melee_contact","xpBand":"elite_like","dropBand":"mid","spawnPool":"default","spriteProfile":WARRIOR_6_SPRITE_PROFILE,"notes":"6Warrior assets; brute-sheet archetype (legacy id m_ud_warrior). Attack1=up slash, Attack2=down, Attack3=double shield bash."}
];

const ENEMY_DATA_BY_ID = new Map(NEW_ENEMY_DATA.map((enemyData) => [enemyData.id, enemyData]));

const UNDEAD_HERO_BLUEPRINTS = [
  {
    id: "uh_fallen_warlord",
    sourceEnemyId: "m_5d_death_knight",
    name: "Undead Hero: Fallen Warlord"
  },
  {
    id: "uh_blight_archmage",
    sourceEnemyId: "m_5c_lich",
    name: "Undead Hero: Blight Archmage"
  },
  {
    id: "uh_grave_ranger",
    sourceEnemyId: "m_5x_vampire_archer",
    name: "Undead Hero: Grave Ranger"
  }
];

function createUndeadHeroData(blueprint) {
  const source = ENEMY_DATA_BY_ID.get(blueprint.sourceEnemyId);
  if (!source) return null;
  const base = source.base || {};
  const sourceDef = Number(base.def) || 0;
  return {
    ...source,
    id: blueprint.id,
    name: blueprint.name,
    base: {
      ...base,
      size: Math.round((Number(base.size) || 80) * 1.05),
      hp: Math.round((Number(base.hp) || 50) * 1.45),
      atk: Math.round((Number(base.atk) || 8) * 1.3),
      speed: Math.round((Number(base.speed) || 80) * 1.05),
      def: Math.max(sourceDef + 1, Math.round(sourceDef * 1.35))
    },
    xpBand: "elite_like",
    dropBand: "high",
    spawnPool: "special",
    enemyFamily: "undeadHero",
    sourceEnemyId: source.id,
    notes: `Special undead hero variant of ${source.name}.`
  };
}

const _fromData = NEW_ENEMY_DATA.map(convertEnemyData);
const _undeadHeroData = UNDEAD_HERO_BLUEPRINTS.map(createUndeadHeroData).filter(Boolean);
const _undeadHeroTypes = _undeadHeroData.map(convertEnemyData);
export const UNDEAD_HERO_TYPES = [..._undeadHeroTypes];
const _humanSquadTypes = HUMAN_SQUAD_ENEMY_IDS.map((id) => getHumanSquadTypeDef(id)).filter(Boolean);
export const ENEMY_TYPES = [..._fromData, ..._humanSquadTypes];

export const BOSS_XP = 200;

export const AFFIX_DEFS = [
  { id: "swift", name: "Swift", icon: "tile_0423_r26_c07", color: "#fbbf24" },
  { id: "volatile", name: "Volatile", icon: "tile_0002_r00_c02", color: "#f97316" },
  { id: "evasive", name: "Evasive", icon: "tile_0332_r20_c12", color: "#a78bfa" },
  { id: "auraBearer", name: "Aura Bearer", icon: "tile_0371_r23_c03", color: "#ec4899" },
  { id: "martyr", name: "Martyr", icon: "tile_0442_r27_c10", color: "#78716c" },
  { id: "undying", name: "Undying", icon: "tile_0365_r22_c13", color: "#7c3aed" },
  { id: "agile", name: "Agile", icon: "tile_0423_r26_c07", color: "#34d399" },
  { id: "invisible", name: "Invisible", icon: "tile_0346_r21_c10", color: "#64748b" },
  { id: "wall", name: "Wall", icon: "tile_0002_r00_c02", color: "#6b7280" },
  { id: "boulder", name: "Boulder", icon: "tile_0002_r00_c02", color: "#a16207" },
  { id: "inking", name: "Inking", icon: "tile_0002_r00_c02", color: "#111827" },
  { id: "orbiting", name: "Orbiting", icon: "tile_0049_r03_c01", color: "#f59e0b" },
  { id: "lasering", name: "Lasering", icon: "tile_0327_r20_c07", color: "#06b6d4" },
  { id: "phantom", name: "Phantom", icon: "tile_0346_r21_c10", color: "#94a3b8" },
  { id: "cursing", name: "Cursing", icon: "tile_0312_r19_c08", color: "#8b5cf6" },
  { id: "erratic", name: "Erratic", icon: "tile_0259_r16_c03", color: "#e879f9" },
  { id: "hive", name: "Hive", icon: "tile_0394_r24_c10", color: "#64748b" },
  { id: "deflecting", name: "Deflecting", icon: "tile_0049_r03_c01", color: "#38bdf8" },
  { id: "guarded", name: "Guarded", icon: "tile_0049_r03_c01", color: "#a855f7" },
  { id: "flying", name: "Flying", icon: "tile_0423_r26_c07", color: "#22d3ee" }
];

export function getAffixDef(id) {
  return AFFIX_DEFS.find((a) => a.id === id) || { id, name: id, icon: "?", color: "#94a3b8" };
}

/**
 * Cumulative XP required to reach level (same curve as simulator).
 * XP to next level = 120 + 35·level + 4·level² (level = current level before leveling).
 */
export function getXpForLevel(level) {
  const L = Math.max(1, Math.floor(level));
  if (L <= 1) return 0;
  let sum = 0;
  for (let i = 1; i < L; i++) {
    sum += 120 + 35 * i + 4 * i * i;
  }
  return sum;
}

/* Level-up stat bonuses replaced by attack upgrade/penalty cards (see ATTACK_UPGRADE_DEFS and showLevelUpChoices). */

export let ENEMY_ID_COUNTER = 0;

// Shared sprite atlas for all enemies
let enemySpriteAtlas = null;
let enemySpriteAtlasLoaded = false;
let affixIconAtlas = null;
let affixIconAtlasLoaded = false;
const goblinRegularSheetCache = new Map();
const GOBLIN_VARIANT_IDS = ["01", "02", "03"];
const goblinArcherSheetCache = new Map();
const GOBLIN_ARCHER_VARIANT_IDS = ["01", "02", "03"];
const goblinBruteSheetCache = new Map();
const GOBLIN_BRUTE_VARIANT_IDS = ["01", "02", "03"];
const goblinMageSheetCache = new Map();
const orcRegularSheetCache = new Map();
const ORC_VARIANT_IDS = ["01", "02", "03"];
const cultistSheetCache = new Map();
const deathKnightSheetCache = new Map();
const lichSheetCache = new Map();
const minotaurSheetCache = new Map();
const MINOTAUR_VARIANT_IDS = ["1", "2", "3"];
const forestSpiritSheetCache = new Map();
const smallMyconidSheetCache = new Map();
const smallDummySheetCache = new Map();
const mediumDummySheetCache = new Map();
const advancedDummySheetCache = new Map();
const largeDummySheetCache = new Map();
const smallDwarfetteSheetCache = new Map();
const mediumDwarfetteSheetCache = new Map();
const strongDwarfetteSheetCache = new Map();
const largeDwarfetteBallSheetCache = new Map();
const smallMimicSheetCache = new Map();
const mediumMimicSheetCache = new Map();
const strongMimicSheetCache = new Map();
const largeMimicSheetCache = new Map();
const smallFrogSheetCache = new Map();
const largeFrogSheetCache = new Map();
const cyclopArcherSheetCache = new Map();
const monsteryflySheetCache = new Map();
const monsterSlasherSheetCache = new Map();
const vampireArcherSheetCache = new Map();
const mercenarySheetCache = new Map();
const deathBringerSheetCache = new Map();
const dragonSheetCache = new Map();
const zombieSheetCache = new Map();
const smallSlimeSheetCache = new Map();
const mediumSlimeSheetCache = new Map();
const bigSlimeSheetCache = new Map();
const trollSheetCache = new Map();
const ghostSheetCache = new Map();
const GHOST_VARIANT_IDS = ["1", "2", "3"];
const skeletonSheetCache = new Map();
const SKELETON_VARIANT_IDS = ["1", "2", "3"];
const skeletonArcherSheetCache = new Map();
const skeletonWarriorSheetCache = new Map();
const deathLordSheetCache = new Map();
const bansheeSheetCache = new Map();
const bastiliskSheetCache = new Map();
const BASTILISK_VARIANT_IDS = ["1", "2", "3"];
const goblinKingSheetCache = new Map();
const goblinEliteSheetCache = new Map();
const goblinNormalSheetCache = new Map();

function getCachedSpriteImage(cache, path, warningLabel) {
  let image = cache.get(path);
  if (image) return image;
  image = new Image();
  image.onerror = () => {
    console.warn(`Failed to load ${warningLabel}: ${path}`);
  };
  image.src = assetUrl(path);
  cache.set(path, image);
  return image;
}

function shouldUseMovingAnim(enemy, moved) {
  const currentState = enemy?.humanAnimState?.state || enemy?.spriteAnimState?.state || "idle";
  const isCurrentlyMoving = currentState === "move" || currentState === "run";
  const startThreshold = 0.16;
  const stopThreshold = 0.04;
  return isCurrentlyMoving ? moved > stopThreshold : moved > startThreshold;
}

/** Kind for sprite FSM: current strike, or last strike while in recover (currentAttack cleared). */
function getEnemyAttackKindForSpriteAnim(attackCtrl) {
  const a = attackCtrl?.currentAttack;
  if (a?.kind) return a.kind;
  const rid = attackCtrl?.recoveringAttackId;
  if (!rid || !Array.isArray(attackCtrl?.availableAttacks)) return null;
  const def = attackCtrl.availableAttacks.find((x) => x.id === rid);
  return def?.kind ?? null;
}

function isConeLikeStrikeAttackKind(kind) {
  return kind === "cone" || kind === "timed_double_cone";
}

/** True when sprite FSM is showing a strike sheet (not idle/move). */
function isEnemyStrikeSpriteAnimState(nextState) {
  if (!nextState || nextState === "idle" || nextState === "move") return false;
  return nextState.startsWith("attack");
}

/**
 * Generic FSM uses nextState "attack", but hero-pack multi-row enemies may only define attackDown/attackUp.
 * Map cone strike ids so windup/active use a real sheet (fixes Undead Brute if brute-specific flags ever miss).
 */
function resolveConeMultiSheetAnimState(enemy, nextState, attackCtrl) {
  if (
    nextState !== "attack" ||
    enemy.spriteSheets?.attack ||
    !attackCtrl ||
    (attackCtrl.state !== "windup" && attackCtrl.state !== "active")
  ) {
    return nextState;
  }
  const k = attackCtrl.currentAttack?.kind;
  if (!isConeLikeStrikeAttackKind(k)) return nextState;
  const id = String(attackCtrl.currentAttack?.id || "");
  if (enemy.spriteSheets?.attackDown && (id.includes("downslash") || id.includes("down_slash") || id.includes("low_cleave"))) {
    return "attackDown";
  }
  if (enemy.spriteSheets?.attackUp && (id.includes("upslash") || id.includes("up_slash") || id.includes("high_cleave"))) {
    return "attackUp";
  }
  return nextState;
}

function getGoblinRegularSheets(variantId) {
  const id = String(variantId || "01");
  const base = `assets/Enemies/Goblins/Goblin_Regular_${id}`;
  return {
    idle: {
      image: getCachedSpriteImage(goblinRegularSheetCache, `${base}_Idle_1x1.png`, "Goblin idle sheet"),
      frames: 1,
      fps: 1
    },
    move: {
      image: getCachedSpriteImage(goblinRegularSheetCache, `${base}_Move_10x1.png`, "Goblin move sheet"),
      frames: 10,
      fps: 14
    },
    attack: {
      image: getCachedSpriteImage(goblinRegularSheetCache, `${base}_ATK_Full_10x1.png`, "Goblin attack sheet"),
      frames: 10,
      fps: 18
    }
  };
}

function getGoblinArcherSheets(variantId) {
  const id = String(variantId || "01");
  const base = `assets/Enemies/Goblin Archers/Orc_Archer_${id}`;
  return {
    idle: {
      image: getCachedSpriteImage(goblinArcherSheetCache, `${base}_Idle_1x1.png`, "Goblin Archer idle sheet"),
      frames: 1,
      fps: 1
    },
    move: {
      image: getCachedSpriteImage(goblinArcherSheetCache, `${base}_Move_6x1.png`, "Goblin Archer move sheet"),
      frames: 6,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(goblinArcherSheetCache, `${base}_ATK_Full_18x1.png`, "Goblin Archer attack sheet"),
      frames: 18,
      fps: 22
    }
  };
}

function getGoblinBruteSheets(variantId) {
  const id = String(variantId || "01");
  const base = `assets/Enemies/Goblin Brutes/Goblin_Barrel_${id}`;
  return {
    idle: {
      image: getCachedSpriteImage(goblinBruteSheetCache, `${base}_Idle_1x1.png`, "Goblin Brute idle sheet"),
      frames: 1,
      fps: 1
    },
    move: {
      image: getCachedSpriteImage(goblinBruteSheetCache, `${base}_Move_10x1.png`, "Goblin Brute move sheet"),
      frames: 10,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(goblinBruteSheetCache, `${base}_ATK_Full_10x1.png`, "Goblin Brute attack sheet"),
      frames: 10,
      fps: 16
    }
  };
}

function getGoblinMageSheets() {
  const idleImage = getCachedSpriteImage(goblinMageSheetCache, "assets/Enemies/Goblin Mage/Idle_2x1.png", "Goblin Mage idle sheet");
  const moveImage = getCachedSpriteImage(goblinMageSheetCache, "assets/Enemies/Goblin Mage/Move_24x1.png", "Goblin Mage move sheet");
  return {
    idle: {
      image: idleImage,
      frames: 2,
      fps: 6
    },
    move: {
      image: moveImage,
      frames: 24,
      fps: 16
    },
    // No dedicated attack strip in this asset set, so use movement strip for attack state.
    attack: {
      image: moveImage,
      frames: 24,
      fps: 20
    }
  };
}

function getOrcRegularSheets(variantId) {
  const id = String(variantId || "01");
  const base = `assets/Enemies/Orc/Orc_Barbare_${id}`;
  return {
    idle: {
      image: getCachedSpriteImage(orcRegularSheetCache, `${base}_Idle_1x1.png`, "Orc idle sheet"),
      frames: 1,
      fps: 1
    },
    move: {
      image: getCachedSpriteImage(orcRegularSheetCache, `${base}_Move_5x1.png`, "Orc move sheet"),
      frames: 5,
      fps: 10
    },
    attack: {
      image: getCachedSpriteImage(orcRegularSheetCache, `${base}_ATK_Full_12x1.png`, "Orc attack sheet"),
      frames: 12,
      fps: 18
    }
  };
}

function getCultistSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(cultistSheetCache, "assets/Enemies/Cultist/Idle_8x1.png", "Cultist idle sheet"),
      frames: 8,
      fps: 10
    },
    move: {
      image: getCachedSpriteImage(cultistSheetCache, "assets/Enemies/Cultist/Move_12x1.png", "Cultist move sheet"),
      frames: 12,
      fps: 14
    },
    attack: {
      image: getCachedSpriteImage(cultistSheetCache, "assets/Enemies/Cultist/Attack_16x1.png", "Cultist attack sheet"),
      frames: 16,
      fps: 20
    }
  };
}

function getDeathKnightSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(deathKnightSheetCache, "assets/Enemies/Death Knight/Idle_2x1.png", "Death Knight idle sheet"),
      frames: 2,
      fps: 6
    },
    move: {
      image: getCachedSpriteImage(deathKnightSheetCache, "assets/Enemies/Death Knight/Move_24x1.png", "Death Knight move sheet"),
      frames: 24,
      fps: 14
    },
    // No dedicated attack strip in this set; use charge strip for attack state visuals.
    attack: {
      image: getCachedSpriteImage(deathKnightSheetCache, "assets/Enemies/Death Knight/Charge_2x1.png", "Death Knight charge sheet"),
      frames: 2,
      fps: 10
    }
  };
}

function getLichSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(lichSheetCache, "assets/Enemies/Lich/Idle_2x1.png", "Lich idle sheet"),
      frames: 2,
      fps: 6
    },
    move: {
      image: getCachedSpriteImage(lichSheetCache, "assets/Enemies/Lich/Move_24x1.png", "Lich move sheet"),
      frames: 24,
      fps: 14
    },
    attack: {
      image: getCachedSpriteImage(lichSheetCache, "assets/Enemies/Lich/Attack_Full_10x1.png", "Lich attack sheet"),
      frames: 10,
      fps: 18
    }
  };
}

function getMinotaurSheets(variantId) {
  const id = String(variantId || "1");
  const base = `assets/Enemies/Minotaur/Variant ${id}`;
  return {
    idle: {
      image: getCachedSpriteImage(minotaurSheetCache, `${base}/Idle_1x1.png`, "Minotaur idle sheet"),
      frames: 1,
      fps: 1
    },
    move: {
      image: getCachedSpriteImage(minotaurSheetCache, `${base}/Move_8x1.png`, "Minotaur move sheet"),
      frames: 8,
      fps: 10
    },
    // No dedicated normal attack strip; use charge begin strip for attack state visuals.
    attack: {
      image: getCachedSpriteImage(minotaurSheetCache, `${base}/Charge_Begin_24x1.png`, "Minotaur charge-begin sheet"),
      frames: 24,
      fps: 16
    }
  };
}

function getForestSpiritSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(forestSpiritSheetCache, "assets/Enemies/Forest Spirit/Idle_34x1.png", "Forest Spirit idle sheet"),
      frames: 34,
      fps: 14
    },
    move: {
      image: getCachedSpriteImage(forestSpiritSheetCache, "assets/Enemies/Forest Spirit/Move_26x1.png", "Forest Spirit move sheet"),
      frames: 26,
      fps: 14
    },
    attack: {
      image: getCachedSpriteImage(forestSpiritSheetCache, "assets/Enemies/Forest Spirit/Move_26x1.png", "Forest Spirit move sheet"),
      frames: 26,
      fps: 14
    },
    specialHeal: {
      image: getCachedSpriteImage(forestSpiritSheetCache, "assets/Enemies/Forest Spirit/SelfHeal_Full_54x1.png", "Forest Spirit self-heal sheet"),
      frames: 54,
      fps: 27
    }
  };
}

function getSmallMyconidSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(smallMyconidSheetCache, "assets/Enemies/Small Myconid/Idle_2x1.png", "Small Myconid idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(smallMyconidSheetCache, "assets/Enemies/Small Myconid/Move_20x1.png", "Small Myconid move sheet"),
      frames: 20,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(smallMyconidSheetCache, "assets/Enemies/Small Myconid/Attack_Full_60x1.png", "Small Myconid attack sheet"),
      frames: 60,
      // Attack window is ~1.05s (0.8 windup + 0.05 active + 0.2 recover).
      // Tune fps so one attack sequence can traverse the full 60-frame strip.
      fps: 57.142857,
      loop: false
    }
  };
}

function getSmallDummySheets() {
  return {
    idle: {
      image: getCachedSpriteImage(smallDummySheetCache, "assets/Enemies/Small_Dummy/Idle_2x1.png", "Small Dummy idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(smallDummySheetCache, "assets/Enemies/Small_Dummy/Move_12x1.png", "Small Dummy move sheet"),
      frames: 12,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(smallDummySheetCache, "assets/Enemies/Small_Dummy/DashAttack_Full_14x1.png", "Small Dummy attack sheet"),
      frames: 14,
      fps: 16
    }
  };
}

function getMediumDummySheets() {
  return {
    idle: {
      image: getCachedSpriteImage(mediumDummySheetCache, "assets/Enemies/Medium Dummy/Idle_2x1.png", "Medium Dummy idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(mediumDummySheetCache, "assets/Enemies/Medium Dummy/Move_12x1.png", "Medium Dummy move sheet"),
      frames: 12,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(mediumDummySheetCache, "assets/Enemies/Medium Dummy/Spinning_8x1.png", "Medium Dummy spin sheet"),
      frames: 8,
      fps: 14
    }
  };
}

function getAdvancedDummySheets() {
  return {
    idle: {
      image: getCachedSpriteImage(advancedDummySheetCache, "assets/Enemies/Advanced Dummy/Idle_2x1.png", "Advanced Dummy idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(advancedDummySheetCache, "assets/Enemies/Advanced Dummy/Move_12x1.png", "Advanced Dummy move sheet"),
      frames: 12,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(advancedDummySheetCache, "assets/Enemies/Advanced Dummy/Spinning_12x1.png", "Advanced Dummy spinning sheet"),
      frames: 12,
      fps: 14
    },
    attackDash: {
      image: getCachedSpriteImage(advancedDummySheetCache, "assets/Enemies/Advanced Dummy/Dash_Full_16x1.png", "Advanced Dummy dash sheet"),
      frames: 16,
      fps: 16
    }
  };
}

function getLargeDummySheets() {
  return {
    idle: {
      image: getCachedSpriteImage(largeDummySheetCache, "assets/Enemies/Large Dummy/Idle_2x1.png", "Large Dummy idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(largeDummySheetCache, "assets/Enemies/Large Dummy/Move_12x1.png", "Large Dummy move sheet"),
      frames: 12,
      fps: 10
    },
    attack: {
      image: getCachedSpriteImage(largeDummySheetCache, "assets/Enemies/Large Dummy/Charge_Full_14x1.png", "Large Dummy charge sheet"),
      frames: 14,
      fps: 12
    }
  };
}

function getSmallDwarfetteSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(smallDwarfetteSheetCache, "assets/Enemies/Small Dwarfette/Idle_12x1.png", "Small Dwarfette idle sheet"),
      frames: 12,
      fps: 10
    },
    move: {
      image: getCachedSpriteImage(smallDwarfetteSheetCache, "assets/Enemies/Small Dwarfette/Move_8x1.png", "Small Dwarfette move sheet"),
      frames: 8,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(smallDwarfetteSheetCache, "assets/Enemies/Small Dwarfette/Dash_Full_8x1.png", "Small Dwarfette dash sheet"),
      frames: 8,
      fps: 14
    }
  };
}

function getMediumDwarfetteSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(mediumDwarfetteSheetCache, "assets/Enemies/Medium Dwarfette/Idle_48x1.png", "Medium Dwarfette idle sheet"),
      frames: 48,
      fps: 16
    },
    move: {
      image: getCachedSpriteImage(mediumDwarfetteSheetCache, "assets/Enemies/Medium Dwarfette/Move_10x1.png", "Medium Dwarfette move sheet"),
      frames: 10,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(mediumDwarfetteSheetCache, "assets/Enemies/Medium Dwarfette/Dash_Loop_6x1.png", "Medium Dwarfette dash loop sheet"),
      frames: 6,
      fps: 14
    },
    attackRoll: {
      image: getCachedSpriteImage(mediumDwarfetteSheetCache, "assets/Enemies/Medium Dwarfette/Dash_Loop_6x1.png", "Medium Dwarfette dash loop sheet"),
      frames: 6,
      fps: 16
    },
    attackRollEnd: {
      image: getCachedSpriteImage(mediumDwarfetteSheetCache, "assets/Enemies/Medium Dwarfette/Dash_End_6x1.png", "Medium Dwarfette dash end sheet"),
      frames: 6,
      fps: 14,
      loop: false
    }
  };
}

function getStrongDwarfetteSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(strongDwarfetteSheetCache, "assets/Enemies/Strong Dwarfette/Idle_10x1.png", "Strong Dwarfette idle sheet"),
      frames: 10,
      fps: 12
    },
    move: {
      image: getCachedSpriteImage(strongDwarfetteSheetCache, "assets/Enemies/Strong Dwarfette/Move_16x1.png", "Strong Dwarfette move sheet"),
      frames: 16,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(strongDwarfetteSheetCache, "assets/Enemies/Strong Dwarfette/Dash_Loop_24x1.png", "Strong Dwarfette dash loop sheet"),
      frames: 24,
      fps: 16
    },
    attackRoll: {
      image: getCachedSpriteImage(strongDwarfetteSheetCache, "assets/Enemies/Strong Dwarfette/Dash_Loop_24x1.png", "Strong Dwarfette dash loop sheet"),
      frames: 24,
      fps: 18
    },
    attackRollEnd: {
      image: getCachedSpriteImage(strongDwarfetteSheetCache, "assets/Enemies/Strong Dwarfette/Dash_End_6x1.png", "Strong Dwarfette dash end sheet"),
      frames: 6,
      fps: 14,
      loop: false
    }
  };
}

function getLargeDwarfetteBallSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(largeDwarfetteBallSheetCache, "assets/Enemies/Large Dwarfette Ball/Idle_28x1.png", "Large Dwarfette Ball idle sheet"),
      frames: 28,
      fps: 12
    },
    move: {
      image: getCachedSpriteImage(largeDwarfetteBallSheetCache, "assets/Enemies/Large Dwarfette Ball/Move_28x1.png", "Large Dwarfette Ball move sheet"),
      frames: 28,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(largeDwarfetteBallSheetCache, "assets/Enemies/Large Dwarfette Ball/Dash_16x1.png", "Large Dwarfette Ball dash loop sheet"),
      frames: 16,
      fps: 14
    },
    attackRoll: {
      image: getCachedSpriteImage(largeDwarfetteBallSheetCache, "assets/Enemies/Large Dwarfette Ball/Dash_16x1.png", "Large Dwarfette Ball dash loop sheet"),
      frames: 16,
      fps: 16
    },
    attackRollEnd: {
      image: getCachedSpriteImage(largeDwarfetteBallSheetCache, "assets/Enemies/Large Dwarfette Ball/Dashend_6x1.png", "Large Dwarfette Ball dash end sheet"),
      frames: 6,
      fps: 12,
      loop: false
    }
  };
}

function getSmallMimicSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(smallMimicSheetCache, "assets/Enemies/Small Mimic/Idle_2x1.png", "Small Mimic idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(smallMimicSheetCache, "assets/Enemies/Small Mimic/Move_14x1.png", "Small Mimic move sheet"),
      frames: 14,
      fps: 16
    },
    attack: {
      image: getCachedSpriteImage(smallMimicSheetCache, "assets/Enemies/Small Mimic/Dash_Full_14x1.png", "Small Mimic dash sheet"),
      frames: 14,
      fps: 16
    }
  };
}

function getMediumMimicSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(mediumMimicSheetCache, "assets/Enemies/Medium Mimic/Idle_2x1.png", "Medium Mimic idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(mediumMimicSheetCache, "assets/Enemies/Medium Mimic/Move_24x1.png", "Medium Mimic move sheet"),
      frames: 24,
      fps: 16
    },
    attack: {
      image: getCachedSpriteImage(mediumMimicSheetCache, "assets/Enemies/Medium Mimic/Dash_Full_10x1.png", "Medium Mimic dash sheet"),
      frames: 10,
      fps: 16
    }
  };
}

function getStrongMimicSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(strongMimicSheetCache, "assets/Enemies/Strong Mimic/Idle_2x1.png", "Strong Mimic idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(strongMimicSheetCache, "assets/Enemies/Strong Mimic/Move_24x1.png", "Strong Mimic move sheet"),
      frames: 24,
      fps: 14
    },
    attack: {
      image: getCachedSpriteImage(strongMimicSheetCache, "assets/Enemies/Strong Mimic/Attack_Begin_2x1.png", "Strong Mimic attack sheet"),
      frames: 2,
      fps: 10
    }
  };
}

function getLargeMimicSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(largeMimicSheetCache, "assets/Enemies/Large Mimic/Idle_16x1.png", "Large Mimic idle sheet"),
      frames: 16,
      fps: 10
    },
    move: {
      image: getCachedSpriteImage(largeMimicSheetCache, "assets/Enemies/Large Mimic/Move_16x1.png", "Large Mimic move sheet"),
      frames: 16,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(largeMimicSheetCache, "assets/Enemies/Large Mimic/Dash_Full_14x1.png", "Large Mimic dash sheet"),
      frames: 14,
      fps: 12
    }
  };
}

function getSmallFrogSheets() {
  const moveImage = getCachedSpriteImage(smallFrogSheetCache, "assets/Enemies/Small Frog/Walk_Full_22x1.png", "Small Frog walk sheet");
  return {
    idle: {
      image: getCachedSpriteImage(smallFrogSheetCache, "assets/Enemies/Small Frog/Idle_2x1.png", "Small Frog idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: moveImage,
      frames: 22,
      fps: 20
    },
    attack: {
      // No dedicated attack strip; reuse move strip for any fallback attack visual.
      image: moveImage,
      frames: 22,
      fps: 20
    }
  };
}

function getLargeFrogSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(largeFrogSheetCache, "assets/Enemies/Large Frog/Idle_2x1.png", "Large Frog idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(largeFrogSheetCache, "assets/Enemies/Large Frog/Move_Full_22x1.png", "Large Frog move sheet"),
      frames: 22,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(largeFrogSheetCache, "assets/Enemies/Large Frog/Jump_Full_40x1.png", "Large Frog jump sheet"),
      frames: 40,
      fps: 20
    },
    attackBurp: {
      image: getCachedSpriteImage(largeFrogSheetCache, "assets/Enemies/Large Frog/Burp_4x1.png", "Large Frog burp sheet"),
      frames: 4,
      fps: 10
    },
    attackJump: {
      image: getCachedSpriteImage(largeFrogSheetCache, "assets/Enemies/Large Frog/Jump_Full_40x1.png", "Large Frog jump sheet"),
      frames: 40,
      fps: 20
    }
  };
}

function getCyclopArcherSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(cyclopArcherSheetCache, "assets/Enemies/Cyclop_Archer/Idle_2x1.png", "Cyclop Archer idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(cyclopArcherSheetCache, "assets/Enemies/Cyclop_Archer/Move_16x1.png", "Cyclop Archer move sheet"),
      frames: 16,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(cyclopArcherSheetCache, "assets/Enemies/Cyclop_Archer/ATK_Full_22x1.png", "Cyclop Archer attack sheet"),
      frames: 22,
      fps: 18
    }
  };
}

function getMonsteryflySheets() {
  return {
    idle: {
      image: getCachedSpriteImage(monsteryflySheetCache, "assets/Enemies/Monsterfly/Idle_16x1.png", "Monsteryfly idle sheet"),
      frames: 16,
      fps: 12
    },
    move: {
      image: getCachedSpriteImage(monsteryflySheetCache, "assets/Enemies/Monsterfly/Move_16x1.png", "Monsteryfly move sheet"),
      frames: 16,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(monsteryflySheetCache, "assets/Enemies/Monsterfly/ATK_12x1.png", "Monsteryfly attack sheet"),
      frames: 12,
      fps: 16
    },
    attackPrepare: {
      image: getCachedSpriteImage(monsteryflySheetCache, "assets/Enemies/Monsterfly/Prepare_38x1.png", "Monsteryfly prepare sheet"),
      frames: 38,
      fps: 22
    },
    attackRecover: {
      image: getCachedSpriteImage(monsteryflySheetCache, "assets/Enemies/Monsterfly/Recover_34x1.png", "Monsteryfly recover sheet"),
      frames: 34,
      fps: 17,
      loop: false
    }
  };
}

function getMonsterSlasherSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(monsterSlasherSheetCache, "assets/Enemies/MonsterSlasher/Idle_2x1.png", "MonsterSlasher idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(monsterSlasherSheetCache, "assets/Enemies/MonsterSlasher/Move_20x1.png", "MonsterSlasher move sheet"),
      frames: 20,
      fps: 14
    },
    attack: {
      image: getCachedSpriteImage(monsterSlasherSheetCache, "assets/Enemies/MonsterSlasher/ATK_Fullcombo_58x1.png", "MonsterSlasher attack combo sheet"),
      frames: 58,
      fps: 58,
      loop: false
    }
  };
}

function getVampireArcherSheets() {
  return {
    idle: {
      image: getCachedSpriteImage(vampireArcherSheetCache, "assets/Enemies/Human Archer/Idle_2x1.png", "Vampire Archer idle sheet"),
      frames: 2,
      fps: 10
    },
    move: {
      image: getCachedSpriteImage(vampireArcherSheetCache, "assets/Enemies/Human Archer/Move_20x1.png", "Vampire Archer move sheet"),
      frames: 20,
      fps: 13
    },
    attack: {
      image: getCachedSpriteImage(vampireArcherSheetCache, "assets/Enemies/Human Archer/ATK_Full_24x1.png", "Vampire Archer attack sheet"),
      frames: 24,
      fps: 22
    }
  };
}

function getMercenarySheets() {
  return {
    idle: {
      image: getCachedSpriteImage(mercenarySheetCache, "assets/Enemies/Human Warrior/Idle_2x1.png", "Mercenary idle sheet"),
      frames: 2,
      fps: 8
    },
    move: {
      image: getCachedSpriteImage(mercenarySheetCache, "assets/Enemies/Human Warrior/Move_24x1.png", "Mercenary move sheet"),
      frames: 24,
      fps: 12
    },
    attack: {
      image: getCachedSpriteImage(mercenarySheetCache, "assets/Enemies/Human Warrior/Attack_10x1.png", "Mercenary attack sheet"),
      frames: 10,
      fps: 14
    },
    attackCyclone: {
      image: getCachedSpriteImage(mercenarySheetCache, "assets/Enemies/Human Warrior/Attack_10x1.png", "Mercenary cyclone loop sheet"),
      frames: 10,
      fps: 18
    },
    attackCycloneEnd: {
      image: getCachedSpriteImage(mercenarySheetCache, "assets/Enemies/Human Warrior/After_Attack_6x1.png", "Mercenary cyclone end sheet"),
      frames: 6,
      fps: 12,
      loop: false
    }
  };
}

function preloadGoblinRegularSheets() {
  for (const variantId of GOBLIN_VARIANT_IDS) {
    getGoblinRegularSheets(variantId);
  }
}

function preloadGoblinArcherSheets() {
  for (const variantId of GOBLIN_ARCHER_VARIANT_IDS) {
    getGoblinArcherSheets(variantId);
  }
}

function preloadGoblinBruteSheets() {
  for (const variantId of GOBLIN_BRUTE_VARIANT_IDS) {
    getGoblinBruteSheets(variantId);
  }
}

function preloadGoblinMageSheets() {
  getGoblinMageSheets();
}

function preloadOrcRegularSheets() {
  for (const variantId of ORC_VARIANT_IDS) {
    getOrcRegularSheets(variantId);
  }
}

function preloadCultistSheets() {
  getCultistSheets();
}

function preloadDeathKnightSheets() {
  getDeathKnightSheets();
}

function preloadLichSheets() {
  getLichSheets();
}

function preloadMinotaurSheets() {
  for (const variantId of MINOTAUR_VARIANT_IDS) {
    getMinotaurSheets(variantId);
  }
}

function preloadForestSpiritSheets() {
  getForestSpiritSheets();
}

function preloadSmallMyconidSheets() {
  getSmallMyconidSheets();
}

function preloadSmallDummySheets() {
  getSmallDummySheets();
}

function preloadMediumDummySheets() {
  getMediumDummySheets();
}

function preloadAdvancedDummySheets() {
  getAdvancedDummySheets();
}

function preloadLargeDummySheets() {
  getLargeDummySheets();
}

function preloadSmallDwarfetteSheets() {
  getSmallDwarfetteSheets();
}

function preloadMediumDwarfetteSheets() {
  getMediumDwarfetteSheets();
}

function preloadStrongDwarfetteSheets() {
  getStrongDwarfetteSheets();
}

function preloadLargeDwarfetteBallSheets() {
  getLargeDwarfetteBallSheets();
}

function preloadSmallMimicSheets() {
  getSmallMimicSheets();
}

function preloadMediumMimicSheets() {
  getMediumMimicSheets();
}

function preloadStrongMimicSheets() {
  getStrongMimicSheets();
}

function preloadLargeMimicSheets() {
  getLargeMimicSheets();
}

function preloadSmallFrogSheets() {
  getSmallFrogSheets();
}

function preloadLargeFrogSheets() {
  getLargeFrogSheets();
}

function preloadCyclopArcherSheets() {
  getCyclopArcherSheets();
}

function preloadMonsteryflySheets() {
  getMonsteryflySheets();
}

function preloadMonsterSlasherSheets() {
  getMonsterSlasherSheets();
}

function preloadVampireArcherSheets() {
  getVampireArcherSheets();
}

function getDeathBringerSheets() {
  const img = getCachedSpriteImage(deathBringerSheetCache, "assets/Enemies/Bringer-of-Death-SpritSheet.png", "DeathBringer sheet");
  const totalRows = 8;
  const framesPerRow = 8;
  const cropRight = 0.3;
  return {
    idle: { image: img, frames: framesPerRow, row: 0, totalRows, fps: 8, cropRightRatio: cropRight },
    move: { image: img, frames: framesPerRow, row: 1, totalRows, fps: 12, cropRightRatio: cropRight },
    attack: { image: img, frames: framesPerRow, row: 2, totalRows, fps: 14, cropRightRatio: cropRight },
    attackRecover: { image: img, frames: framesPerRow, row: 3, totalRows, fps: 12, cropRightRatio: cropRight },
    death: { image: img, frames: framesPerRow, row: 4, totalRows, fps: 12, loop: false, cropRightRatio: cropRight },
    attackCast: { image: img, frames: framesPerRow, row: 5, totalRows, fps: 12, cropRightRatio: cropRight },
    groundSpell: { image: img, frames: framesPerRow, row: 6, totalRows, fps: 14, cropRightRatio: cropRight }
  };
}

function getDragonSheets() {
  const img = getCachedSpriteImage(dragonSheetCache, "assets/Enemies/sprDragon.png", "Dragon sheet");
  const frames = 6;
  return {
    idle: { image: img, frames, fps: 10 },
    move: { image: img, frames, fps: 10 }
  };
}

function getZombieSheets() {
  const frameW = 80;
  const frameH = 64;
  const idleImage = getCachedSpriteImage(zombieSheetCache, "assets/Enemies/Zombie/Mushroom-Idle.png", "Zombie idle sheet");
  const moveImage = getCachedSpriteImage(zombieSheetCache, "assets/Enemies/Zombie/Mushroom-Run.png", "Zombie move sheet");
  const attackImage = getCachedSpriteImage(zombieSheetCache, "assets/Enemies/Zombie/Mushroom-Attack.png", "Zombie attack sheet");
  const deathImage = getCachedSpriteImage(zombieSheetCache, "assets/Enemies/Zombie/Mushroom-Die.png", "Zombie death sheet");
  const hitImage = getCachedSpriteImage(zombieSheetCache, "assets/Enemies/Zombie/Mushroom-Hit.png", "Zombie hit sheet");
  const stunImage = getCachedSpriteImage(zombieSheetCache, "assets/Enemies/Zombie/Mushroom-Stun.png", "Zombie stun sheet");
  return {
    idle: { image: idleImage, frames: 7, fps: 8, frameW, cropW: frameW, frameH },
    move: { image: moveImage, frames: 8, fps: 12, frameW, cropW: frameW, frameH },
    attack: { image: attackImage, frames: 10, fps: 14, frameW, cropW: frameW, frameH },
    death: { image: deathImage, frames: 15, fps: 12, loop: false, frameW, cropW: frameW, frameH },
    hit: { image: hitImage, frames: 5, fps: 16, frameW, cropW: frameW, frameH },
    stun: { image: stunImage, frames: 18, fps: 14, frameW, cropW: frameW, frameH }
  };
}

function getSmallSlimeSheets() {
  const img = getCachedSpriteImage(smallSlimeSheetCache, "assets/Enemies/sprSmallSlime.png", "Small Slime sheet");
  const frames = 4;
  return {
    idle: { image: img, frames, fps: 8 },
    move: { image: img, frames, fps: 8 }
  };
}

function getMediumSlimeSheets() {
  const img = getCachedSpriteImage(mediumSlimeSheetCache, "assets/Enemies/sprMediumSlime.png", "Medium Slime sheet");
  const frames = 4;
  return {
    idle: { image: img, frames, fps: 8 },
    move: { image: img, frames, fps: 8 }
  };
}

function getBigSlimeSheets() {
  const img = getCachedSpriteImage(bigSlimeSheetCache, "assets/Enemies/sprBigSlime.png", "Big Slime sheet");
  const frames = 4;
  return {
    idle: { image: img, frames, fps: 8 },
    move: { image: img, frames, fps: 8 }
  };
}

function getTrollSheets() {
  const frameW = 128;
  const frameH = 128;
  const idleImage = getCachedSpriteImage(trollSheetCache, "assets/Enemies/Troll_Spritesheet/CAVETROLL_IDLE-Sheet.png", "Troll idle sheet");
  const moveImage = getCachedSpriteImage(trollSheetCache, "assets/Enemies/Troll_Spritesheet/CAVETROLL_WALK-Sheet.png", "Troll move sheet");
  const attackImage = getCachedSpriteImage(trollSheetCache, "assets/Enemies/Troll_Spritesheet/CAVETROLL_ATTACK-Sheet.png", "Troll attack sheet");
  return {
    idle: { image: idleImage, frames: 6, fps: 8, frameW, cropW: frameW, frameH },
    move: { image: moveImage, frames: 6, fps: 10, frameW, cropW: frameW, frameH },
    attack: { image: attackImage, frames: 6, fps: 12, frameW, cropW: frameW, frameH }
  };
}

function getGhostSheets(variantId) {
  const id = String(variantId || "1");
  const path = `assets/Enemies/sprGhost${id}.png`;
  const img = getCachedSpriteImage(ghostSheetCache, path, `Ghost ${id} sheet`);
  const frames = 4;
  return {
    idle: { image: img, frames, fps: 8 },
    move: { image: img, frames, fps: 8 }
  };
}

function getSkeletonSheets(variantId) {
  const id = String(variantId || "1");
  const path = `assets/Enemies/sprSkeleton${id}.png`;
  const img = getCachedSpriteImage(skeletonSheetCache, path, `Skeleton ${id} sheet`);
  const frames = 4;
  return {
    idle: { image: img, frames, fps: 8 },
    move: { image: img, frames, fps: 8 }
  };
}

function getSkeletonArcherSheets() {
  const img = getCachedSpriteImage(
    skeletonArcherSheetCache,
    "assets/Enemies/Skeleton Archer/Skeleton_Archer-Sheet.png",
    "Skeleton Archer sheet"
  );

  const frameW = 110;
  const frameH = 80;

  return {
    idle: { image: img, frames: 4, fps: 8, loop: true, frameW, frameH, cropX: 0, cropY: 0, cropW: frameW, cropH: frameH },
    // Use the "run" row as the general movement animation.
    move: { image: img, frames: 8, fps: 12, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    attack: { image: img, frames: 9, fps: 18, loop: false, frameW, frameH, cropX: 0, cropY: 640, cropW: frameW, cropH: frameH },
    death: { image: img, frames: 9, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 400, cropW: frameW, cropH: frameH },

    // Used as a flash overlay during hitFlashTimer; supports multi-row atlases via cropY.
    hit: { image: img, frames: 4, fps: 10, loop: false, frameW, frameH, cropX: 0, cropY: 320, cropW: frameW, cropH: frameH }, // use "hit_flash" row

    // Not currently driven by the enemy state machine, but included for completeness.
    death_flash: { image: img, frames: 9, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 480, cropW: frameW, cropH: frameH },
    revive: { image: img, frames: 9, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 560, cropW: frameW, cropH: frameH },
    run: { image: img, frames: 8, fps: 14, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    walk: { image: img, frames: 8, fps: 12, loop: true, frameW, frameH, cropX: 0, cropY: 80, cropW: frameW, cropH: frameH }
  };
}

function getDeathLordSheets() {
  const img = getCachedSpriteImage(
    deathLordSheetCache,
    "assets/Enemies/Death Lord/Death Knight-Sheet.png",
    "Death Lord sheet"
  );
  const frameW = 110;
  const frameH = 80;
  return {
    idle: { image: img, frames: 8, fps: 8, loop: true, frameW, frameH, cropX: 0, cropY: 0, cropW: frameW, cropH: frameH },
    move: { image: img, frames: 8, fps: 12, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    walk: { image: img, frames: 8, fps: 12, loop: true, frameW, frameH, cropX: 0, cropY: 80, cropW: frameW, cropH: frameH },
    run: { image: img, frames: 8, fps: 14, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    attack_swing: { image: img, frames: 7, fps: 16, loop: false, frameW, frameH, cropX: 0, cropY: 560, cropW: frameW, cropH: frameH },
    // Fallback while attackCtrl is in recover (currentAttack cleared) after cleave.
    attack: { image: img, frames: 7, fps: 16, loop: false, frameW, frameH, cropX: 0, cropY: 560, cropW: frameW, cropH: frameH },
    attack_cast: { image: img, frames: 10, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 640, cropW: frameW, cropH: frameH },
    death: { image: img, frames: 11, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 400, cropW: frameW, cropH: frameH },
    hit: { image: img, frames: 4, fps: 10, loop: false, frameW, frameH, cropX: 0, cropY: 240, cropW: frameW, cropH: frameH }
  };
}

function getBansheeSheets() {
  const img = getCachedSpriteImage(
    bansheeSheetCache,
    "assets/Enemies/Banshee/Banshee-Sheet.png",
    "Banshee sheet"
  );
  const frameW = 110;
  const frameH = 80;
  return {
    idle: { image: img, frames: 8, fps: 9, loop: true, frameW, frameH, cropX: 0, cropY: 0, cropW: frameW, cropH: frameH },
    move: { image: img, frames: 6, fps: 13, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    walk: { image: img, frames: 6, fps: 11, loop: true, frameW, frameH, cropX: 0, cropY: 80, cropW: frameW, cropH: frameH },
    run: { image: img, frames: 6, fps: 13, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    attack_melee: { image: img, frames: 8, fps: 16, loop: false, frameW, frameH, cropX: 0, cropY: 640, cropW: frameW, cropH: frameH },
    attack_shout: { image: img, frames: 9, fps: 14, loop: false, frameW, frameH, cropX: 0, cropY: 720, cropW: frameW, cropH: frameH },
    attack: { image: img, frames: 8, fps: 16, loop: false, frameW, frameH, cropX: 0, cropY: 640, cropW: frameW, cropH: frameH },
    death: { image: img, frames: 7, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 400, cropW: frameW, cropH: frameH },
    death_flash: { image: img, frames: 7, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 480, cropW: frameW, cropH: frameH },
    dramatic_death: { image: img, frames: 14, fps: 14, loop: false, frameW, frameH, cropX: 0, cropY: 560, cropW: frameW, cropH: frameH },
    hit: { image: img, frames: 4, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 320, cropW: frameW, cropH: frameH }
  };
}

function getSkeletonWarriorSheets() {
  const img = getCachedSpriteImage(
    skeletonWarriorSheetCache,
    "assets/Enemies/Skeleton Warrior/Skeleton_Warrior-Sheet.png",
    "Skeleton Warrior sheet"
  );
  const frameW = 110;
  const frameH = 80;
  return {
    idle: { image: img, frames: 4, fps: 8, loop: true, frameW, frameH, cropX: 0, cropY: 0, cropW: frameW, cropH: frameH },
    move: { image: img, frames: 8, fps: 12, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    attack: { image: img, frames: 7, fps: 18, loop: false, frameW, frameH, cropX: 0, cropY: 640, cropW: frameW, cropH: frameH },
    death: { image: img, frames: 9, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 400, cropW: frameW, cropH: frameH },
    hit: { image: img, frames: 4, fps: 10, loop: false, frameW, frameH, cropX: 0, cropY: 320, cropW: frameW, cropH: frameH },
    death_flash: { image: img, frames: 9, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 480, cropW: frameW, cropH: frameH },
    revive: { image: img, frames: 9, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 560, cropW: frameW, cropH: frameH },
    run: { image: img, frames: 8, fps: 14, loop: true, frameW, frameH, cropX: 0, cropY: 160, cropW: frameW, cropH: frameH },
    walk: { image: img, frames: 8, fps: 12, loop: true, frameW, frameH, cropX: 0, cropY: 80, cropW: frameW, cropH: frameH },
    hit_guard: { image: img, frames: 5, fps: 12, loop: false, frameW, frameH, cropX: 0, cropY: 720, cropW: frameW, cropH: frameH },
    guard: { image: img, frames: 5, fps: 10, loop: true, frameW, frameH, cropX: 0, cropY: 800, cropW: frameW, cropH: frameH }
  };
}

function getBastiliskSheets(variantId) {
  const id = String(variantId || "1");
  const path = `assets/Enemies/sprBatilisk${id}.png`;
  const img = getCachedSpriteImage(bastiliskSheetCache, path, `Basilisk ${id} sheet`);
  const frames = 4;
  return {
    idle: { image: img, frames, fps: 8 },
    move: { image: img, frames, fps: 8 }
  };
}

function getGoblinKingSheets() {
  const img = getCachedSpriteImage(goblinKingSheetCache, "assets/Enemies/sprGoblinKing.png", "GoblinKing sheet");
  return { idle: { image: img, frames: 4, fps: 8 }, move: { image: img, frames: 4, fps: 8 } };
}
function getGoblinEliteSheets() {
  const img = getCachedSpriteImage(goblinEliteSheetCache, "assets/Enemies/sprGoblinElite.png", "GoblinElite sheet");
  return { idle: { image: img, frames: 4, fps: 8 }, move: { image: img, frames: 4, fps: 8 } };
}
function getGoblinNormalSheets() {
  const img = getCachedSpriteImage(goblinNormalSheetCache, "assets/Enemies/sprGoblinNormal.png", "GoblinNormal sheet");
  return { idle: { image: img, frames: 4, fps: 8 }, move: { image: img, frames: 4, fps: 8 } };
}

const ROCK_GIANT_FRAME_W = 384;
const ROCK_GIANT_FRAME_H = 128;
const ROCK_GIANT_CROP_W = 100;
const ROCK_GIANT_CROP_H = 100;
// Visible 100x100 sits at bottom of frame; padding only top and left/right
const ROCK_GIANT_CROP_X = Math.floor((ROCK_GIANT_FRAME_W - ROCK_GIANT_CROP_W) / 2);
const ROCK_GIANT_CROP_Y = ROCK_GIANT_FRAME_H - ROCK_GIANT_CROP_H; // bottom-aligned
const rockGiantSheetCache = new Map();
function makeRockGiantSheet(path, frames = 4, fps = 8) {
  const img = getCachedSpriteImage(rockGiantSheetCache, path, `RockGiant ${path}`);
  return {
    image: img,
    frames,
    fps,
    frameW: ROCK_GIANT_FRAME_W,
    frameH: ROCK_GIANT_FRAME_H,
    cropX: ROCK_GIANT_CROP_X,
    cropY: ROCK_GIANT_CROP_Y,
    cropW: ROCK_GIANT_CROP_W,
    cropH: ROCK_GIANT_CROP_H
  };
}
function getRockGiantSheets() {
  const base = "assets/Enemies/RockGiant/";
  return {
    idle: makeRockGiantSheet(base + "gollux_idle.png"),
    move: makeRockGiantSheet(base + "gollux_move.png"),
    attackA: makeRockGiantSheet(base + "gollux_attack_A.png"),
    attackB: makeRockGiantSheet(base + "gollux_attack_B.png"),
    hit: Object.assign(makeRockGiantSheet(base + "gollux_hit.png"), { loop: false }),
    healing: Object.assign(makeRockGiantSheet(base + "gollux_healing.png"), { loop: false })
  };
}

function preloadMercenarySheets() {
  getMercenarySheets();
}

function preloadDeathBringerSheets() {
  getDeathBringerSheets();
}

function preloadDragonSheets() {
  getDragonSheets();
}

function preloadZombieSheets() {
  getZombieSheets();
}

function preloadSmallSlimeSheets() {
  getSmallSlimeSheets();
}

function preloadMediumSlimeSheets() {
  getMediumSlimeSheets();
}

function preloadBigSlimeSheets() {
  getBigSlimeSheets();
}

function preloadTrollSheets() {
  getTrollSheets();
}

function preloadGhostSheets() {
  for (const variantId of GHOST_VARIANT_IDS) {
    getGhostSheets(variantId);
  }
}

function preloadSkeletonSheets() {
  for (const variantId of SKELETON_VARIANT_IDS) {
    getSkeletonSheets(variantId);
  }
}

function preloadSkeletonArcherSheets() {
  getSkeletonArcherSheets();
}

function preloadSkeletonWarriorSheets() {
  getSkeletonWarriorSheets();
}

function preloadDeathLordSheets() {
  getDeathLordSheets();
}

function preloadBansheeSheets() {
  getBansheeSheets();
}

function preloadBastiliskSheets() {
  for (const variantId of BASTILISK_VARIANT_IDS) {
    getBastiliskSheets(variantId);
  }
}
function preloadGoblinKingSheets() {
  getGoblinKingSheets();
  getGoblinEliteSheets();
  getGoblinNormalSheets();
}
function preloadRockGiantSheets() {
  getRockGiantSheets();
}

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
  enemySpriteAtlas.src = assetUrl('assets/Enemies/monsters.png');
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
  affixIconAtlas.src = assetUrl("assets/UI/icons64x64.png");
  return affixIconAtlas;
}

// Start loading atlases + common sheets immediately (disabled in small preview tools).
if (!DISABLE_ENEMY_SHEET_PRELOADS) {
  loadEnemySpriteAtlas();
  loadAffixIconAtlas();
  preloadGoblinRegularSheets();
  preloadGoblinArcherSheets();
  preloadGoblinBruteSheets();
  preloadGoblinMageSheets();
  preloadOrcRegularSheets();
  preloadCultistSheets();
  preloadDeathKnightSheets();
  preloadLichSheets();
  preloadMinotaurSheets();
  preloadForestSpiritSheets();
  preloadSmallMyconidSheets();
  preloadSmallDummySheets();
  preloadMediumDummySheets();
  preloadAdvancedDummySheets();
  preloadLargeDummySheets();
  preloadSmallDwarfetteSheets();
  preloadMediumDwarfetteSheets();
  preloadStrongDwarfetteSheets();
  preloadLargeDwarfetteBallSheets();
  preloadSmallMimicSheets();
  preloadMediumMimicSheets();
  preloadStrongMimicSheets();
  preloadLargeMimicSheets();
  preloadSmallFrogSheets();
  preloadLargeFrogSheets();
  preloadCyclopArcherSheets();
  preloadMonsteryflySheets();
  preloadMonsterSlasherSheets();
  preloadVampireArcherSheets();
  preloadMercenarySheets();
  preloadDeathBringerSheets();
  preloadDragonSheets();
  preloadZombieSheets();
  preloadSmallSlimeSheets();
  preloadMediumSlimeSheets();
  preloadBigSlimeSheets();
  preloadTrollSheets();
  preloadGhostSheets();
  preloadSkeletonSheets();
  preloadSkeletonArcherSheets();
  preloadSkeletonWarriorSheets();
  preloadDeathLordSheets();
  preloadBansheeSheets();
  preloadBastiliskSheets();
  preloadGoblinKingSheets();
  preloadRockGiantSheets();
}

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

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function getEnemyCollisionRectAt(enemy, x = enemy.position.x, y = enemy.position.y) {
  const hitboxSize = enemy.size * 0.25;
  const hitW = Math.max(4, hitboxSize);
  const hitH = Math.max(4, hitboxSize);
  return {
    x: x + (enemy.size - hitW) / 2,
    y: y + (enemy.size - hitH) / 2,
    w: hitW,
    h: hitH
  };
}

function getEnemyWorldBounds(enemy, game, fallbackMargin = 60) {
  const worldWidth = enemy.worldBounds?.width ?? game?.world?.width ?? 3600;
  const worldHeight = enemy.worldBounds?.height ?? game?.world?.height ?? 900;
  const margin = game?.world?.wallCollisionThickness ?? game?.world?.wallThickness ?? fallbackMargin;
  return {
    margin,
    maxX: worldWidth - margin - enemy.size,
    maxY: worldHeight - margin - enemy.size
  };
}

function clampEnemyToWorld(enemy, game, fallbackMargin = 60) {
  const { margin, maxX, maxY } = getEnemyWorldBounds(enemy, game, fallbackMargin);
  enemy.position.x = clamp(enemy.position.x, margin, maxX);
  enemy.position.y = clamp(enemy.position.y, margin, maxY);
}

function enemyRectHitsBlockingWorld(game, rect, enemy = null) {
  if (!game) return false;
  if (enemy?.affixes?.includes("flying") || enemy?.ignoresWalls) return false;
  for (const obstacle of game.obstacles || []) {
    if (obstacle?.destroyed || !obstacle?.blocksMovement) continue;
    if (obstacleIntersectsRect(obstacle, rect)) return true;
  }
  for (const wall of game.world?.tileWallRects || []) {
    const wallRect = getWallCollisionRect(wall);
    if (rectsOverlap(rect, wallRect)) return true;
  }
  return false;
}

function pushEnemyOutOfBlockers(enemy, game, fallbackMargin = 60, maxIterations = 12) {
  clampEnemyToWorld(enemy, game, fallbackMargin);
  if (!game) return;
  if (enemy?.ignoresWalls) return;

  for (let iter = 0; iter < maxIterations; iter++) {
    const enemyRect = getEnemyCollisionRectAt(enemy);
    let blocker = null;

    for (const obstacle of game.obstacles || []) {
      if (obstacle?.destroyed || !obstacle?.blocksMovement) continue;
      const obstacleRect = getObstacleCollisionRect(obstacle);
      if (rectsOverlap(enemyRect, obstacleRect)) {
        blocker = obstacleRect;
        break;
      }
    }

    if (!blocker) {
      for (const wall of game.world?.tileWallRects || []) {
        const wallRect = getWallCollisionRect(wall);
        if (rectsOverlap(enemyRect, wallRect)) {
          blocker = wallRect;
          break;
        }
      }
    }

    if (!blocker) break;

    const overlapL = (enemyRect.x + enemyRect.w) - blocker.x;
    const overlapR = (blocker.x + blocker.w) - enemyRect.x;
    const overlapT = (enemyRect.y + enemyRect.h) - blocker.y;
    const overlapB = (blocker.y + blocker.h) - enemyRect.y;
    const minX = Math.min(overlapL, overlapR);
    const minY = Math.min(overlapT, overlapB);
    const enemyCenterX = enemyRect.x + enemyRect.w * 0.5;
    const enemyCenterY = enemyRect.y + enemyRect.h * 0.5;
    const blockerCenterX = blocker.x + blocker.w * 0.5;
    const blockerCenterY = blocker.y + blocker.h * 0.5;

    if (minX <= minY) {
      enemy.position.x += enemyCenterX < blockerCenterX ? -(minX + 0.5) : (minX + 0.5);
    } else {
      enemy.position.y += enemyCenterY < blockerCenterY ? -(minY + 0.5) : (minY + 0.5);
    }

    clampEnemyToWorld(enemy, game, fallbackMargin);
  }
}

function moveEnemyWithCollision(enemy, moveX, moveY, game, fallbackMargin = 60) {
  if (!Number.isFinite(moveX) || !Number.isFinite(moveY)) return;
  if (!game) {
    enemy.position.x += moveX;
    enemy.position.y += moveY;
    clampEnemyToWorld(enemy, game, fallbackMargin);
    return;
  }

  if (enemy.affixes?.includes("flying") || enemy.ignoresWalls) {
    enemy.position.x += moveX;
    enemy.position.y += moveY;
    clampEnemyToWorld(enemy, game, fallbackMargin);
    return;
  }

  const totalMove = Math.max(Math.abs(moveX), Math.abs(moveY));
  if (totalMove < 0.0001) {
    pushEnemyOutOfBlockers(enemy, game, fallbackMargin);
    return;
  }

  const baseRect = getEnemyCollisionRectAt(enemy);
  const maxStep = Math.max(4, Math.min(baseRect.w, baseRect.h) * 0.5);
  const steps = Math.max(1, Math.ceil(totalMove / maxStep));
  const stepX = moveX / steps;
  const stepY = moveY / steps;
  const { margin, maxX, maxY } = getEnemyWorldBounds(enemy, game, fallbackMargin);

  for (let step = 0; step < steps; step++) {
    const candidateX = clamp(enemy.position.x + stepX, margin, maxX);
    const testX = getEnemyCollisionRectAt(enemy, candidateX, enemy.position.y);
    if (!enemyRectHitsBlockingWorld(game, testX, enemy)) {
      enemy.position.x = candidateX;
    }

    const candidateY = clamp(enemy.position.y + stepY, margin, maxY);
    const testY = getEnemyCollisionRectAt(enemy, enemy.position.x, candidateY);
    if (!enemyRectHitsBlockingWorld(game, testY, enemy)) {
      enemy.position.y = candidateY;
    }
  }

  pushEnemyOutOfBlockers(enemy, game, fallbackMargin);
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
    this.size = (typeDef.size || 0) * 0.4;
    this.name = typeDef.name;
    this.enemyTypeId = typeDef.id || null;
    this.bruteSheetArchetype = resolveBruteSheetArchetype(typeDef);
    this.color = typeDef.color;
    this.maxHealth = typeDef.maxHealth;
    this.health = typeDef.maxHealth;
    this.attack = typeDef.attack;
    this.speed = typeDef.speed;
    
    // Human squad: use sheet-based animation; else atlas
    this.humanSheets = typeDef.humanSheets || null;
    this.humanAnimState = this.humanSheets ? createHumanSquadAnimState(typeDef.id) : null;
    this.dropTableId = typeDef.dropTableId || null;
    this.dropChanceMult = typeDef.dropChanceMult ?? 1;
    this.dropBand = typeDef.dropBand ?? "mid";
    this.spriteSheets = null;
    this.spriteAnimState = null;
    this.spriteSheetFlipInverted = false;
    this._attackRollEndTimer = 0;
    this._cycloneEndTimer = 0;
    // Sprite windup hold: freeze on current frame during attack windup.
    this._windupHoldCycle = null;
    this._windupHoldState = null; // { state: string, frameIndex: number }
    // Animation-synced hitbox: ensure we snap to trigger frame on active start.
    this._hitboxTriggerSnapCycle = null;
    // Recover anim: restart idle once when entering recover.
    this._wasInRecoverState = false;
    // Temporary speed buffs (e.g. Brute warcry).
    this._warcrySpeedUntil = null;
    this._warcrySpeedMult = 1.2;

    if (typeDef.spriteSet === "goblin_regular") {
      const variantId = GOBLIN_VARIANT_IDS[Math.floor(Math.random() * GOBLIN_VARIANT_IDS.length)] || "01";
      this.spriteVariantId = variantId;
      this.spriteSheets = getGoblinRegularSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "goblin_archer_regular") {
      const variantId = GOBLIN_ARCHER_VARIANT_IDS[Math.floor(Math.random() * GOBLIN_ARCHER_VARIANT_IDS.length)] || "01";
      this.spriteVariantId = variantId;
      this.spriteSheets = getGoblinArcherSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "goblin_brute_regular") {
      const variantId = GOBLIN_BRUTE_VARIANT_IDS[Math.floor(Math.random() * GOBLIN_BRUTE_VARIANT_IDS.length)] || "01";
      this.spriteVariantId = variantId;
      this.spriteSheets = getGoblinBruteSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "goblin_mage_regular") {
      this.spriteSheets = getGoblinMageSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "orc_regular") {
      const variantId = ORC_VARIANT_IDS[Math.floor(Math.random() * ORC_VARIANT_IDS.length)] || "01";
      this.spriteVariantId = variantId;
      this.spriteSheets = getOrcRegularSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "cultist_regular") {
      this.spriteSheets = getCultistSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "death_knight_regular") {
      this.spriteSheets = getDeathKnightSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "lich_regular") {
      this.spriteSheets = getLichSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "minotaur_regular") {
      const variantId = MINOTAUR_VARIANT_IDS[Math.floor(Math.random() * MINOTAUR_VARIANT_IDS.length)] || "1";
      this.spriteVariantId = variantId;
      this.spriteSheets = getMinotaurSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "forest_spirit_regular") {
      this.spriteSheets = getForestSpiritSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
      this.forestSpiritSpecial = {
        active: false,
        timer: 0,
        duration: 2.0,
        healAt: 1.0,
        healApplied: false,
        cooldown: 10.0,
        cooldownTimer: 3.0 + Math.random() * 2.0
      };
    } else if (typeDef.spriteSet === "small_myconid_regular") {
      this.spriteSheets = getSmallMyconidSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "small_dummy_regular") {
      this.spriteSheets = getSmallDummySheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "medium_dummy_regular") {
      this.spriteSheets = getMediumDummySheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "advanced_dummy_regular") {
      this.spriteSheets = getAdvancedDummySheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "large_dummy_regular") {
      this.spriteSheets = getLargeDummySheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "small_dwarfette_regular") {
      this.spriteSheets = getSmallDwarfetteSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "medium_dwarfette_regular") {
      this.spriteSheets = getMediumDwarfetteSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "strong_dwarfette_regular") {
      this.spriteSheets = getStrongDwarfetteSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "large_dwarfette_ball_regular") {
      this.spriteSheets = getLargeDwarfetteBallSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "small_mimic_regular") {
      this.spriteSheets = getSmallMimicSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "medium_mimic_regular") {
      this.spriteSheets = getMediumMimicSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "strong_mimic_regular") {
      this.spriteSheets = getStrongMimicSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "large_mimic_regular") {
      this.spriteSheets = getLargeMimicSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "small_frog_regular") {
      this.spriteSheets = getSmallFrogSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "large_frog_regular") {
      this.spriteSheets = getLargeFrogSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "cyclop_archer_regular") {
      this.spriteSheets = getCyclopArcherSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "monsteryfly_regular") {
      this.spriteSheets = getMonsteryflySheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
      this._monsterflyRecoverTimer = 0;
    } else if (typeDef.spriteSet === "monster_slasher_regular") {
      this.spriteSheets = getMonsterSlasherSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "vampire_archer_regular") {
      this.spriteSheets = getVampireArcherSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "mercenary_regular") {
      this.spriteSheets = getMercenarySheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "death_bringer_regular") {
      this.spriteSheets = getDeathBringerSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "death_lord_regular") {
      this.spriteSheets = getDeathLordSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "banshee_regular") {
      this.spriteSheets = getBansheeSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "dragon_regular") {
      this.spriteSheets = getDragonSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "zombie_regular") {
      this.spriteSheets = getZombieSheets();
      this.spriteSheetFlipInverted = false;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "small_slime_regular") {
      this.spriteSheets = getSmallSlimeSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "medium_slime_regular") {
      this.spriteSheets = getMediumSlimeSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "big_slime_regular") {
      this.spriteSheets = getBigSlimeSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "troll_regular") {
      this.spriteSheets = getTrollSheets();
      this.spriteSheetFlipInverted = false;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "ghost_regular") {
      const variantId = GHOST_VARIANT_IDS[Math.floor(Math.random() * GHOST_VARIANT_IDS.length)] || "1";
      this.spriteVariantId = variantId;
      this.spriteSheets = getGhostSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "skeleton_regular") {
      const variantId = SKELETON_VARIANT_IDS[Math.floor(Math.random() * SKELETON_VARIANT_IDS.length)] || "1";
      this.spriteVariantId = variantId;
      this.spriteSheets = getSkeletonSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "skeleton_archer_regular") {
      this.spriteSheets = getSkeletonArcherSheets();
      this.spriteSheetFlipInverted = true;
      // Dead-but-revivable corpse: keep death animation visible and frozen.
      this.keepDeadForRevive = true;
      this._corpseDeathProcessed = false;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "skeleton_warrior_regular") {
      this.spriteSheets = getSkeletonWarriorSheets();
      this.spriteSheetFlipInverted = true;
      // Dead-but-revivable corpse: keep death sprite visible for later revive mechanics.
      this.keepDeadForRevive = true;
      this._corpseDeathProcessed = false;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "bastilisk_regular") {
      const variantId = BASTILISK_VARIANT_IDS[Math.floor(Math.random() * BASTILISK_VARIANT_IDS.length)] || "1";
      this.spriteVariantId = variantId;
      this.spriteSheets = getBastiliskSheets(variantId);
      this.spriteSheetFlipInverted = true;
      this.ignoresWalls = true;
      this.spriteAnimState = {
        state: "idle",
        timer: 0,
        frameIndex: 0
      };
    } else if (typeDef.spriteSet === "goblin_king_regular") {
      this.spriteSheets = getGoblinKingSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = { state: "idle", timer: 0, frameIndex: 0 };
    } else if (typeDef.spriteSet === "goblin_elite_regular") {
      this.spriteSheets = getGoblinEliteSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = { state: "idle", timer: 0, frameIndex: 0 };
    } else if (typeDef.spriteSet === "goblin_normal_regular") {
      this.spriteSheets = getGoblinNormalSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = { state: "idle", timer: 0, frameIndex: 0 };
    } else if (typeDef.spriteSet === "rock_giant_regular") {
      this.spriteSheets = getRockGiantSheets();
      this.spriteSheetFlipInverted = true;
      this.spriteAnimState = { state: "idle", timer: 0, frameIndex: 0 };
    } else if (typeDef.spriteProfile?.kind === "directional_spritesheet") {
      this.heroPackSpriteProfile = typeDef.spriteProfile;
      this.heroPackDirectional = true;
      this.spriteSheets = buildHeroPackEnemySpriteSheets(typeDef.spriteProfile);
      this.spriteSheetFlipInverted = false;
      this.heroPackDrawFlipH = false;
      this.heroPackRowIndex = 2;
      this.spriteAnimState = { state: "idle", timer: 0, frameIndex: 0 };
    }

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

    // Migrated statuses are mirrored here for legacy readers; the status manager owns runtime state.
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
    if (this.enemyTypeId === "m_5o_small_mimic" || this.enemyTypeId === "m_5p_medium_mimic") {
      this.moveBehavior = "FLEE";
      this.mimicState = {
        dashCooldown: 0,
        dashDuration: 0,
        dashTargetLootId: null,
        stolenLoot: []
      };
    } else if (this.enemyTypeId === "m_5r_large_mimic") {
      this.moveBehavior = "CHARGE";
    }
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

      case "FLEE": {
        if (dist < 0.0001) return { x: 0, y: 0 };
        return vecNormalize(-dx, -dy);
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

    // If a dead-but-revivable corpse got revived (health restored), allow
    // death side-effects to run again the next time it dies.
    if (this.keepDeadForRevive && !this.isDead && this._corpseDeathProcessed) {
      this._corpseDeathProcessed = false;
    }

    if (this.enemyTypeId === "m_8f_forest_spirit" && this.forestSpiritSpecial) {
      const special = this.forestSpiritSpecial;
      if (special.active) {
        special.timer += dt;
        if (!special.healApplied && special.timer >= special.healAt) {
          const healAmount = Math.max(1, Math.round(this.maxHealth * 0.4));
          this.health = Math.min(this.maxHealth, this.health + healAmount);
          special.healApplied = true;
        }
        if (special.timer >= special.duration) {
          special.active = false;
          special.timer = 0;
          special.healApplied = false;
          special.cooldownTimer = special.cooldown;
        }
      } else if (special.cooldownTimer > 0) {
        special.cooldownTimer = Math.max(0, special.cooldownTimer - dt);
      }
    }

    // Always allow alerted/activated to update based on proximity, even if this enemy is
    // currently stunned/rooted (those states should stop movement/attacks, not awareness).
    if (player && (!this.activated || !this.alerted)) {
      const cx0 = this.position.x + this.size / 2;
      const cy0 = this.position.y + this.size / 2;
      const px0 = player.position.x + player.size / 2;
      const py0 = player.position.y + player.size / 2;
      const dx0 = px0 - cx0;
      const dy0 = py0 - cy0;
      const dist0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 0;
      const alertedRange0 = detectionRange * 3;
      if (!this.alerted && dist0 <= alertedRange0) this.alerted = true;
      if (!this.activated && dist0 <= detectionRange) this.activated = true;
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
      speedMult *= 1.25;
      this._swiftTrail = this._swiftTrail || [];
      this._swiftTrail.push({ x: this.position.x, y: this.position.y });
      if (this._swiftTrail.length > 8) this._swiftTrail.shift();
    } else this._swiftTrail = null;
    if (hasAffix("hive")) speedMult *= 0.5;
    if (this._auraBuffed) speedMult *= 1.2;
    if (this._totemSpeedMult != null) speedMult *= this._totemSpeedMult;
    if (this._warcrySpeedUntil != null && gameTime < this._warcrySpeedUntil) {
      speedMult *= Math.max(1, Number(this._warcrySpeedMult) || 1.2);
    }
    const margin = 60;
    const corpseFrozen = !!(this.keepDeadForRevive && this.isDead);
    const rooted = (this.rootUntil != null && gameTime < this.rootUntil) || corpseFrozen;
    const inWindup = !!(this.attackCtrl && this.attackCtrl.state === "windup");
    const inRecover = !!(this.attackCtrl && this.attackCtrl.state === "recover");
    if (!rooted) pushEnemyOutOfBlockers(this, game, margin);
    const cx = this.position.x + this.size / 2;
    const cy = this.position.y + this.size / 2;

    if (!rooted && hasAffix("erratic")) {
      this._erraticTimer = (this._erraticTimer ?? 0) + dt;
      if (this._erraticTimer >= 4) {
        this._erraticTimer = 0;
        this._erraticTrail = this._erraticTrail || [];
        for (let i = 0; i < 4; i++) this._erraticTrail.push({ x: this.position.x, y: this.position.y, t: gameTime });
        const fadeDuration = 3;
        this._erraticTrail = this._erraticTrail.filter((p) => p.t != null && (gameTime - p.t) <= fadeDuration);
        if (this._erraticTrail.length > 12) this._erraticTrail = this._erraticTrail.slice(-12);
        const angle = Math.random() * Math.PI * 2;
        const dashDist = 80;
        moveEnemyWithCollision(this, Math.cos(angle) * dashDist, Math.sin(angle) * dashDist, game, margin);
      }
    }

    if (!rooted && !inWindup && !inRecover && this._fleeFromPlayer && this.activated) {
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const fleeSpeed = Math.min(this.speed * 1.5, player.speed || 100);
      const flyingMult = this.affixes?.includes("flying") ? 1.1 : 1;
      const moveX = (dx / dist) * fleeSpeed * speedMult * flyingMult * dt;
      const moveY = (dy / dist) * fleeSpeed * speedMult * flyingMult * dt;
      moveEnemyWithCollision(this, moveX, moveY, game, margin);
      if (Math.abs(moveX) > 0.1) this.facingRight = moveX > 0;
    } else if (!rooted && !inWindup && !inRecover && hasAffix("evasive") && this.activated) {
      this._evasiveTrail = this._evasiveTrail || [];
      this._evasiveTrail.push({ x: this.position.x, y: this.position.y });
      if (this._evasiveTrail.length > 6) this._evasiveTrail.shift();
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const fleeSpeed = Math.min(this.speed * 1.5, player.speed || 100);
      const flyingMultEvasive = this.affixes?.includes("flying") ? 1.1 : 1;
      const moveX = (dx / dist) * fleeSpeed * speedMult * flyingMultEvasive * dt;
      const moveY = (dy / dist) * fleeSpeed * speedMult * flyingMultEvasive * dt;
      moveEnemyWithCollision(this, moveX, moveY, game, margin);
      // Update facing direction for evasive movement
      if (Math.abs(moveX) > 0.1) {
        this.facingRight = moveX > 0;
      }
    } else this._evasiveTrail = null;
    if (hasAffix("evasive") && !this.activated) this._evasiveTrail = null;
    if (!rooted && !inWindup && !inRecover && this.isFiery) {
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
      const flyingMult = this.affixes?.includes("flying") ? 1.1 : 1;
      const moveX = dx * this.speed * speedMult * flyingMult * dt;
      const moveY = dy * this.speed * speedMult * flyingMult * dt;
      moveEnemyWithCollision(this, moveX, moveY, game, margin);
      // Update facing direction for fiery/wandering movement
      if (Math.abs(moveX) > 0.1) {
        this.facingRight = moveX > 0;
      }
    } else if (!rooted && !this._fleeFromPlayer && !this._rockGiantHitReaction && !this._rockGiantHealing) {
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
        this._jumpSlamState ||
        this._attackRollState ||
        this._cycloneState ||
        this._cycloneEndTimer > 0 ||
        this._frogSpitFlight?.active ||
        this._monsterflyRecoverTimer > 0 ||
        (this.enemyTypeId === "m_1f_goblin_archer" && this.attackCtrl.state === "recover")
      );
      let specialHealing = this.enemyTypeId === "m_8f_forest_spirit" && this.forestSpiritSpecial?.active;

      // ----- Brute-sheet archetype: periodic burst movement (rolling / slide) -----
      const bruteArche = this.bruteSheetArchetype;
      let bruteDidBurstMove = false;
      const bruteInAttackPhases = !!(
        bruteArche &&
        this.attackCtrl &&
        (this.attackCtrl.state === "windup" || this.attackCtrl.state === "active" || this.attackCtrl.state === "recover")
      );
      if (bruteArche && this.activated && !rooted) {
        if (this._bruteBurstMove && this._bruteBurstMove.duration > 0) {
          this._bruteBurstMove.elapsed = (this._bruteBurstMove.elapsed || 0) + dt;
          if (this._bruteBurstMove.elapsed >= this._bruteBurstMove.duration) {
            this._bruteBurstMove = null;
          }
        }
        if (bruteArche.enablePeriodicBurstMove) {
          this._bruteBurstNextIn = Number.isFinite(this._bruteBurstNextIn) ? this._bruteBurstNextIn - dt : 0;
          if (!this._bruteBurstMove && !bruteInAttackPhases && !specialHealing && (this._bruteBurstNextIn || 0) <= 0) {
            const choices = ["rolling", "slide"];
            const kind = choices[Math.floor(Math.random() * choices.length)] || "rolling";
            const dir = dist > 0.0001
              ? vecNormalize(dx, dy)
              : (this.facingRight ? { x: 1, y: 0 } : { x: -1, y: 0 });
            const duration = kind === "rolling" ? 1.0 : 1.0;
            this._bruteBurstMove = {
              kind,
              dirX: dir.x,
              dirY: dir.y,
              elapsed: 0,
              duration
            };
            this._bruteBurstNextIn = bruteArche.burstIntervalSec;
          }
        } else {
          this._bruteBurstNextIn = null;
        }
      } else if (!bruteArche) {
        this._bruteBurstMove = null;
        this._bruteBurstNextIn = null;
      }

      if (bruteArche && this._bruteBurstMove && !rooted && !specialHealing && !bruteInAttackPhases) {
        const t = Math.max(0, Math.min(1, (this._bruteBurstMove.elapsed || 0) / Math.max(0.0001, this._bruteBurstMove.duration)));
        let burstMult = 1.0;
        if (this._bruteBurstMove.kind === "rolling") burstMult = bruteArche.rollingSpeedMult;
        else if (this._bruteBurstMove.kind === "slide") {
          burstMult = bruteArche.slideSpeedMultStart - (bruteArche.slideSpeedMultStart - bruteArche.slideSpeedMultEnd) * t;
        }
        const flyingSpeedMult = this.affixes?.includes("flying") ? 1.1 : 1;
        const burstSpeed = this.speed * speedMult * burstMult * flyingSpeedMult;
        const moveX = this._bruteBurstMove.dirX * burstSpeed * dt;
        const moveY = this._bruteBurstMove.dirY * burstSpeed * dt;
        moveEnemyWithCollision(this, moveX, moveY, game, margin);
        if (Math.abs(moveX) > 0.1) this.facingRight = moveX > 0;
        // Skip normal steering move this frame; burst already moved us.
        bruteDidBurstMove = true;
      }

      if (!specialHealing && this.enemyTypeId === "m_8f_forest_spirit" && this.forestSpiritSpecial && this.activated) {
        const special = this.forestSpiritSpecial;
        const missingHp = this.maxHealth - this.health;
        const canStart = special.cooldownTimer <= 0 && missingHp >= (this.maxHealth * 0.05);
        if (canStart && !(this.attackCtrl && (this.attackCtrl.state === "windup" || this.attackCtrl.state === "active" || this.attackCtrl.state === "recover"))) {
          special.active = true;
          special.timer = 0;
          special.healApplied = false;
          specialHealing = true;
        }
      }

      // Move based on behavior (WANDER_BURST can move even when not alerted)
      const shouldMove = !specialHealing && !inAttackState && !bruteDidBurstMove && ((this.alerted || this.activated) || (this.moveBehavior === "WANDER_BURST"));
      
      if (shouldMove) {
        // Use 0.4x speed if alerted but not activated, full speed if activated
        // WANDER_BURST uses its own multipliers, so base is 1.0 for it
        const baseMovementSpeedMult = (this.moveBehavior === "WANDER_BURST" && !this.alerted && !this.activated) 
          ? 1.0 
          : (this.activated ? 1.0 : 0.4);
        
        // Hive-affix spawned minions: always chase player directly at full speed.
        const forceDirectChase = !!this.forceDirectChase;
        let behaviorDir = forceDirectChase
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

        // (Brute burst movement is applied earlier as a dedicated movement step.)
        
        // Store normalized player direction for use in obstacle avoidance
        const playerDirNorm = dist > 0.0001 ? vecNormalize(dx, dy) : { x: 0, y: 0 };
        const flyingSpeedMult = this.affixes?.includes("flying") ? 1.1 : 1;
        
        let moveX = behaviorDir.x * this.speed * speedMult * behaviorSpeedMult * flyingSpeedMult * dt;
        let moveY = behaviorDir.y * this.speed * speedMult * behaviorSpeedMult * flyingSpeedMult * dt;
        
        // Simple obstacle avoidance: try to move around obstacles and sub-area walls (flying / ignoresWalls skip these)
        if (game && !forceDirectChase && !this.affixes?.includes("flying") && !this.ignoresWalls) {
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
                
                moveX = usePerpX * this.speed * speedMult * behaviorSpeedMult * flyingSpeedMult * dt;
                moveY = usePerpY * this.speed * speedMult * behaviorSpeedMult * flyingSpeedMult * dt;
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
                
                moveX = usePerpX * this.speed * speedMult * behaviorSpeedMult * flyingSpeedMult * dt;
                moveY = usePerpY * this.speed * speedMult * behaviorSpeedMult * flyingSpeedMult * dt;
              }
            }
          }
        }
        
        const prevX = this.position.x;
        const prevY = this.position.y;
        moveEnemyWithCollision(this, moveX, moveY, game, margin);
        
        // Update facing direction from player position with a wider dead zone
        // to avoid rapid left/right flipping when melee enemies hover near center.
        const inAttackState = this.attackCtrl && (this.attackCtrl.state === "windup" || this.attackCtrl.state === "active" || this.attackCtrl.state === "recover" || this._attackRollState || this._cycloneState || this._cycloneEndTimer > 0 || this._frogSpitFlight?.active);
        if (!inAttackState && !(this.enemyTypeId === "m_8f_forest_spirit" && this.forestSpiritSpecial?.active)) {
          const ex = this.position.x + this.size / 2;
          const facingDeadZone = Math.max(16, this.size * 0.12);
          if (px >= ex + facingDeadZone) this.facingRight = true;
          else if (px <= ex - facingDeadZone) this.facingRight = false;
        }
        
        const moved = Math.sqrt(
          (this.position.x - prevX) ** 2 +
          (this.position.y - prevY) ** 2
        );
        const useMovingAnim = shouldUseMovingAnim(this, moved);
        if (this.humanSheets && this.humanAnimState) {
          const inAttack = this.attackCtrl && (this.attackCtrl.state === "windup" || this.attackCtrl.state === "active" || this.attackCtrl.state === "recover");
          const isHeal = this.enemyTypeId === "human_monk" && this.attackCtrl?.currentAttack?.id?.includes("heal");
          if (inAttack && this.humanAnimState.state !== "attack" && this.humanAnimState.state !== "heal") {
            setHumanSquadAnimState(this, isHeal ? "heal" : "attack");
          } else if (!inAttack && this.humanAnimState.state !== "attack" && this.humanAnimState.state !== "heal") {
            const nextHumanState = useMovingAnim ? "run" : "idle";
            if (this.humanAnimState.state !== nextHumanState) {
              setHumanSquadAnimState(this, nextHumanState);
            }
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
    if (this._attackRollEndTimer > 0) this._attackRollEndTimer = Math.max(0, this._attackRollEndTimer - dt);
    if (this._cycloneEndTimer > 0) this._cycloneEndTimer = Math.max(0, this._cycloneEndTimer - dt);
    if (this._monsterflyRecoverTimer > 0) this._monsterflyRecoverTimer = Math.max(0, this._monsterflyRecoverTimer - dt);

    if (this.humanSheets && this.humanAnimState) {
      updateHumanSquadAnim(this, dt);
    }
    if (this.spriteSheets && this.spriteAnimState) {
      if (this.heroPackDirectional && this.heroPackSpriteProfile && game?.player?.position) {
        const px = game.player.position.x + (game.player.size || 0) / 2;
        const py = game.player.position.y + (game.player.size || 0) / 2;
        const ex = this.position.x + this.size / 2;
        const ey = this.position.y + this.size / 2;
        const dirIdx = getHeroPackDirectionIndexFromWorld(px - ex, py - ey);
        const mirrorOn = this.heroPackSpriteProfile.mirrorLeftFacing !== false;
        const { rowIndex, flipH } = mirrorHeroPackDirectionForRow(dirIdx, mirrorOn);
        this.heroPackRowIndex = rowIndex;
        this.heroPackDrawFlipH = flipH;
        for (const key of Object.keys(this.spriteSheets)) {
          const def = this.spriteSheets[key];
          if (def?.heroPackDirectional) def.row = rowIndex;
        }
      }
      const specialHealing = this.enemyTypeId === "m_8f_forest_spirit" && this.forestSpiritSpecial?.active;
      const isStunned = this.stunUntil != null && gameTime < this.stunUntil && this.spriteSheets?.stun;
      const isZombie = this.enemyTypeId === "m_5e_zombie";
      const inAttack = this.attackCtrl && (
        this.attackCtrl.state === "windup" ||
        this.attackCtrl.state === "active" ||
        this.attackCtrl.state === "recover"
      );
      const moved = Math.sqrt(
        (this.position.x - this.lastPosition.x) ** 2 +
        (this.position.y - this.lastPosition.y) ** 2
      );
      const useMovingAnim = shouldUseMovingAnim(this, moved);
      const isDashAttack = !!(inAttack && this.attackCtrl?.currentAttack?.kind === "dash" && this.spriteSheets?.attackDash);
      const isFrogSpitFlight = !!this._frogSpitFlight?.active;
      const isBurpAttack = !!(inAttack && this.attackCtrl?.currentAttack?.kind === "burp_summon" && this.spriteSheets?.attackBurp);
      const isJumpAttack = !!(inAttack && this.attackCtrl?.currentAttack?.kind === "jump_slam" && this.spriteSheets?.attackJump);
      const isMonsteryflyPrepare = !!(inAttack && this.enemyTypeId === "m_5v_monsteryfly" && this.attackCtrl?.currentAttack?.kind === "jump_slam" && this.spriteSheets?.attackPrepare && !(this._monsterflyRecoverTimer > 0));
      const isMonsteryflyRecover = !!(this.enemyTypeId === "m_5v_monsteryfly" && this._monsterflyRecoverTimer > 0 && this.spriteSheets?.attackRecover);
      const isBruteWhirlwindAnim = bruteSheetStrikeAnimActive(this, this.attackCtrl, "whirlwind", inAttack);
      const isBruteCycloneAnim = bruteSheetStrikeAnimActive(this, this.attackCtrl, "cycloneSlash", inAttack);
      const isBruteUpConeAnim = bruteSheetStrikeAnimActive(this, this.attackCtrl, "upslash", inAttack);
      const isBruteDownConeAnim = bruteSheetStrikeAnimActive(this, this.attackCtrl, "downslash", inAttack);
      const isBruteGroundSlamAnim = bruteSheetStrikeAnimActive(this, this.attackCtrl, "groundslam", inAttack);
      const isBruteKickAnim = bruteSheetStrikeAnimActive(this, this.attackCtrl, "kick", inAttack);
      const isBruteWarcryAnim = bruteSheetStrikeAnimActive(this, this.attackCtrl, "warcry", inAttack);
      const isBruteBurstRolling = !!(
        this.bruteSheetArchetype &&
        this._bruteBurstMove &&
        !inAttack &&
        this._bruteBurstMove.kind === "rolling" &&
        this.spriteSheets?.rolling
      );
      const burstSlideOneQuick = this.bruteSheetArchetype?.burstSlideSingleQuickSlide === true;
      const isBruteBurstSlide = !!(
        this.bruteSheetArchetype &&
        this._bruteBurstMove &&
        !inAttack &&
        this._bruteBurstMove.kind === "slide" &&
        ((burstSlideOneQuick && this.spriteSheets?.quickSlide) ||
          (!burstSlideOneQuick && this.spriteSheets?.slideStart && this.spriteSheets?.slideEnd))
      );
      const isCycloneAttack = !!this._cycloneState && !!this.spriteSheets?.attackCyclone;
      const isCycloneEnd = !isCycloneAttack && (this._cycloneEndTimer > 0) && !!this.spriteSheets?.attackCycloneEnd;
      const isRollAttack = !!this._attackRollState && !!this.spriteSheets?.attackRoll;
      const isRollEnd = !isRollAttack && (this._attackRollEndTimer > 0) && !!this.spriteSheets?.attackRollEnd;
      const isDeathLordVolley = !!(
        inAttack &&
        this.spriteSheets?.attack_cast &&
        (this.attackCtrl?.currentAttack?.id === "death_lord_volley" ||
          this.attackCtrl?.recoveringAttackId === "death_lord_volley")
      );
      const isDeathBringerCast = !!(inAttack && this.attackCtrl?.currentAttack?.id === "death_bringer_ground_spell" && this.spriteSheets?.attackCast);
      const isDeathLordCleave = !!(inAttack && this.attackCtrl?.currentAttack?.id === "death_lord_cleave" && this.spriteSheets?.attack_swing);
      const isBansheeMeleeCone = !!(
        inAttack &&
        this.enemyTypeId === "m_6a_banshee" &&
        this.spriteSheets?.attack_melee &&
        (this.attackCtrl?.currentAttack?.id === "banshee_wail_slash" ||
          this.attackCtrl?.recoveringAttackId === "banshee_wail_slash")
      );
      const isBansheeScream = !!(
        inAttack &&
        this.enemyTypeId === "m_6a_banshee" &&
        this.spriteSheets?.attack_shout &&
        (this.attackCtrl?.currentAttack?.id === "banshee_scream" ||
          this.attackCtrl?.recoveringAttackId === "banshee_scream")
      );
      const isInRecoverWithRecoverSheet = !!(inAttack && this.attackCtrl?.state === "recover" && this.spriteSheets?.attackRecover);
      const isDeadWithDeathSheet = !!((this.health <= 0 || this.isDead) && this.spriteSheets?.death);
      const isRockGiant = this.name === "RockGiant" && this.spriteSheets?.healing;
      const zombieAttackAnimLeadTime = 0.2;
      const zombieWindupRemaining = this.attackCtrl?.state === "windup" ? Math.max(0, Number(this.attackCtrl?.timer) || 0) : 0;
      const zombieShowAttackAnim = !isZombie || this.attackCtrl?.state !== "windup" || zombieWindupRemaining <= zombieAttackAnimLeadTime;
      const isAnyWindupHold = !!(this.attackCtrl && this.attackCtrl.state === "windup");
      let nextState = "idle";
      if (isRockGiant && this._rockGiantHealing) {
        nextState = "healing";
      } else if (isRockGiant && this._rockGiantHitReaction) {
        nextState = "hit";
      } else if (isStunned) {
        nextState = "stun";
      } else if (isRockGiant && inAttack && this.attackCtrl?.currentAttack?.id === "rock_giant_falling_rocks") {
        nextState = "attackA";
      } else if (isRockGiant && inAttack && this.attackCtrl?.currentAttack?.id === "rock_giant_cone") {
        nextState = "attackB";
      } else if (specialHealing) {
        nextState = "specialHeal";
      } else if (isDeadWithDeathSheet) {
        nextState = "death";
      } else if (inRecover) {
        // Recover: always show first idle frame and remain stationary.
        nextState = "idle";
      } else if (isBruteBurstRolling) {
        nextState = "rolling";
      } else if (isBruteBurstSlide) {
        if (burstSlideOneQuick) {
          nextState = "quickSlide";
        } else {
          const dur = Math.max(0.0001, Number(this._bruteBurstMove.duration) || 0);
          const elapsed = Math.max(0, Number(this._bruteBurstMove.elapsed) || 0);
          const progress = Math.max(0, Math.min(1, elapsed / dur));
          nextState = progress < 0.5 ? "slideStart" : "slideEnd";
        }
      } else if (isFrogSpitFlight) {
        nextState = "idle";
      } else if (isMonsteryflyRecover) {
        nextState = "attackRecover";
      } else if (isInRecoverWithRecoverSheet) {
        nextState = "attackRecover";
      } else if (
        this.attackCtrl?.state === "recover" &&
        !this.spriteSheets?.attackRecover &&
        !(this.spriteSheets?.attack_cast && this.attackCtrl?.recoveringAttackId === "death_lord_volley") &&
        !(
          this.enemyTypeId === "m_6a_banshee" &&
          (this.attackCtrl?.recoveringAttackId === "banshee_scream" ||
            this.attackCtrl?.recoveringAttackId === "banshee_wail_slash")
        ) &&
        !bruteSheetRecoveringHoldAttackStrip(this, this.attackCtrl?.recoveringAttackId) &&
        !(
          isConeLikeStrikeAttackKind(getEnemyAttackKindForSpriteAnim(this.attackCtrl)) &&
          (this.spriteSheets?.attack_melee ||
            this.spriteSheets?.attack_shout ||
            this.spriteSheets?.attackDown ||
            this.spriteSheets?.attackUp)
        )
      ) {
        // No looping attack strip during recover; hold first idle frame until attack_ctrl is idle again.
        nextState = "idle";
      } else if (isDeathLordVolley) {
        nextState = "attack_cast";
      } else if (isBansheeScream) {
        nextState = "attack_shout";
      } else if (isBansheeMeleeCone) {
        nextState = "attack_melee";
      } else if (isDeathBringerCast) {
        nextState = "attackCast";
      } else if (isMonsteryflyPrepare) {
        nextState = "attackPrepare";
      } else if (isBruteWhirlwindAnim) {
        nextState = "attackCyclone";
      } else if (isBruteCycloneAnim) {
        nextState = "attackCyclone";
      } else if (isBruteGroundSlamAnim) {
        nextState = "attackGroundSlam";
      } else if (isBruteKickAnim) {
        nextState = "attackKick";
      } else if (isBruteWarcryAnim) {
        nextState = "attackWarcry";
      } else if (isBruteUpConeAnim) {
        nextState = "attackUp";
      } else if (isBruteDownConeAnim) {
        nextState = "attackDown";
      } else if (isCycloneAttack) {
        nextState = "attackCyclone";
      } else if (isCycloneEnd) {
        nextState = "attackCycloneEnd";
      } else if (isRollAttack) {
        nextState = "attackRoll";
      } else if (isRollEnd) {
        nextState = "attackRollEnd";
      } else if (inAttack && zombieShowAttackAnim) {
        if (isDeathLordCleave) nextState = "attack_swing";
        else if (isBurpAttack) nextState = "attackBurp";
        else if (isJumpAttack) nextState = "attackJump";
        else if (isDashAttack) nextState = "attackDash";
        else nextState = "attack";
      } else {
        nextState = useMovingAnim ? "move" : "idle";
      }

      const rawHitboxTrigger = this.attackCtrl?.currentAttack?.execute?.hitboxTrigger;
      const hitboxTrigger =
        rawHitboxTrigger == null || !Number.isFinite(Number(rawHitboxTrigger))
          ? null
          : Math.floor(Number(rawHitboxTrigger));
      const hasAnimSyncedHitboxTrigger =
        isAnyWindupHold &&
        (this.attackCtrl?.currentAttack?.kind === "cone" ||
          this.attackCtrl?.currentAttack?.kind === "circle" ||
          this.attackCtrl?.currentAttack?.kind === "whirlwind") &&
        hitboxTrigger != null &&
        hitboxTrigger >= 0 &&
        rawHitboxTrigger != null &&
        Number.isInteger(Number(rawHitboxTrigger));

      // Generic windup hold: default behavior freezes on first idle frame; start attack strip on active.
      if (
        isAnyWindupHold &&
        nextState.startsWith("attack") &&
        !isStunned &&
        !specialHealing &&
        !isDeadWithDeathSheet &&
        !(isRockGiant && (this._rockGiantHealing || this._rockGiantHitReaction))
      ) {
        // If this attack uses an animation-synced hitboxTrigger, we want to play the attack strip during windup
        // up to (but not including) the trigger frame.
        if (!hasAnimSyncedHitboxTrigger) {
          nextState = "idle";
        }
      } else {
        // Not in windup (or not an attack strip): clear any old hold data.
        this._windupHoldCycle = null;
        this._windupHoldState = null;
      }
      nextState = resolveConeMultiSheetAnimState(this, nextState, this.attackCtrl);
      if (this.spriteAnimState.state !== nextState) {
        this.spriteAnimState.state = nextState;
        this.spriteAnimState.timer = 0;
        this.spriteAnimState.frameIndex = 0;
      }
      if (
        this.enemyTypeId === "m_1f_goblin_archer" &&
        this.attackCtrl &&
        this.spriteAnimState
      ) {
        const cy = this.attackCtrl._attackWindupCycle ?? 0;
        if (cy !== this._goblinArcherSeenWindupCycle) {
          this._goblinArcherSeenWindupCycle = cy;
          this.spriteAnimState.frameIndex = 0;
          this.spriteAnimState.timer = 0;
        }
      }
      const animDef = this.spriteSheets[nextState];
      const sheetFrameCount = Math.max(1, animDef?.frames || 1);
      let frames = sheetFrameCount;
      if (animDef?.heroPackDirectional && this.heroPackSpriteProfile) {
        frames = getHeroPackLoopLength(this.heroPackSpriteProfile, animDef.profileStateKey, sheetFrameCount);
      }
      const fps = Math.max(1, animDef?.fps || 1);
      const shouldLoop = animDef?.loop !== false;
      if (specialHealing && nextState === "specialHeal") {
        const progress = Math.max(0, Math.min(1, this.forestSpiritSpecial.timer / this.forestSpiritSpecial.duration));
        this.spriteAnimState.frameIndex = Math.min(frames - 1, Math.floor(progress * frames));
      } else if (inRecover && nextState === "idle") {
        // Recover: restart idle from frame 0, then let it animate normally during recover.
        if (!this._wasInRecoverState) {
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = 0;
          this._wasInRecoverState = true;
        }
      } else if (
        this.attackCtrl &&
        (this.attackCtrl.state === "windup" || this.attackCtrl.state === "active") &&
        (this.attackCtrl.currentAttack?.kind === "cone" ||
          this.attackCtrl.currentAttack?.kind === "circle" ||
          this.attackCtrl.currentAttack?.kind === "whirlwind") &&
        this.attackCtrl.currentAttack?.execute?.hitboxTrigger != null &&
        Number.isInteger(Number(this.attackCtrl.currentAttack.execute.hitboxTrigger)) &&
        frames > 1 &&
        isEnemyStrikeSpriteAnimState(nextState)
      ) {
        const trigger = Math.max(0, Math.min(frames - 1, Math.floor(Number(this.attackCtrl.currentAttack.execute.hitboxTrigger))));
        if (this.attackCtrl.state === "windup") {
          const total = Math.max(0.0001, Number(this.attackCtrl._windupTotal) || 0.0001);
          const remaining = Math.max(0, Number(this.attackCtrl.timer) || 0);
          const progress = Math.max(0, Math.min(1, 1 - remaining / total));
          const preCount = Math.max(0, Math.min(trigger, frames));
          const idx =
            preCount <= 1 ? 0 : Math.min(preCount - 1, Math.floor(progress * preCount));
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = idx;
        } else {
          // On the first active tick after windup, snap to the trigger frame so the hitbox spawns immediately.
          const cy = this.attackCtrl._enteredActiveCycle ?? 0;
          if (this._hitboxTriggerSnapCycle !== cy) {
            this._hitboxTriggerSnapCycle = cy;
            this.spriteAnimState.timer = 0;
            this.spriteAnimState.frameIndex = trigger;
          }
          // Continue advancing the strike strip during active.
          this.spriteAnimState.timer += dt;
          const frameDuration = 1 / fps;
          while (this.spriteAnimState.timer >= frameDuration) {
            this.spriteAnimState.timer -= frameDuration;
            if (shouldLoop) {
              this.spriteAnimState.frameIndex = (this.spriteAnimState.frameIndex + 1) % frames;
            } else {
              this.spriteAnimState.frameIndex = Math.min(frames - 1, this.spriteAnimState.frameIndex + 1);
            }
          }
        }
      } else if (
        isAnyWindupHold &&
        nextState === "idle"
      ) {
        // Freeze on the first idle frame for the entire windup.
        this.spriteAnimState.timer = 0;
        this.spriteAnimState.frameIndex = 0;
      } else if (
        this.bruteSheetArchetype &&
        this._bruteBurstMove &&
        (nextState === "rolling" ||
          nextState === "slideStart" ||
          nextState === "slideEnd" ||
          nextState === "quickSlide")
      ) {
        const dur = Math.max(0.0001, Number(this._bruteBurstMove.duration) || 0);
        const elapsed = Math.max(0, Number(this._bruteBurstMove.elapsed) || 0);
        const progress = Math.max(0, Math.min(1, elapsed / dur));
        const localProgress =
          nextState === "slideStart"
            ? Math.max(0, Math.min(1, progress / 0.5))
            : nextState === "slideEnd"
              ? Math.max(0, Math.min(1, (progress - 0.5) / 0.5))
              : progress;
        const fi = Math.min(frames - 1, Math.floor(localProgress * frames));
        this.spriteAnimState.timer = 0;
        this.spriteAnimState.frameIndex = fi;
      } else if (isZombie && nextState === "attack" && frames >= 7) {
        const zombieHoldFrameIndex = Math.min(frames - 1, 6);
        const zombieRecoverFrameCount = Math.max(0, frames - (zombieHoldFrameIndex + 1));
        if (this.attackCtrl?.state === "windup") {
          const windupProgress = Math.max(0, Math.min(1, (zombieAttackAnimLeadTime - zombieWindupRemaining) / zombieAttackAnimLeadTime));
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = Math.min(
            zombieHoldFrameIndex,
            Math.floor(windupProgress * (zombieHoldFrameIndex + 1))
          );
        } else if (this.attackCtrl?.state === "active") {
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = zombieHoldFrameIndex;
        } else if (this.attackCtrl?.state === "recover" && zombieRecoverFrameCount > 0) {
          const zombieRecoverDuration = Math.max(0.01, Number(this.attackCtrl?.currentAttack?.recover) || 0.35);
          const recoverRemaining = Math.max(0, Number(this.attackCtrl?.timer) || 0);
          const recoverProgress = Math.max(0, Math.min(1, 1 - (recoverRemaining / zombieRecoverDuration)));
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = Math.min(
            frames - 1,
            zombieHoldFrameIndex + 1 + Math.floor(recoverProgress * zombieRecoverFrameCount)
          );
        } else {
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = zombieHoldFrameIndex;
        }
      } else if (
        this.bruteSheetArchetype &&
        nextState === "attackCyclone" &&
        getEnemyAttackKindForSpriteAnim(this.attackCtrl) === "frame_synced_circle" &&
        (this.attackCtrl.state === "windup" ||
          this.attackCtrl.state === "active" ||
          (this.attackCtrl.state === "recover" &&
            this.attackCtrl.recoveringAttackId === this.bruteSheetArchetype.attackIds.cycloneSlash))
      ) {
        const cycloneId = this.bruteSheetArchetype.attackIds.cycloneSlash;
        const exec =
          this.attackCtrl.currentAttack?.execute ||
          this.attackCtrl.availableAttacks?.find((x) => x.id === cycloneId)?.execute ||
          {};
        const syncFps = Math.max(1, Number(exec.animFps) || 14);
        const totalFrames = Math.max(1, Math.floor(Number(exec.totalFrames) || 15));
        const dur = totalFrames / syncFps;
        if (this.attackCtrl.state === "windup") {
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = 0;
        } else if (this.attackCtrl.state === "active") {
          const remaining = Math.max(0, Number(this.attackCtrl.timer) || 0);
          const elapsed = Math.max(0, dur - remaining);
          const idx1 = Math.min(totalFrames, Math.floor(elapsed * syncFps) + 1);
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = Math.min(totalFrames - 1, idx1 - 1);
        } else {
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = Math.min(
            totalFrames - 1,
            Math.max(0, this.spriteAnimState.frameIndex | 0)
          );
        }
      } else if (
        this.bruteSheetArchetype &&
        nextState === "attackCyclone" &&
        getEnemyAttackKindForSpriteAnim(this.attackCtrl) === "whirlwind" &&
        this.attackCtrl.state === "recover" &&
        this.attackCtrl.recoveringAttackId === this.bruteSheetArchetype.attackIds.whirlwind
      ) {
        const whirlId = this.bruteSheetArchetype.attackIds.whirlwind;
        const exec =
          this.attackCtrl.availableAttacks?.find((x) => x.id === whirlId)?.execute || {};
        const syncFps = Math.max(1, Number(exec.animFps) || 14);
        const animDur = Number(exec.activeAnimDuration);
        const totalFrames = Math.max(
          1,
          Math.floor(
            Number(exec.totalFrames) ||
              (Number.isFinite(animDur) && animDur > 0 ? Math.round(animDur * syncFps) : 15)
          )
        );
        this.spriteAnimState.timer = 0;
        this.spriteAnimState.frameIndex = Math.min(
          totalFrames - 1,
          Math.max(0, this.spriteAnimState.frameIndex | 0)
        );
      } else if (
        animDef &&
        frames > 1 &&
        isEnemyStrikeSpriteAnimState(nextState) &&
        isConeLikeStrikeAttackKind(getEnemyAttackKindForSpriteAnim(this.attackCtrl)) &&
        (this.attackCtrl.state === "windup" ||
          this.attackCtrl.state === "active" ||
          this.attackCtrl.state === "recover")
      ) {
        // Cone strike strips: advance on active; hold last pose in recover.
        // (Windup is handled earlier by staying in idle/move and freezing there.)
        if (this.attackCtrl.state === "active") {
          this.spriteAnimState.timer += dt;
          const frameDuration = 1 / fps;
          while (this.spriteAnimState.timer >= frameDuration) {
            this.spriteAnimState.timer -= frameDuration;
            if (shouldLoop) {
              this.spriteAnimState.frameIndex = (this.spriteAnimState.frameIndex + 1) % frames;
            } else {
              this.spriteAnimState.frameIndex = Math.min(frames - 1, this.spriteAnimState.frameIndex + 1);
            }
          }
        } else {
          this.spriteAnimState.timer = 0;
          this.spriteAnimState.frameIndex = Math.min(
            frames - 1,
            Math.max(0, this.spriteAnimState.frameIndex | 0)
          );
        }
      } else if (frames > 1) {
        this.spriteAnimState.timer += dt;
        const frameDuration = 1 / fps;
        while (this.spriteAnimState.timer >= frameDuration) {
          this.spriteAnimState.timer -= frameDuration;
          if (shouldLoop) {
            this.spriteAnimState.frameIndex = (this.spriteAnimState.frameIndex + 1) % frames;
          } else {
            this.spriteAnimState.frameIndex = Math.min(frames - 1, this.spriteAnimState.frameIndex + 1);
          }
        }
      } else {
        this.spriteAnimState.timer = 0;
        this.spriteAnimState.frameIndex = 0;
      }
      // Spawn animation-driven hitboxes once the sprite strip reaches the configured frame.
      this.attackCtrl?.trySpawnAnimationHitboxOnFrame?.(game, this.spriteAnimState.frameIndex);
      if (isRockGiant) {
        const fi = this.spriteAnimState.frameIndex;
        const healFrame = Math.min(20, Math.max(0, frames - 1));
        if (nextState === "healing") {
          if (fi === healFrame && !this._rockGiantHealApplied) {
            this.health = Math.min(this.maxHealth, this.health + Math.max(1, Math.round(this.maxHealth * 0.1)));
            this._rockGiantHealApplied = true;
          }
          if (fi >= frames - 1 && !shouldLoop) this._rockGiantHealing = false;
        } else if (nextState === "hit" && fi >= frames - 1 && !shouldLoop) {
          this._rockGiantHitReaction = false;
        }
      }
    }
    if (!inRecover && this._wasInRecoverState) {
      this._wasInRecoverState = false;
    }
    this.lastPosition.set(this.position.x, this.position.y);
  }

  intersects(other) {
    // Circular collision detection; hitbox is half of visual (35% of size radius)
    const collisionRadiusMultiplier = 0.35;
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
    if (this.attackCtrl && !(this.keepDeadForRevive && this.isDead)) {
      this.attackCtrl.draw(ctx, camera);
    }
    if (hasAffix("invisible") && gameTime != null && (this._invisibleUntil || 0) > gameTime) {
      return;
    }

    const isMiniBoss = this.enemyTier === "miniBoss" || this.isMiniBoss;
    const isElite = this.enemyTier === "elite" || this.isElite;
    const isSpecial = this.enemyTier === "special" || this.isSpecial;

    if (hasAffix("phantom")) ctx.globalAlpha = 0.2;

    let fillColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
    if (isMiniBoss) {
      fillColor = this.hitFlashTimer > 0 ? "#ffffff" : "#a855f7";
    } else if (isSpecial) {
      fillColor = this.hitFlashTimer > 0 ? "#ffffff" : "#0f766e";
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
    } else if (isSpecial) {
      // Teal glow for special-tier enemies.
      shadowColor = "#22d3ee";
      shadowBlur = 9;
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
    } else if (this.spriteSheets && this.spriteAnimState) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      if (shadowColor) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
      }

      const centerX = sx + this.size / 2;
      const centerY = sy + this.size / 2;
      const animDef = this.spriteSheets[this.spriteAnimState.state] || this.spriteSheets.idle;
      let shouldFlip = this.spriteSheetFlipInverted ? !this.facingRight : this.facingRight;
      if (animDef?.heroPackDirectional) {
        shouldFlip = !!this.heroPackDrawFlipH;
      }
      if (shouldFlip) {
        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.translate(-centerX, -centerY);
      }

      const image = animDef?.image || null;
      const sheetCols = Math.max(1, animDef?.frames || 1);
      if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const totalRows = animDef?.totalRows ?? 1;
        const rowIndex = animDef?.row ?? 0;
        const useExplicitCrop = animDef?.frameW != null && animDef?.cropW != null;
        const frameW = useExplicitCrop ? animDef.frameW : Math.max(1, Math.floor(image.naturalWidth / sheetCols));
        const frameH = useExplicitCrop ? (animDef.frameH ?? image.naturalHeight) : (totalRows > 1 ? Math.max(1, Math.floor(image.naturalHeight / totalRows)) : Math.max(1, image.naturalHeight));
        const cropX = useExplicitCrop ? (animDef.cropX ?? 0) : 0;
        const srcY = useExplicitCrop ? (animDef.cropY ?? 0) : (totalRows > 1 ? rowIndex * frameH : 0);
        const cropRightRatio = useExplicitCrop ? 0 : Math.max(0, Math.min(1, animDef?.cropRightRatio ?? 0));
        const srcW = useExplicitCrop ? animDef.cropW : Math.max(1, Math.floor(frameW * (1 - cropRightRatio)));
        const srcH = useExplicitCrop ? (animDef.cropH ?? frameH) : frameH;
        let drawCol = Math.min(sheetCols - 1, Math.max(0, this.spriteAnimState.frameIndex | 0));
        if (animDef?.heroPackDirectional && this.heroPackSpriteProfile) {
          drawCol = mapHeroPackColumn(this.heroPackSpriteProfile, animDef.profileStateKey, this.spriteAnimState.frameIndex | 0);
          drawCol = Math.min(sheetCols - 1, Math.max(0, drawCol));
        }
        const srcX = drawCol * frameW + cropX;
        ctx.drawImage(image, srcX, srcY, srcW, srcH, sx, sy, this.size, this.size);
      } else {
        ctx.fillStyle = fillColor;
        ctx.fillRect(sx, sy, this.size, this.size);
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

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

      // Optional hit-strip top overlay for enemies that provide dedicated hit sheets.
      if (this.hitFlashTimer > 0 && this.spriteSheets?.hit) {
        const hitDef = this.spriteSheets.hit;
        const hitImage = hitDef.image;
        const hitFrames = Math.max(1, hitDef.frames || 1);
        if (hitImage && hitImage.complete && hitImage.naturalWidth > 0 && hitImage.naturalHeight > 0) {
          const hitProgress = 1 - Math.max(0, Math.min(1, this.hitFlashTimer / 0.12));
          const hitFrameIndex = Math.min(hitFrames - 1, Math.floor(hitProgress * hitFrames));

          // Support two conventions:
          // 1) Single-row strip (legacy): frames laid out horizontally from y=0.
          // 2) Multi-row atlas with explicit crop: frameW/cropW/cropY provided.
          const useExplicitCrop = hitDef.frameW != null && hitDef.cropW != null;
          const hitFrameW = useExplicitCrop ? hitDef.frameW : Math.max(1, Math.floor(hitImage.naturalWidth / hitFrames));
          const hitFrameH = useExplicitCrop ? (hitDef.frameH ?? (hitDef.cropH ?? hitImage.naturalHeight)) : hitImage.naturalHeight;

          const hitSrcX = hitFrameIndex * hitFrameW + (useExplicitCrop ? (hitDef.cropX ?? 0) : 0);
          const hitSrcY = useExplicitCrop ? (hitDef.cropY ?? 0) : 0;
          const hitSrcW = useExplicitCrop ? (hitDef.cropW ?? hitFrameW) : hitFrameW;
          const hitSrcH = useExplicitCrop ? (hitDef.cropH ?? hitFrameH) : hitFrameH;

          ctx.drawImage(hitImage, hitSrcX, hitSrcY, hitSrcW, hitSrcH, sx, sy, this.size, this.size);
        }
      }

      ctx.imageSmoothingEnabled = true;
      ctx.restore();
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
    if (hasAffix("hive")) {
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
    // Swift keeps gameplay behavior; visual trail overlay intentionally removed.
    if (hasAffix("erratic") && this._erraticTrail) {
      const fadeDuration = 3;
      const now = gameTime != null ? gameTime : 0;
      for (let i = 0; i < this._erraticTrail.length; i++) {
        const t = this._erraticTrail[i];
        const tsx = Math.floor(t.x - camera.position.x);
        const tsy = Math.floor(t.y - camera.position.y);
        const age = t.t != null ? now - t.t : 0;
        const alpha = 0.5 * Math.max(0, 1 - age / fadeDuration);
        if (alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha;

        let drewSprite = false;
        if (this.humanSheets && this.humanAnimState) {
          const frame = getHumanSquadAnimFrame(this);
          if (frame && frame.image && frame.image.complete) {
            const centerX = tsx + this.size / 2;
            const centerY = tsy + this.size / 2;
            if (!this.facingRight) {
              ctx.translate(centerX, centerY);
              ctx.scale(-1, 1);
              ctx.translate(-centerX, -centerY);
            }
            const fw = frame.frameW;
            const fh = frame.frameH;
            const srcX = frame.frameIndex * fw;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(frame.image, srcX, 0, fw, fh, tsx, tsy, this.size, this.size);
            drewSprite = true;
          }
        } else if (this.spriteSheets && this.spriteAnimState) {
          const centerX = tsx + this.size / 2;
          const centerY = tsy + this.size / 2;
          const animDef = this.spriteSheets[this.spriteAnimState.state] || this.spriteSheets.idle;
          let shouldFlipTrail = this.spriteSheetFlipInverted ? !this.facingRight : this.facingRight;
          if (animDef?.heroPackDirectional) {
            shouldFlipTrail = !!this.heroPackDrawFlipH;
          }
          if (shouldFlipTrail) {
            ctx.translate(centerX, centerY);
            ctx.scale(-1, 1);
            ctx.translate(-centerX, -centerY);
          }
          const image = animDef?.image || null;
          const sheetCols = Math.max(1, animDef?.frames || 1);
          if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
            const totalRows = animDef?.totalRows ?? 1;
            const rowIndex = animDef?.row ?? 0;
            const frameW = Math.max(1, Math.floor(image.naturalWidth / sheetCols));
            const frameH = totalRows > 1 ? Math.max(1, Math.floor(image.naturalHeight / totalRows)) : Math.max(1, image.naturalHeight);
            const srcY = totalRows > 1 ? rowIndex * frameH : 0;
            let drawCol = Math.min(sheetCols - 1, Math.max(0, this.spriteAnimState.frameIndex | 0));
            if (animDef?.heroPackDirectional && this.heroPackSpriteProfile) {
              drawCol = mapHeroPackColumn(this.heroPackSpriteProfile, animDef.profileStateKey, this.spriteAnimState.frameIndex | 0);
              drawCol = Math.min(sheetCols - 1, Math.max(0, drawCol));
            }
            const srcX = drawCol * frameW;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, srcX, srcY, frameW, frameH, tsx, tsy, this.size, this.size);
            drewSprite = true;
          }
        } else if (enemySpriteAtlasLoaded && enemySpriteAtlas && enemySpriteAtlas.complete) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            enemySpriteAtlas,
            this.spriteX, this.spriteY, this.spriteWidth, this.spriteHeight,
            tsx, tsy, this.size, this.size
          );
          drewSprite = true;
        }

        if (drewSprite) {
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = "rgba(232,121,249,0.7)";
          ctx.fillRect(tsx, tsy, this.size, this.size);
          ctx.globalCompositeOperation = "source-over";
          ctx.imageSmoothingEnabled = true;
        } else {
          // Last-resort fallback when no sprite source is available.
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
      // Orbiting modifier: orbs orbit at 1.5x base radius (matches game logic)
      const orbRadius = (this.size / 2 + 15) * 1.5;
      const orbVisualScale = 1.5;
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
            ctx.arc(trailSx, trailSy, 4 * orbVisualScale, 0, Math.PI * 2);
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
        ctx.arc(ox, oy, 8 * orbVisualScale, 0, Math.PI * 2);
        ctx.fill();
        // Inner white core
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ox, oy, 4 * orbVisualScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // Deflecting: orbiting Orc is drawn as a separate enemy (no shield visual here)
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

    const hideHpBarForCorpse = !!(this.keepDeadForRevive && this.isDead);
    if (hideHpBarForCorpse) {
      this._affixRects = [];
    } else {
      const barW = this.size;
      const barH = isMiniBoss ? 7 : 5;
      const barY = sy - (isMiniBoss ? 12 : 8);
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(sx, barY, barW, barH);
      const pct = Math.max(0, this.health / this.maxHealth);
      const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
      ctx.fillStyle = hpColor;
      ctx.fillRect(sx, barY, Math.round(barW * pct), barH);
      if (isMiniBoss || isSpecial) {
        ctx.strokeStyle = isSpecial ? "#22d3ee" : "#facc15";
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
