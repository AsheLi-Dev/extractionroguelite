// -------- Playable characters (hero/champion selection) --------
// Distinct from saved characters (run progression). Each playable character has
// unique base stat modifiers, dash pattern, passive ability, and optional sprites.

/** @typedef {'linear'|'burst'|'sustained'|'blink'|'dodge_roll'} DashPattern */

/**
 * @typedef {Object} PlayableCharacterDef
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {Object} [statModifiers] - Multipliers applied to game baseStats (1 = default)
 * @property {{ duration?: number, distanceMult?: number, speedBase?: number, pattern?: DashPattern }} [dash]
 * @property {{ id: string, name: string, description: string }} [passive]
 * @property {{ slot: number, skillId: string }} [uniqueSkill] - Locked skill for this hero (e.g. slot 0 = first skill key)
 * @property {string} [spriteAssetBase] - Base path for sprites (e.g. 'assets/images/player'); if omitted, default player assets used
 * @property {Object} [spriteOverrides] - Optional map of state_direction -> image path for custom sheets
 */

/** Default base stats the game uses; character statModifiers multiply these. */
export const DEFAULT_STAT_BASELINE = {
  maxHealth: 100,
  defense: 0,
  speed: 220,
  attack: 20,
  hazardDamageReduction: 0
};

/**
 * Dash speed curve: t in [0, 1] (0 = start, 1 = end of dash). Returns multiplier for speed at that moment.
 * @param {DashPattern} pattern
 * @returns {(t: number) => number}
 */
export function getDashSpeedCurve(pattern) {
  switch (pattern) {
    case 'burst':
      // Fast at start, slow at end (quick escape)
      return (t) => 1.6 - 0.6 * t;
    case 'sustained':
      // Ramp up (momentum build)
      return (t) => 0.6 + 0.8 * t;
    case 'blink':
      // Very fast start, then drop (short teleport feel)
      return (t) => (t < 0.2 ? 2.5 : 0.3);
    case 'dodge_roll':
      // Slow dodge roll: low speed throughout (1.2x multiplier for roll speed)
      return () => 0.55 * 1.2;
    case 'linear':
    default:
      return () => 1;
  }
}

