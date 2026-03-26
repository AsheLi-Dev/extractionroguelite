/**
 * Shared “1Brute-style” sheet enemy: same directional sprite layout (attackDown/Up/Cyclone,
 * ground slam, warcry, rolling/slide burst), optional attack-kit wiring, rarity-tier filtering,
 * periodic burst move, and warcry cadence.
 *
 * Enable on a typeDef with `bruteSheetArchetype: true` or `{ ...overrides }`.
 * Undead Brute (`m_ud_brute`) is enabled by default without setting the field.
 *
 * Overrides example:
 *   bruteSheetArchetype: {
 *     attackKitName: "Undead Brute",
 *     attackIds: { warcry: "my_warcry_id" },
 *     filterAttacksByRarityTier: false,
 *     enablePeriodicBurstMove: false,
 *   }
 */

import { createDirectionalSpritesheetProfile } from '../data/playable-characters.js';

/** 2D HD-style sheets under assets/Enemies/1Brute (Idle.png, Run.png, Attack1.png, …). */
export const BRUTE_1_SPRITE_PROFILE = createDirectionalSpritesheetProfile('1Brute', {
  baseRoot: 'assets/Enemies',
  states: {
    attack2: 'Attack2',
    attack3: 'Attack3',
    warcry: 'QuickShot',
    groundSlam: 'groundSlam',
    quickSlide: 'QuickSlide',
    rolling: 'Rolling',
    slideStart: 'SlideStart',
    slideEnd: 'SlideEnd'
  },
  frames: {
    attack2: 15,
    attack3: 15,
    warcry: 15,
    groundSlam: 15,
    quickSlide: 15,
    rolling: 15,
    slideStart: 15,
    slideEnd: 15
  },
  enemyMultiAttackSheets: [
    { animKey: 'attackDown', profileKey: 'attack' },
    { animKey: 'attackUp', profileKey: 'attack2' },
    { animKey: 'attackCyclone', profileKey: 'attack3' }
  ],
  enemySpecialSheets: [
    { animKey: 'attackGroundSlam', profileKey: 'groundSlam' },
    { animKey: 'attackWarcry', profileKey: 'warcry', fps: 14 },
    { animKey: 'quickSlide', profileKey: 'quickSlide', fps: 16 },
    { animKey: 'rolling', profileKey: 'rolling', fps: 16 },
    { animKey: 'slideStart', profileKey: 'slideStart', fps: 16 },
    { animKey: 'slideEnd', profileKey: 'slideEnd', fps: 16 }
  ],
  loopSequence: {
    run: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    dash: [0, 1, 2, 12, 13, 14]
  }
});

export const DEFAULT_BRUTE_SHEET_ATTACK_IDS = {
  whirlwind: 'ud_brute_whirlwind',
  cycloneSlash: 'ud_brute_cyclone_slash',
  upslash: 'ud_brute_upslash',
  downslash: 'ud_brute_downslash',
  groundslam: 'ud_brute_groundslam',
  warcry: 'ud_brute_warcry',
  kick: null
};

/** Same sheet layout as 1Brute burst/move extras; assets/Enemies/6Warrior (Attack1 = up, Attack2 = down, Attack3 = shield bash, groudSlam.png ground slam). */
export const WARRIOR_6_SPRITE_PROFILE = createDirectionalSpritesheetProfile('6Warrior', {
  baseRoot: 'assets/Enemies',
  states: {
    attack: 'Attack1',
    attack2: 'Attack2',
    attack3: 'Attack3',
    groundSlam: 'groudSlam',
    kick: 'Kick',
    quickSlide: 'FrontFlip',
    rolling: 'Rolling'
  },
  frames: {
    attack: 15,
    attack2: 15,
    attack3: 15,
    groundSlam: 15,
    kick: 15,
    quickSlide: 15,
    rolling: 15
  },
  enemyMultiAttackSheets: [
    { animKey: 'attackUp', profileKey: 'attack' },
    { animKey: 'attackDown', profileKey: 'attack2' },
    { animKey: 'attackCyclone', profileKey: 'attack3' }
  ],
  // Burst slide: FrontFlip.png (15f), one play for whole burst (burstSlideSingleQuickSlide).
  enemySpecialSheets: [
    { animKey: 'attackGroundSlam', profileKey: 'groundSlam' },
    { animKey: 'attackKick', profileKey: 'kick', fps: 14 },
    { animKey: 'quickSlide', profileKey: 'quickSlide', fps: 16 },
    { animKey: 'rolling', profileKey: 'rolling', fps: 16 }
  ],
  loopSequence: {
    run: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    dash: [0, 1, 2, 12, 13, 14]
  }
});

