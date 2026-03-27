// -------- Playable characters (hero/champion selection) --------
// Distinct from saved characters (run progression). Each playable character has
// unique base stat modifiers, dash pattern, passive ability, and optional sprites.

/** @typedef {'linear'|'burst'|'sustained'|'blink'|'dodge_roll'} DashPattern */

/**
 * @typedef {Object} DirectionalFolderSpriteProfile
 * @property {'directional_folder'} kind
 * @property {string} basePath
 * @property {Object<string, string>} states
 * @property {Object<string, number>} frames
 * @property {Object<string, number>} [loopFrames]
 * @property {Object<string, number[]>} [loopSequence]
 * @property {string[]} [attackStates]
 * @property {string[]} [castStates]
 * @property {string[]} [specialStates]
 * @property {boolean} [mirrorLeftFacing]
 * @property {'default'|'full_sequence'} [attackTimeline]
 */

/**
 * Enemy-only: maps a runtime spriteSheets key to a profile `states` key (PNG stem via states[profileKey]).
 * @typedef {{ animKey: string, profileKey: string, fps?: number }} EnemyDirectionalSheetEntry
 */

/**
 * @typedef {Object} DirectionalSpritesheetProfile
 * @property {'directional_spritesheet'} kind
 * @property {string} basePath
 * @property {Object<string, string>} states - Logical key → file stem (e.g. attack2 → 'Attack2'). Add any extra keys here; set frames/loopSequence for each.
 * @property {Object<string, number>} frames
 * @property {Object<string, number>} [loopFrames]
 * @property {Object<string, number[]>} [loopSequence]
 * @property {string[]} [attackStates] - Player: ordered attack animation state keys (attack, attack2, …) resolved against `states`.
 * @property {string[]} [castStates] - Player: cast animation keys (cast, cast2, …).
 * @property {string[]} [specialStates] - Player: optional keys for non-attack/non-cast sheets (channel, interact, emote, …). Consumed when you wire `specialStateKeys` on Player.
 * @property {number} [rowCount]
 * @property {boolean} [mirrorLeftFacing]
 * @property {'default'|'full_sequence'} [attackTimeline]
 * @property {EnemyDirectionalSheetEntry[]} [enemyMultiAttackSheets] - Enemy: replaces default single `attack` row with multiple sheets (e.g. attackDown → attack, attackUp → attack2).
 * @property {EnemyDirectionalSheetEntry[]} [enemySpecialSheets] - Enemy: extra sheets in addition to idle/move/(attacks); e.g. { animKey: 'channel', profileKey: 'cast2' }.
 */

/**
 * @typedef {'melee'|'ranged'|'hybrid'} WeaponArtClass
 */

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
 * @property {boolean} [mirrorLeftFacing] - When true, left-facing directions are drawn by mirroring right-facing art
 * @property {DirectionalFolderSpriteProfile | DirectionalSpritesheetProfile} [spriteProfile] - Reusable structured sprite profile
 * @property {string} [defaultWeaponArt] - Weapon art id this hero starts with / defaults to
 * @property {WeaponArtClass} [defaultWeaponArtClass] - Compatibility class for cross-hero weapon art usage
 * @property {boolean} [ownsDefaultWeaponArt] - When true, reaching level 20 on this hero's default weapon art unlocks it for other heroes
 */

/** Default base stats the game uses; character statModifiers multiply these. */
export const DEFAULT_STAT_BASELINE = {
  maxHealth: 100,
  defense: 0,
  speed: 220,
  attack: 20,
  hazardDamageReduction: 0
};

export const DIRECTIONAL_FOLDER_PACK_STATES = Object.freeze({
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  turn180: '180Turn',
  crouchIdle: 'CrouchIdle',
  crouchRun: 'CrouchRun',
  dash: 'Rolling',
  slide: 'Slide',
  cast: 'CastSpell',
  attack: 'Attack1'
});

export const DIRECTIONAL_SPRITESHEET_ROW_ORDER = Object.freeze([
  'right',
  'right_down',
  'down',
  'left_down',
  'left',
  'left_up',
  'up',
  'right_up'
]);

export const DIRECTIONAL_FOLDER_PACK_FRAMES = Object.freeze({
  idle: 15,
  walk: 15,
  run: 15,
  turn180: 15,
  crouchIdle: 15,
  crouchRun: 15,
  dash: 15,
  slide: 15,
  cast: 15,
  attack: 15
});