export const PLAYABLE_CHARACTERS = [
  {
    id: 'panda',
    name: 'Panda',
    description: 'Balanced fighter. Reliable dash and steady stats.',
    statModifiers: { maxHealth: 1, defense: 1, speed: 1, attack: 1 },
    dash: {
      duration: 0.2,
      distanceMult: 0.5,
      speedBase: 750,
      pattern: 'linear'
    },
    passive: {
      id: 'panda_steadfast',
      name: 'Steadfast',
      description: 'No passive; balanced baseline.'
    },
    uniqueSkill: { slot: 0, skillId: 'panda_focus' }
  },
  {
    id: 'reaper',
    name: 'Reaper',
    description: 'High risk, high reward. Burst dash and life steal on kill.',
    statModifiers: { maxHealth: 0.9, defense: 0, speed: 1.1, attack: 1.15 },
    dash: {
      duration: 0.18,
      distanceMult: 0.55,
      speedBase: 800,
      pattern: 'burst'
    },
    passive: {
      id: 'reaper_soul_harvest',
      name: 'Soul Harvest',
      description: 'On killing an enemy, heal for 2% of your max HP (once per second max).'
    },
    uniqueSkill: { slot: 0, skillId: 'reaper_scythe' },
    spriteAssetBase: 'assets/images/Reaper',
    spriteFrameSize: { width: 48, height: 48 },
    spriteFrames: { idle: 5 },
    spriteOverrides: {
      idle_down: 'PassiveIdleReaper-Sheet.png',
      idle_up: 'PassiveIdleReaper-Sheet.png',
      idle_side: 'PassiveIdleReaper-Sheet.png',
      run_down: 'PassiveRunningReaper-Sheet.png',
      run_up: 'PassiveRunningReaper-Sheet.png',
      run_side: 'PassiveRunningReaper-Sheet.png',
      dash_down: 'PassiveRunningReaper-Sheet.png',
      dash_up: 'PassiveRunningReaper-Sheet.png',
      dash_left: 'PassiveRunningReaper-Sheet.png',
      dash_right: 'PassiveRunningReaper-Sheet.png',
      dash_side: 'PassiveRunningReaper-Sheet.png'
    },
    reaperHostileSprites: {
      idle: 'HostileIdleReaper-Sheet.png',
      run: 'HostileRunningReaper-Sheet.png',
      attack: 'HostileAttackReaper-Sheet.png'
    },
    reaperRevealSheet: 'WieldWeaponReaper-Sheet.png',
    reaperHolsterSheet: 'HolsterWeaponReaper-Sheet.png'
  },
  {
    id: 'strider',
    name: 'Strider',
    description: 'Swift and evasive. Sustained dash and movement speed after dashing.',
    statModifiers: { maxHealth: 0.95, defense: 0, speed: 1.2, attack: 0.9 },
    dash: {
      duration: 0.28,
      distanceMult: 0.6,
      speedBase: 650,
      pattern: 'sustained'
    },
    passive: {
      id: 'strider_wind_dancer',
      name: 'Wind Dancer',
      description: 'For 1.5s after a dash, move 15% faster.'
    },
    uniqueSkill: { slot: 0, skillId: 'strider_gust' }
  },
  {
    id: 'scavenger',
    name: 'Scavenger',
    description: 'High mobility and attack speed, low health. Vulture\'s Stare punishes wounded foes; Rush bursts speed.',
    statModifiers: { maxHealth: 0.75, defense: 0, speed: 1.3, attack: 1 },
    dash: {
      duration: 0.2,
      distanceMult: 0.5,
      speedBase: 750,
      pattern: 'linear'
    },
    passive: {
      id: 'scavenger_vulture_stare',
      name: "Vulture's Stare",
      description: 'Deal 20% increased damage to low-health enemies and open chests 20% faster.'
    },
    uniqueSkill: { slot: 0, skillId: 'scavenger_rush' }
  },
  {
    id: 'knight',
    name: 'Knight',
    description: 'Heavy and dedicated. Slow dodge roll. After 3 consecutive attacks, all attacks deal 125% damage.',
    statModifiers: { maxHealth: 1.35, defense: 1.5, speed: 0.75, attack: 1, hazardDamageReduction: 1 },
    dash: {
      duration: 0.38,
      distanceMult: 0.45,
      speedBase: 520,
      pattern: 'dodge_roll'
    },
    passive: {
      id: 'knight_dedication',
      name: 'Dedication',
      description: 'After 3 consecutive basic attacks, all attacks deal 125% damage until combo breaks.'
    },
    uniqueSkill: { slot: 0, skillId: 'knight_slide' },
    spriteAssetBase: 'assets/images/Knight',
    spriteFrameSize: { width: 120, height: 80 },
    spriteCropTop: 30, // Crop 30px padding from top of sprite frames
    spriteFrames: { idle: 10, run: 10, dash: 12, attack_1: 4, attack_2: 6, slide: 8 },
    spriteOverrides: {
      idle_down: '_Idle.png',
      idle_up: '_Idle.png',
      idle_side: '_Idle.png',
      run_down: '_Run.png',
      run_up: '_Run.png',
      run_side: '_Run.png',
      dash_down: '_Roll.png',
      dash_up: '_Roll.png',
      dash_left: '_Roll.png',
      dash_right: '_Roll.png',
      dash_side: '_Roll.png',
      attack_1: '_Attack.png',
      attack_2: '_Attack2.png',
      slide_down: '_Slide.png',
      slide_up: '_Slide.png',
      slide_side: '_Slide.png'
    }
  }
];

const BY_ID = new Map(PLAYABLE_CHARACTERS.map((c) => [c.id, c]));

/**
 * @param {string} id
 * @returns {PlayableCharacterDef | undefined}
 */
export function getPlayableCharacter(id) {
  if (!id) return PLAYABLE_CHARACTERS[0];
  return BY_ID.get(String(id)) || PLAYABLE_CHARACTERS[0];
}

/**
 * @param {string} id
 * @returns {PlayableCharacterDef}
 */
export function getPlayableCharacterOrDefault(id) {
  return getPlayableCharacter(id) || PLAYABLE_CHARACTERS[0];
}

export const DEFAULT_PLAYABLE_CHARACTER_ID = 'panda';