function applyUndeadWarriorAttackIds(cfg) {
  cfg.attackIds = {
    ...DEFAULT_BRUTE_SHEET_ATTACK_IDS,
    downslash: 'ud_warrior_downslash',
    upslash: 'ud_warrior_upslash',
    whirlwind: 'ud_warrior_shield_bash',
    cycloneSlash: null,
    groundslam: 'ud_warrior_groundslam',
    warcry: null,
    kick: 'ud_warrior_kick'
  };
  cfg.filterAttacksByRarityTier = false;
  cfg.burstSlideSingleQuickSlide = true;
}

export function resolveBruteSheetArchetype(typeDef) {
  const raw = typeDef?.bruteSheetArchetype;
  if (raw === false) return null;
  const id = typeDef?.id;
  const legacyUdBrute = id === 'm_ud_brute';
  const legacyUdWarrior = id === 'm_ud_warrior';
  if (raw == null && !legacyUdBrute && !legacyUdWarrior) return null;

  const cfg = {
    attackKitName: null,
    attackIds: { ...DEFAULT_BRUTE_SHEET_ATTACK_IDS },
    warcryCadenceSec: 8,
    burstIntervalSec: 4,
    filterAttacksByRarityTier: true,
    enablePeriodicBurstMove: true,
    rollingSpeedMult: 2.3,
    slideSpeedMultStart: 2.0,
    slideSpeedMultEnd: 1.0
  };

  if (legacyUdWarrior) {
    applyUndeadWarriorAttackIds(cfg);
  }

  if (raw && typeof raw === 'object') {
    if (raw.attackKitName != null) cfg.attackKitName = raw.attackKitName;
    if (raw.attackIds && typeof raw.attackIds === 'object') {
      cfg.attackIds = { ...cfg.attackIds, ...raw.attackIds };
    }
    if (Number.isFinite(raw.warcryCadenceSec) && raw.warcryCadenceSec > 0) {
      cfg.warcryCadenceSec = raw.warcryCadenceSec;
    }
    if (Number.isFinite(raw.burstIntervalSec) && raw.burstIntervalSec >= 0) {
      cfg.burstIntervalSec = raw.burstIntervalSec;
    }
    if (raw.filterAttacksByRarityTier === false) cfg.filterAttacksByRarityTier = false;
    if (raw.enablePeriodicBurstMove === false) cfg.enablePeriodicBurstMove = false;
    if (Number.isFinite(raw.rollingSpeedMult) && raw.rollingSpeedMult > 0) {
      cfg.rollingSpeedMult = raw.rollingSpeedMult;
    }
    if (Number.isFinite(raw.slideSpeedMultStart) && raw.slideSpeedMultStart > 0) {
      cfg.slideSpeedMultStart = raw.slideSpeedMultStart;
    }
    if (Number.isFinite(raw.slideSpeedMultEnd) && raw.slideSpeedMultEnd > 0) {
      cfg.slideSpeedMultEnd = raw.slideSpeedMultEnd;
    }
    if (raw.preset === 'undeadWarrior') {
      applyUndeadWarriorAttackIds(cfg);
    }
    if (raw.burstSlideSingleQuickSlide === true || raw.burstSlideSingleQuickSlide === false) {
      cfg.burstSlideSingleQuickSlide = raw.burstSlideSingleQuickSlide;
    }
  }

  return cfg;
}

/**
 * @param {string} slot keyof DEFAULT_BRUTE_SHEET_ATTACK_IDS
 */
export function bruteSheetStrikeAnimActive(enemy, attackCtrl, slot, inAttack) {
  const cfg = enemy?.bruteSheetArchetype;
  if (!cfg || !attackCtrl || !inAttack) return false;
  const id = cfg.attackIds?.[slot];
  if (!id) return false;
  return (
    attackCtrl.currentAttack?.id === id ||
    attackCtrl.recoveringAttackId === id
  );
}

export function bruteSheetRecoveringHoldAttackStrip(enemy, recoveringAttackId) {
  const cfg = enemy?.bruteSheetArchetype;
  if (!cfg || !recoveringAttackId) return false;
  const a = cfg.attackIds;
  const hit = (id) => !!id && recoveringAttackId === id;
  return (
    hit(a.downslash) ||
    hit(a.upslash) ||
    hit(a.cycloneSlash) ||
    hit(a.whirlwind) ||
    hit(a.groundslam) ||
    hit(a.kick)
  );
}