/**
 * Creates a standard directional folder sprite profile for heroes that use the same
 * folder structure as the Dark Mage asset pack.
 * @param {string} heroFolder
 * @param {{ baseRoot?: string, states?: Object<string, string>, frames?: Object<string, number>, loopFrames?: Object<string, number>, loopSequence?: Object<string, number[]>, attackStates?: string[], castStates?: string[], specialStates?: string[], mirrorLeftFacing?: boolean, attackTimeline?: 'default'|'full_sequence' }} [options]
 * @returns {DirectionalFolderSpriteProfile}
 */
export function createDirectionalFolderSpriteProfile(heroFolder, options = {}) {
  const baseRoot = options.baseRoot || 'assets/Heroes/2D HD Character pack';
  const specialStates =
    Array.isArray(options.specialStates) && options.specialStates.length > 0
      ? [...options.specialStates]
      : [];
  return {
    kind: 'directional_folder',
    basePath: `${baseRoot}/${heroFolder}`,
    states: {
      ...DIRECTIONAL_FOLDER_PACK_STATES,
      ...(options.states || {})
    },
    frames: {
      ...DIRECTIONAL_FOLDER_PACK_FRAMES,
      ...(options.frames || {})
    },
    loopFrames: {
      ...(options.loopFrames || {})
    },
    loopSequence: {
      ...(options.loopSequence || {})
    },
    attackStates: Array.isArray(options.attackStates) && options.attackStates.length > 0
      ? [...options.attackStates]
      : ['attack'],
    castStates: Array.isArray(options.castStates) && options.castStates.length > 0
      ? [...options.castStates]
      : ['cast'],
    specialStates,
    mirrorLeftFacing: options.mirrorLeftFacing ?? false,
    attackTimeline: options.attackTimeline || 'full_sequence'
  };
}

/**
 * Creates a standard 8-row directional spritesheet profile. Expected row order:
 * E, SE, S, SW, W, NW, N, NE.
 * @param {string} heroFolder
 * @param {{
 *   baseRoot?: string,
 *   states?: Object<string, string>,
 *   frames?: Object<string, number>,
 *   loopFrames?: Object<string, number>,
 *   loopSequence?: Object<string, number[]>,
 *   attackStates?: string[],
 *   castStates?: string[],
 *   specialStates?: string[],
 *   mirrorLeftFacing?: boolean,
 *   attackTimeline?: 'default'|'full_sequence',
 *   rowCount?: number,
 *   enemyMultiAttackSheets?: EnemyDirectionalSheetEntry[],
 *   enemySpecialSheets?: EnemyDirectionalSheetEntry[]
 * }} [options]
 * @returns {DirectionalSpritesheetProfile}
 */
