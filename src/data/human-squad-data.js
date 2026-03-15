// -------- Human Squad encounter: 4 enemies (Archer, Lancer, Monk, Warrior) --------
// Defs, sheet paths, formation, drop table id.

const ENEMIES_PATH = "assets/Enemies/";

export const HUMAN_SQUAD_SHEET_PATHS = {
  human_archer: {
    idle: ENEMIES_PATH + "Archer_Idle.png",
    run: ENEMIES_PATH + "Archer_Run.png",
    attack: ENEMIES_PATH + "Archer_Shoot.png",
  },
  human_lancer: {
    idle: ENEMIES_PATH + "Lancer_Idle.png",
    run: ENEMIES_PATH + "Lancer_Run.png",
    attack: ENEMIES_PATH + "Lancer_Right_Attack.png",
  },
  human_monk: {
    idle: ENEMIES_PATH + "Idle.png",
    run: ENEMIES_PATH + "Run.png",
    heal: ENEMIES_PATH + "Heal.png",
  },
  human_warrior: {
    idle: ENEMIES_PATH + "Warrior_Idle.png",
    run: ENEMIES_PATH + "Warrior_Run.png",
    attack: ENEMIES_PATH + "Warrior_Attack1.png",
  },
};

export const HUMAN_SQUAD_ANIM_DEFAULTS = {
  idle: { fps: 10, loop: true },
  run: { fps: 13, loop: true },
  attack: { fps: 16, loop: false },
  heal: { fps: 14, loop: false },
};

export const HUMAN_SQUAD_FORMATION = [
  { role: "warrior", offsetX: -70, offsetY: 0 },
  { role: "lancer", offsetX: -110, offsetY: -40 },
  { role: "archer", offsetX: -150, offsetY: 50 },
  { role: "monk", offsetX: -150, offsetY: -50 },
];

const BASE_STATS = {
  human_archer: { hp: 45, atk: 8, speed: 85, size: 144, defense: 0 },
  human_lancer: { hp: 65, atk: 12, speed: 75, size: 172, defense: 1 },
  human_monk: { hp: 40, atk: 5, speed: 90, size: 144, defense: 0 },
  human_warrior: { hp: 80, atk: 14, speed: 65, size: 172, defense: 2 },
};

export function getHumanSquadTypeDef(id) {
  const stats = BASE_STATS[id];
  if (!stats) return null;
  const names = {
    human_archer: "Human Archer",
    human_lancer: "Human Lancer",
    human_monk: "Human Monk",
    human_warrior: "Human Warrior",
  };
  return {
    id,
    name: names[id],
    color: "#94a3b8",
    maxHealth: stats.hp,
    attack: stats.atk,
    speed: stats.speed,
    size: stats.size,
    defense: stats.defense,
    minXp: 18,
    maxXp: 32,
    dropChance: 0.45,
    minDrop: 1,
    maxDrop: 2,
    atlas: null,
    archetype: "Skeleton",
    attackStyle: id === "human_archer" ? "ranged_projectile" : id === "human_monk" ? "heal" : "melee_contact",
    xpBand: "elite_like",
    dropBand: "mid",
    humanSheets: HUMAN_SQUAD_SHEET_PATHS[id],
    humanAnim: HUMAN_SQUAD_ANIM_DEFAULTS,
    dropTableId: "humanSquad",
  };
}

export const HUMAN_SQUAD_ENEMY_IDS = ["human_archer", "human_lancer", "human_monk", "human_warrior"];

export const HUMAN_SQUAD_DROP = {
  gold: { min: 15, max: 35 },
  cubeChance: 0.25,
  equipmentMagicChance: 0.06,
  equipmentRareChance: 0.02,
};

export const SQUAD_WIPE_BONUS = {
  cubeT2Chance: 0.5,
  magicEquipChance: 0.5,
};