export function createDirectionalSpritesheetProfile(heroFolder, options = {}) {
  const baseRoot = options.baseRoot || 'assets/Heroes/2D HD Character pack/Spritesheets/With shadow';
  const attackStates =
    Array.isArray(options.attackStates) && options.attackStates.length > 0
      ? [...options.attackStates]
      : ['attack'];
  const castStates =
    Array.isArray(options.castStates) && options.castStates.length > 0
      ? [...options.castStates]
      : ['cast'];
  const specialStates =
    Array.isArray(options.specialStates) && options.specialStates.length > 0
      ? [...options.specialStates]
      : [];
  return {
    kind: 'directional_spritesheet',
    basePath: `${baseRoot}/${heroFolder}`,
    states: {
      ...DIRECTIONAL_FOLDER_PACK_STATES,
      ...(options.states || {})
    },
    frames: {
      ...DIRECTIONAL_FOLDER_PACK_FRAMES,
      ...(options.frames || {})
    },
    loopFrames: {
      ...(options.loopFrames || {})
    },
    loopSequence: {
      ...(options.loopSequence || {})
    },
    attackStates,
    castStates,
    specialStates,
    rowCount: options.rowCount || 8,
    mirrorLeftFacing: options.mirrorLeftFacing ?? false,
    attackTimeline: options.attackTimeline || 'full_sequence',
    ...(Array.isArray(options.enemyMultiAttackSheets) && options.enemyMultiAttackSheets.length > 0
      ? { enemyMultiAttackSheets: [...options.enemyMultiAttackSheets] }
      : {}),
    ...(Array.isArray(options.enemySpecialSheets) && options.enemySpecialSheets.length > 0
      ? { enemySpecialSheets: [...options.enemySpecialSheets] }
      : {})
  };
}

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
    defaultWeaponArt: 'bladeBlast',
    defaultWeaponArtClass: 'melee',
    ownsDefaultWeaponArt: false,
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
    defaultWeaponArt: 'bladeBlast',
    defaultWeaponArtClass: 'melee',
    ownsDefaultWeaponArt: false,
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
    defaultWeaponArt: 'bladeBlast',
    defaultWeaponArtClass: 'melee',
    ownsDefaultWeaponArt: false,
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
    defaultWeaponArt: 'bladeBlast',
    defaultWeaponArtClass: 'melee',
    ownsDefaultWeaponArt: false,
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
    description: 'Heavy and dedicated. Slow dodge roll. Standing still fortifies the Knight; moving breaks the stance into a burst of speed.',
    defaultWeaponArt: 'guardCombo',
    defaultWeaponArtClass: 'melee',
    ownsDefaultWeaponArt: true,
    statModifiers: { maxHealth: 1.35, defense: 1.5, speed: 0.75, attack: 1, hazardDamageReduction: 1 },
    dash: {
      duration: 0.38,
      distanceMult: 0.45,
      speedBase: 520,
      pattern: 'dodge_roll'
    },
    passive: {
      id: 'knight_dedication',
      name: 'Bulwark',
      description: 'After standing still for 2s, gain 30% damage reduction and increased attack speed. Moving removes the stance and grants 30% movement speed for 5s.'
    },
    uniqueSkill: { slot: 0, skillId: 'knight_slide' },
    spriteProfile: createDirectionalSpritesheetProfile('1Knight', {
      states: {
        cast: 'CastSpell',
        cast2: 'Special1',
        cast3: 'Special1',
        cast4: 'Special2',
        attack: 'Pummel',
        attack2: 'Melee',
        attack3: 'Melee2',
        attack4: 'Kick'
      },
      frames: {
        cast2: 15,
        cast3: 15,
        cast4: 15,
        attack2: 15,
        attack3: 15,
        attack4: 15
      },
      attackStates: ['attack', 'attack2', 'attack3', 'attack4'],
      castStates: ['cast', 'cast2', 'cast3', 'cast4']
    })
  },
  {
    id: 'wind_archer',
    name: 'Wind Archer',
    description: 'A highly mobile archer who turns movement into stronger volleys. Dash, slide, and repositioning feed powerful release shots.',
    defaultWeaponArt: 'windVolley',
    defaultWeaponArtClass: 'ranged',
    ownsDefaultWeaponArt: true,
    statModifiers: { maxHealth: 0.78, defense: 0, speed: 250 / 220, attack: 0.95 },
    dash: {
      duration: 0.2,
      distanceMult: 0.5,
      speedBase: 740,
      pattern: 'linear'
    },
    passive: {
      id: 'wind_archer_slipstream_guard',
      name: 'Slipstream Guard',
      description: 'Attack and cast movement penalties are reduced. Gain defense equal to 4% of live movement speed, up to 12.'
    },
    uniqueSkill: { slot: 0, skillId: 'wind_archer_retreat_volley' },
    spriteProfile: createDirectionalSpritesheetProfile('Wind Archer', {
      states: {
        cast: 'CastSpell',
        cast2: 'QuickShot',
        cast3: 'Special1',
        cast4: 'Special2',
        attack: 'Attack1',
        attack2: 'Attack2',
        attack3: 'Attack3'
      },
      frames: {
        cast2: 15,
        cast3: 15,
        cast4: 15,
        attack2: 15,
        attack3: 15
      },
      attackStates: ['attack', 'attack2'],
      castStates: ['cast', 'cast2', 'cast3', 'cast4'],
      loopSequence: {
        run: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        dash: [0, 1, 2, 12, 13, 14]
      }
    })
  },
  {
    id: 'dark_mage',
    name: 'Dark Mage',
    description: 'Fragile caster with brutal damage. Kills ramp damage quickly and Blood Refresh trades life for tempo.',
    defaultWeaponArt: 'soulSiphon',
    defaultWeaponArtClass: 'ranged',
    ownsDefaultWeaponArt: true,
    statModifiers: { maxHealth: 0.75, defense: 0, speed: 0.85, attack: 1.35 },
    dash: {
      duration: 0.2,
      distanceMult: 0.5,
      speedBase: 700,
      pattern: 'linear'
    },
    passive: {
      id: 'dark_mage_blood_power',
      name: 'Blood Power',
      description: 'On kill, gain +1% damage for 5s, stacking up to 20%. At 20 stacks, also gain +20% movement speed.'
    },
    uniqueSkill: { slot: 0, skillId: 'dark_mage_blood_refresh' },
    spriteProfile: createDirectionalSpritesheetProfile('Dark Mage', {
      states: {
        cast: 'CastSpell',
        cast2: 'QuickShot',
        cast3: 'Special1',
        cast4: 'Special2',
        attack: 'Attack1',
        attack2: 'Attack2',
        attack3: 'Attack3'
      },
      frames: {
        cast2: 15,
        cast3: 15,
        cast4: 15,
        attack2: 15,
        attack3: 15
      },
      attackStates: ['attack', 'attack2', 'attack3'],
      castStates: ['cast', 'cast2', 'cast3', 'cast4'],
      loopSequence: {
        run: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        dash: [0, 1, 2, 12, 13, 14]
      }
    })
  },
  {
    id: 'element_mage',
    name: 'Element Mage',
    description: 'Low HP, high movement speed, medium attack. Flow powers skills, Focus powers weapon attacks.',
    defaultWeaponArt: 'projectile',
    defaultWeaponArtClass: 'ranged',
    ownsDefaultWeaponArt: true,
    statModifiers: { maxHealth: 0.7, defense: 0, speed: 200 / 220, attack: 1 },
    dash: {
      duration: 0.2,
      distanceMult: 0.5,
      speedBase: 720,
      pattern: 'linear'
    },
    passive: {
      id: 'element_mage_flow_focus',
      name: 'Flow and Focus',
      description: 'Weapon Art hits build Flow (+3% Skill Damage for 2s, up to 30%). Skill hits build Focus (+5% Weapon Damage for 4s, up to 30%). Max Flow grants 10% Cooldown Reduction. Max Focus grants +20% Attack Speed.'
    },
    uniqueSkill: { slot: 0, skillId: 'element_mage_spell_art' },
    spriteProfile: createDirectionalSpritesheetProfile('Element Mage', {
      states: {
        cast: 'CastSpell',
        cast2: 'QuickShot',
        cast3: 'Special1',
        cast4: 'Special2',
        attack: 'Attack1',
        attack2: 'Attack2',
        attack3: 'Attack3'
      },
      frames: {
        cast2: 15,
        cast3: 15,
        cast4: 15,
        attack2: 15,
        attack3: 15
      },
      loopFrames: {
        walk: 14
      },
      attackStates: ['attack', 'attack2', 'attack3'],
      castStates: ['cast', 'cast2', 'cast3', 'cast4'],
      loopSequence: {
        run: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        dash: [0, 1, 2, 12, 13, 14]
      }
    })
  },
  {
    id: 'death_knight',
    name: 'Death Knight',
    description: 'A dark melee warlord who grows stronger through death and sacrifice, then ascends into a temporary Dark Lord.',
    defaultWeaponArt: 'bladeBlast',
    defaultWeaponArtClass: 'hybrid',
    ownsDefaultWeaponArt: true,
    statModifiers: { maxHealth: 0.8, defense: 0, speed: 1.15, attack: 1.05 },
    dash: {
      duration: 0.2,
      distanceMult: 0.5,
      speedBase: 710,
      pattern: 'linear'
    },
    passive: {
      id: 'death_knight_dark_ascension',
      name: 'Dark Ascension',
      description: 'Gain Dark Essence on kills and heavy HP loss. At 20 stacks, transform into Dark Lord for 10s with +20% movement speed, +20% attack speed, kill-based extension, and one revive at 20% HP.'
    },
    uniqueSkill: { slot: 0, skillId: 'death_knight_summon_lich' },
    spriteProfile: createDirectionalSpritesheetProfile('Death Knight', {
      states: {
        cast: 'CastSpell',
        cast2: 'Special1',
        cast3: 'Special2',
        attack: 'Melee',
        attack2: 'Melee2',
        attack3: 'Pummel'
      },
      frames: {
        cast2: 15,
        cast3: 15,
        attack2: 15,
        attack3: 15
      },
      attackStates: ['attack', 'attack2', 'attack3'],
      castStates: ['cast', 'cast2', 'cast3']
    })
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
