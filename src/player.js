import { Vec2, clamp } from './utils.js';
import { obstacleIntersectsRect } from './utils.js';

export class Player {
  constructor(x, y, options = {}) {
    this.position = new Vec2(x, y);
    this.size = 120;
    this.drawWidth = 120;
    this.drawHeight = 120;
    this.speed = 44; // 20% of original 220
    this.isSprinting = false;
    this.sprintTimer = 0;
    this.isCrouching = false;
    this.color = "#ffff4d";
    
    // Animation properties
    this.animationFrame = 0; // Current frame (0-3 for 2x2 grid)
    this.animationTimer = 0;
    this.walkingAnimationSpeed = 1 / 16; // 16 frames per second = 0.0625 seconds per frame
    this.idleAnimationSpeed = 1 / 4; // 4 frames per second = 0.25 seconds per frame
    this.dashAnimationSpeed = 1 / 24; // 24 fps while dashing
    this.dashAnimationTimer = 0;
    this.dashAnimationDuration = 0.2;
    this.turn180Duration = 0.12;
    this.turn180MoveMult = 0.55;
    this.isMoving = false; // Track movement state
    this.facingDirection = "down"; // down/up/left/right/left_down/left_up/right_down/right_up
    this.lastVerticalPreference = "down"; // used when moving horizontally only
    this.lastMoveDirection = this.facingDirection;
    this.turnState = {
      active: false,
      elapsed: 0,
      duration: this.turn180Duration,
      currentFrame: 0,
      fromDirection: this.facingDirection,
      toDirection: this.facingDirection
    };
    
    // Attack animation configuration
    const BASE_ATTACK_DURATION = 0.72; // Base attack cooldown in seconds
    const LOD_FULL_THRESHOLD = 0.55; // Use full sequence if duration >= this
    const LOD_MEDIUM_THRESHOLD = 0.40; // Use medium sequence if duration >= this
    const ATTACK_SCALE_PEAK = 1.05; // Scale factor for peak frame (frame 8 - peak of attack)
    const RECOVERY_HOLD_MIN = 0.08; // Minimum recovery hold time
    const RECOVERY_HOLD_MAX = 0.20; // Maximum recovery hold time
    const RECOVERY_HOLD_RATIO = 0.15; // Recovery hold as ratio of attack duration
    
    // Attack state using timeline approach
    this.attackState = {
      active: false,
      stepIndex: 0,
      stepElapsed: 0,
      timelineSteps: [], // Array of {frame, duration}
      recoveryActive: false,
      recoveryElapsed: 0,
      recoveryDuration: 0,
      currentFrame: 0
    };
    this.castState = {
      active: false,
      elapsed: 0,
      duration: 0.7,
      currentFrame: 0
    };
    this.castFacingDirection = null;
    this.castStateName = "cast";
    this.castStateKeys = ['cast'];
    this.castStateCycleIndex = 0;
    
    // Attack movement slowdown profile (PoE2-style)
    this.attackMoveProfile = {
      windUpMult: 0,
      hitMult: 0,
      recoveryMult: 0,
      commitMin: 0.10,
      commitMax: 0.22,
      hitMin: 0.03,
      hitMax: 0.06,
      cancelAllowedInRecovery: true,
      cancelMoveThreshold: 0.35,  // normalized axis magnitude (0..1)
    };
    
    // Attack movement state (tracks slowdown phases)
    this.attackMoveState = {
      active: false,
      t: 0,
      duration: 0,
      windUpEnd: 0,
      hitEnd: 0,
    };

    // Combo state: 0 = main, 1 = continue, 2 = mid (4-10), 3 = continue, 4 = mid, ...
    this.attackComboIndex = 0;
    this.lastAttackStartTime = -1e9;
    this.lastAttackWasSecond = false; // Knight: true if last attack played was attack 2 (for 0.3s follow-up rule)
    this.COMBO_RESET_SEC = 1.4; // Must be longer than attack cooldown so next attack within cooldown counts as combo
    this.attackStateName = "attack";
    this.attackStateKeys = ['attack'];
    this.attackStateCycleIndex = 0;
    this.currentAttackType = options?.attackType || null;
    this.windArcherMomentum = 0;
    this.windArcherMomentumStage = 1;
    this.windArcherLastReleaseStage = 1;
    
    this.spriteSheet = {
      frameWidth: 512,
      frameHeight: 512,
      columns: 8,
      rows: 1
    };
    
    // Attack sprite sheet configuration (3x3 grid = 9 frames)
    // Sprite sheet is 1536x1536, so each frame in 3x3 grid is 512x512
    this.attackSpriteSheet = {
      frameWidth: 512,   // Width of each frame (1536 / 3 = 512)
      frameHeight: 512,  // Height of each frame (1536 / 3 = 512)
      columns: 3,       // 3 columns in the sprite sheet
      rows: 3           // 3 rows in the sprite sheet
    };
    
    const idleBase = 'assets/images/player/idle';
    const idleDown = this._loadIdleFromSpriteSheet(idleBase, 'idle_down.png', 160, 128, 9, () => {
      this._syncSizeFromIdleDownFirstFrame();
    });
    const idleUp = this._loadIdleFromSpriteSheet(idleBase, 'idle_up.png', 160, 128, 10);
    const idleSide = this._loadIdleFromSpriteSheet(idleBase, 'idle_side.png', 160, 128, 10);
    const runBase = 'assets/images/player/run';
    const runDown = this._loadIdleFromSpriteSheet(runBase, 'run-down.png', 160, 128, 5);
    const runUp = this._loadIdleFromSpriteSheet(runBase, 'run-up.png', 160, 128, 5);
    const runSide = this._loadIdleFromSpriteSheet(runBase, 'run-side.png', 160, 128, 8, () => {
      this.walkingSpriteLoaded = true;
      this.walkingSprite = runSide.image;
      this.walkingSpriteSheet = runSide.sheet;
    });

    const attackBase = 'assets/images/player/main_attacks';
    // Main 01-09 + continue 10-13 (4 frames) = 13 frames; angle-* main 01-10 + continue 11-13 (3) = 13
    const attackDown = this._loadAttackWithContinue(attackBase, 'down', 9, 10, 4, 'attack');
    const attackUp = this._loadAttackWithContinue(attackBase, 'up', 9, 10, 4, 'attack');
    const attackSide = this._loadAttackFromSpriteSheet(attackBase, 'attack-side.png', 160, 128, 13);
    const attackAngleDown = this._loadAttackFromSpriteSheet(attackBase, 'attack-angle-down.png', 160, 128, 13);
    const attackAngleUp = this._loadAttackFromSpriteSheet(attackBase, 'attack-angle-up.png', 160, 128, 13);

    this.spriteSets = {
      idle: {
        down: idleDown,
        up: idleUp,
        left: idleSide,
        right: idleSide,
        left_down: idleSide,
        left_up: idleSide,
        right_down: idleSide,
        right_up: idleSide,
      },
      crouchIdle: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      walk: {
        down: runDown,
        up: runUp,
        left: runSide,
        right: runSide,
        left_down: runSide,
        left_up: runSide,
        right_down: runSide,
        right_up: runSide,
      },
      crouchRun: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      run: {
        down: runDown,
        up: runUp,
        left: runSide,
        right: runSide,
        left_down: runSide,
        left_up: runSide,
        right_down: runSide,
        right_up: runSide,
      },
      turn180: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      dash: {
        down: this._createEmptyDirectionalSheet(),
        up: this._createEmptyDirectionalSheet(),
        left: this._createEmptyDirectionalSheet(),
        right: this._createEmptyDirectionalSheet(),
        left_down: this._createEmptyDirectionalSheet(),
        left_up: this._createEmptyDirectionalSheet(),
        right_down: this._createEmptyDirectionalSheet(),
        right_up: this._createEmptyDirectionalSheet(),
      },
      slide: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      cast: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      cast2: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      cast3: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      cast4: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      attack3: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      attack4: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      attack2: {
        down: null,
        up: null,
        left: null,
        right: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      dead: {
        down: this._loadFrameArrayNoDirection('assets/images/player/dead', 'death', 8, 'dead'),
        up: null,
        left_down: null,
        left_up: null,
        right_down: null,
        right_up: null,
      },
      attack: {
        down: attackDown,
        up: attackUp,
        left: attackSide,
        right: attackSide,
        left_down: attackAngleDown,
        right_down: attackAngleDown,
        left_up: attackAngleUp,
        right_up: attackAngleUp,
      },
    };

    // Dead uses single set for all; point all directions to same entry
    this.spriteSets.dead.up = this.spriteSets.dead.down;
    this.spriteSets.dead.left_down = this.spriteSets.dead.down;
    this.spriteSets.dead.left_up = this.spriteSets.dead.down;
    this.spriteSets.dead.right_down = this.spriteSets.dead.down;
    this.spriteSets.dead.right_up = this.spriteSets.dead.down;
    this.mirrorLeftFacing = true;
    this.spriteProfile = options?.playableCharacter?.spriteProfile || null;

    if (this.spriteProfile?.kind === 'directional_spritesheet') {
      this.characterId = options.playableCharacter.id;
      this.mirrorLeftFacing = this.spriteProfile.mirrorLeftFacing !== false;
      this.attackStateKeys = Array.isArray(this.spriteProfile.attackStates) && this.spriteProfile.attackStates.length > 0
        ? [...this.spriteProfile.attackStates]
        : ['attack'];
      this.castStateKeys = Array.isArray(this.spriteProfile.castStates) && this.spriteProfile.castStates.length > 0
        ? [...this.spriteProfile.castStates]
        : ['cast'];
      this._applyCharacterDirectionalSpritesheets(options.playableCharacter, this.spriteProfile);
    } else if (this.spriteProfile?.kind === 'directional_folder') {
      this.characterId = options.playableCharacter.id;
      this.mirrorLeftFacing = this.spriteProfile.mirrorLeftFacing !== false;
      this.attackStateKeys = Array.isArray(this.spriteProfile.attackStates) && this.spriteProfile.attackStates.length > 0
        ? [...this.spriteProfile.attackStates]
        : ['attack'];
      this.castStateKeys = Array.isArray(this.spriteProfile.castStates) && this.spriteProfile.castStates.length > 0
        ? [...this.spriteProfile.castStates]
        : ['cast'];
      this._applyCharacterFolderAnimations(options.playableCharacter, this.spriteProfile);
    } else if (options?.playableCharacter?.spriteFolderBase && options?.playableCharacter?.spriteFolderAnimations) {
      this.characterId = options.playableCharacter.id;
      this.mirrorLeftFacing = options.playableCharacter.mirrorLeftFacing !== false;
      this._applyCharacterFolderAnimations(options.playableCharacter);
    } else if (options?.playableCharacter?.spriteAssetBase && options?.playableCharacter?.spriteOverrides) {
      this.characterId = options.playableCharacter.id;
      this.mirrorLeftFacing = options.playableCharacter.mirrorLeftFacing !== false;
      this._applyCharacterSpriteOverrides(options.playableCharacter);
    } else {
      this.characterId = null;
      this.mirrorLeftFacing = options?.playableCharacter?.mirrorLeftFacing !== false;
    }

    // Compatibility fields used by trail rendering in game.js.
    this.walkingSprite = null; // Set when run (walk) loads; getTrailSpriteDrawData uses first frame
    this.walkingSpriteLoaded = false;
    this.walkingSpriteSheet = this.spriteSets.walk.right_down?.sheet || { frameWidth: 160, frameHeight: 128 };
    
    // Store config constants for use in methods
    this.BASE_ATTACK_DURATION = BASE_ATTACK_DURATION;
    this.LOD_FULL_THRESHOLD = LOD_FULL_THRESHOLD;
    this.LOD_MEDIUM_THRESHOLD = LOD_MEDIUM_THRESHOLD;
    this.ATTACK_SCALE_PEAK = ATTACK_SCALE_PEAK;
    this.RECOVERY_HOLD_MIN = RECOVERY_HOLD_MIN;
    this.RECOVERY_HOLD_MAX = RECOVERY_HOLD_MAX;
    this.RECOVERY_HOLD_RATIO = RECOVERY_HOLD_RATIO;

    queueMicrotask(() => this._syncSizeFromIdleDownFirstFrame());
  }

  /**
   * Sets collision footprint (`size`) and sprite draw size from the first frame of `idle.down`
   * (strip or per-frame). `size` is max(drawW, drawH) so wall/collision code keeps a square box.
   */
  _syncSizeFromIdleDownFirstFrame() {
    const entry = this.spriteSets?.idle?.down;
    if (!entry?.sheet) return;

    const sheet = entry.sheet;
    const cropTop = sheet.cropTop || 0;
    const frames = Math.max(1, sheet.frames | 0);

    let fw = Math.max(1, sheet.frameWidth | 0);
    let contentH = Math.max(1, sheet.frameHeight - cropTop);

    if (entry.images && entry.images.length) {
      const img0 = entry.images[0];
      if (!img0?.complete || !img0.naturalWidth) return;
      fw = img0.naturalWidth;
      const nh = img0.naturalHeight;
      sheet.frameWidth = fw;
      sheet.frameHeight = nh;
      contentH = Math.max(1, nh - cropTop);
    } else if (entry.image) {
      if (!entry.image.complete || !entry.image.naturalWidth) return;
      const nw = entry.image.naturalWidth;
      const nh = entry.image.naturalHeight;
      const rows = Math.max(1, sheet.rows | 0);
      fw = Math.max(1, Math.floor(nw / frames));
      const fh = Math.max(1, Math.floor(nh / rows));
      sheet.frameWidth = fw;
      sheet.frameHeight = fh;
      contentH = Math.max(1, fh - cropTop);
    } else {
      return;
    }

    this.drawWidth = fw;
    this.drawHeight = contentH;
    this.size = Math.max(fw, contentH);
  }
  
  /**
   * Returns attack frame counts for current facing variant (down/up/side = 9 main + 4 continue; angle-* = 10 main + 3 continue).
   */
  _getAttackFrameCounts() {
    const v = this._attackDirectionToVariant(this.facingDirection);
    const isAngle = (v === 'angle-down' || v === 'angle-up');
    return { mainCount: isAngle ? 10 : 9, continueCount: isAngle ? 3 : 4 };
  }

  /**
   * Builds attack animation timeline. sequenceType: 'main' (first hit), 'continue', or 'mid' (frames 4-10).
   * @param {number} duration - Available attack duration in seconds
   * @param {string} sequenceType - 'main' | 'continue' | 'mid'
   * @returns {{ steps, recoveryHold }}
   */
  buildAttackTimeline(duration, sequenceType = 'main', attackStateName = 'attack') {
    const steps = [];
    let remainingDuration = duration;
    // Use less recovery for continue/mid so more time goes to the animation (makes it visibly longer)
    const useShortRecovery = (sequenceType === 'continue' || sequenceType === 'mid');
    const recoveryHold = useShortRecovery
      ? this.RECOVERY_HOLD_MIN
      : Math.max(
          this.RECOVERY_HOLD_MIN,
          Math.min(this.RECOVERY_HOLD_MAX, duration * this.RECOVERY_HOLD_RATIO)
        );
    remainingDuration -= recoveryHold;
    remainingDuration = Math.max(0, remainingDuration);
    const { mainCount, continueCount } = this._getAttackFrameCounts();

    if (this.spriteProfile?.attackTimeline === 'full_sequence') {
      const stateFrameCount = Number(this.spriteProfile?.frames?.[attackStateName]);
      const defaultFrameCount = Number(this.spriteProfile?.frames?.attack);
      const frameCount = Math.max(1, stateFrameCount || defaultFrameCount || 15);
      const frames = Array.from({ length: frameCount }, (_, index) => index);
      const totalTime = useShortRecovery ? Math.max(remainingDuration, 0.28) : remainingDuration;
      const frameDuration = frames.length > 0 ? totalTime / frames.length : 0;
      for (const frame of frames) steps.push({ frame, duration: frameDuration });
      return { steps, recoveryHold };
    }

    // Give continue/mid a minimum duration so the animation is visible (at least ~0.28s for continue)
    const minContinueTotal = 0.28;
    const timeForContinue = useShortRecovery ? Math.max(remainingDuration, minContinueTotal) : remainingDuration;

    if (sequenceType === 'continue') {
      const frames = [];
      for (let i = 0; i < continueCount; i++) frames.push(mainCount + i);
      const dur = timeForContinue / frames.length;
      for (const frame of frames) steps.push({ frame, duration: dur });
      return { steps, recoveryHold };
    }

    if (sequenceType === 'mid') {
      // Asset 04 to 10 = 0-based indices 3..9 (7 frames)
      const frames = [3, 4, 5, 6, 7, 8, 9];
      const dur = timeForContinue / frames.length;
      for (const frame of frames) steps.push({ frame, duration: dur });
      return { steps, recoveryHold };
    }

    // sequenceType === 'main' — use all mainCount frames (9 for down/up/side, 10 for angle)
    const getFrameWeight = (frame) => {
      if (frame >= 0 && frame <= 4) return 0.5;
      if (frame === 5) return 2.2;
      if (frame === 0) return 1.3;
      return 1.0;
    };

    if (duration >= this.LOD_FULL_THRESHOLD) {
      const frames = [0, 1, 2, 3, 4, 5, 5, 6, 7, 8];
      if (mainCount >= 10) frames.push(9);
      let totalWeight = 0;
      for (const frame of frames) totalWeight += getFrameWeight(frame);
      for (const frame of frames) {
        steps.push({ frame, duration: (remainingDuration * getFrameWeight(frame)) / totalWeight });
      }
    } else if (duration >= this.LOD_MEDIUM_THRESHOLD) {
      const frames = [0, 2, 4, 5, 6, 7, 8];
      if (mainCount >= 10) frames.push(9);
      let totalWeight = 0;
      for (const frame of frames) totalWeight += getFrameWeight(frame);
      for (const frame of frames) {
        steps.push({ frame, duration: (remainingDuration * getFrameWeight(frame)) / totalWeight });
      }
    } else {
      const frames = [0, 4, 5, mainCount - 1];
      let totalWeight = 0;
      for (const frame of frames) totalWeight += getFrameWeight(frame);
      for (const frame of frames) {
        steps.push({ frame, duration: (remainingDuration * getFrameWeight(frame)) / totalWeight });
      }
    }
    return { steps, recoveryHold };
  }
  
  /**
   * Triggers attack animation. Combo: 1st = main, 2nd = continue, 3rd = mid (4-10), 4th = continue, then repeat mid/continue.
   * Knight: first attack = attack 1 (4 frames); if player attacks again within 0.3s = attack 2 (6 frames); then resets to attack 1.
   * @param {number} attackDurationSeconds - Available attack duration (default: 0.6)
   * @param {number} [gameTime] - Game time for combo reset; if elapsed since last attack > COMBO_RESET_SEC, combo resets to main
   */
  triggerAttackAnimation(attackDurationSeconds = 0.6, gameTime) {
    const now = typeof gameTime === 'number' ? gameTime : (typeof performance !== 'undefined' && performance.now ? performance.now() / 1000 : 0);
    if ((now - this.lastAttackStartTime) > this.COMBO_RESET_SEC) {
      this.attackComboIndex = 0;
    }
    const combo = this.attackComboIndex;
    const sequenceType = combo === 0 ? 'main' : (combo % 2 === 1 ? 'continue' : 'mid');
    this.lastAttackStartTime = now;
    this.attackComboIndex = combo + 1;

    // Knight: attack 1 by default; attack 2 only if second input within 1s of previous attack start
    const QUICK_FOLLOW_UP_SEC = 1;
    let steps;
    let recoveryHold;
    let attackStateName = 'attack';
    if (this.characterId === 'knight' && this.knightAttackSheets?.length >= 2) {
      const quickFollowUp = (now - (this._lastAttackStartTimeForKnight ?? -1e9)) <= QUICK_FOLLOW_UP_SEC;
      const playAttack2 = quickFollowUp && !this.lastAttackWasSecond;
      this._lastAttackStartTimeForKnight = now;
      this.lastAttackWasSecond = playAttack2;
      this.knightAttackSheetIndex = playAttack2 ? 1 : 0;
      const frameCount = playAttack2 ? 6 : 4;
      recoveryHold = Math.max(this.RECOVERY_HOLD_MIN, Math.min(this.RECOVERY_HOLD_MAX, attackDurationSeconds * this.RECOVERY_HOLD_RATIO));
      const remainingDuration = Math.max(0, attackDurationSeconds - recoveryHold);
      const frameDuration = remainingDuration / frameCount;
      steps = [];
      for (let i = 0; i < frameCount; i++) steps.push({ frame: i, duration: frameDuration });
    } else {
      const availableAttackStates = this.attackStateKeys.filter((stateKey) => this._getDirectionalSprite(stateKey, this.facingDirection));
      if (availableAttackStates.length > 0) {
        const usesComboLockedAttackStates = this.characterId === 'knight' && availableAttackStates.length >= 4;
        if (usesComboLockedAttackStates) {
          attackStateName = availableAttackStates[combo % availableAttackStates.length];
          this.attackStateCycleIndex = this.attackComboIndex % availableAttackStates.length;
        } else {
          attackStateName = availableAttackStates[this.attackStateCycleIndex % availableAttackStates.length];
          this.attackStateCycleIndex = (this.attackStateCycleIndex + 1) % availableAttackStates.length;
        }
      }
      const built = this.buildAttackTimeline(attackDurationSeconds, sequenceType, attackStateName);
      steps = built.steps;
      recoveryHold = built.recoveryHold;
    }

    this.attackFacingDirection = this.facingDirection;
    this.attackStateName = attackStateName;
    this.attackState = {
      active: true,
      stepIndex: 0,
      stepElapsed: 0,
      timelineSteps: steps,
      recoveryActive: false,
      recoveryElapsed: 0,
      recoveryDuration: recoveryHold,
      currentFrame: steps[0].frame
    };
    
    // Initialize attack movement slowdown state
    const D = attackDurationSeconds;
    const profile = this.attackMoveProfile;
    const commit = clamp(D * 0.55, profile.commitMin, profile.commitMax);
    const hit = clamp(D * 0.12, profile.hitMin, profile.hitMax);
    const windUp = Math.max(commit - hit, 0.06);
    const recovery = Math.max(D - commit, 0.08);
    
    this.attackMoveState = {
      active: true,
      t: 0,
      duration: D,
      windUpEnd: windUp,
      hitEnd: windUp + hit,
    };
  }
  
  /**
   * Gets the movement speed multiplier based on current attack phase.
   * First 20%: smooth ramp 1.0 -> 0.7; middle 35%: 0.7; last 45%: smooth ramp 0.7 -> 1.0.
   * @returns {number} Movement multiplier (1.0 = normal speed)
   */
  getAttackMoveMult() {
    if (!this.attackMoveState?.active) {
      return 1.0;
    }
    if (this.currentAttackType === 'guardCombo') {
      return 0.2;
    }
    const state = this.attackMoveState;
    const d = state.duration;
    const t = state.t;
    const q1 = 0.20 * d;
    const q2 = 0.55 * d;
    const midMult = this.characterId === 'wind_archer' ? 0.85 : 0.7;
    if (t <= q1) return 1 - (1 - midMult) * (t / q1);
    if (t < q2) return midMult;
    return midMult + (1 - midMult) * (t - q2) / (d - q2);
  }

  getCastMoveMult() {
    if (!this.castState?.active) return 1.0;
    return this.characterId === 'wind_archer' ? 0.75 : 0.5;
  }
  
  /**
   * Cancels the attack movement lock (allows full movement speed).
   * Only affects movement penalty, does not cancel attack animation/damage.
   */
  cancelAttackMovementLock() {
    if (this.attackMoveState?.active) {
      this.attackMoveState.active = false;
    }
  }

  getAttackTriggerDelayForFrame(targetFrame) {
    const steps = Array.isArray(this.attackState?.timelineSteps) ? this.attackState.timelineSteps : [];
    if (steps.length === 0) return 0;
    const normalizedTarget = Math.max(0, Number(targetFrame) || 0);
    let elapsed = 0;
    for (const step of steps) {
      if ((Number(step?.frame) || 0) >= normalizedTarget) {
        return elapsed;
      }
      elapsed += Math.max(0, Number(step?.duration) || 0);
    }
    return 0;
  }

  /**
   * Apply playable character sprite overrides. spriteOverrides: { idle_down: 'file.png', run_side: '...', dash_down: '...', ... }.
   * Directions: idle/run use down, up, side (side used for left/right and diagonals). Dash uses down, up, left, right, or side.
   */
  _applyCharacterSpriteOverrides(character) {
    const base = character.spriteAssetBase.replace(/\/$/, '');
    const overrides = character.spriteOverrides || {};
    const frameSize = character.spriteFrameSize || { width: 160, height: 128 };
    const framesByType = character.spriteFrames || {};
    const defaultFrames = 8;

    const cropTop = character.spriteCropTop ?? 0;
    const loadEntry = (filename, frames = defaultFrames, fw = frameSize.width, fh = frameSize.height) => {
      const sheet = { frameWidth: fw, frameHeight: fh, frames, cropTop };
      const state = { image: new Image(), sheet, loaded: false };
      state.image.onload = () => {
        state.loaded = true;
        this._syncSizeFromIdleDownFirstFrame();
      };
      state.image.onerror = () => {
        console.warn(`Failed to load character sprite: ${base}/${filename}`);
        state.loaded = true;
      };
      state.image.src = `${base}/${filename}`;
      return state;
    };

    const dirsSide = ['left', 'right', 'left_down', 'left_up', 'right_down', 'right_up'];
    const idleFrames = framesByType.idle ?? defaultFrames;
    if (overrides.idle_down) {
      const e = loadEntry(overrides.idle_down, idleFrames);
      this.spriteSets.idle.down = e;
    }
    if (overrides.idle_up) {
      const e = loadEntry(overrides.idle_up, idleFrames);
      this.spriteSets.idle.up = e;
    }
    if (overrides.idle_side) {
      const e = loadEntry(overrides.idle_side, idleFrames);
      for (const d of dirsSide) this.spriteSets.idle[d] = e;
    }
    const runFrames = framesByType.run ?? defaultFrames;
    if (overrides.run_down) {
      const e = loadEntry(overrides.run_down, runFrames);
      this.spriteSets.walk.down = e;
    }
    if (overrides.run_up) {
      const e = loadEntry(overrides.run_up, runFrames);
      this.spriteSets.walk.up = e;
    }
    if (overrides.run_side) {
      const e = loadEntry(overrides.run_side, runFrames);
      for (const d of dirsSide) this.spriteSets.walk[d] = e;
      this.walkingSpriteLoaded = false;
      this.walkingSprite = null;
      e.image.onload = () => {
        this.walkingSpriteLoaded = true;
        this.walkingSprite = e.image;
        this.walkingSpriteSheet = e.sheet;
      };
    }
    const dashDirs = ['down', 'up', 'left', 'right', 'left_down', 'left_up', 'right_down', 'right_up'];
    const dashFrames = framesByType.dash ?? defaultFrames;
    if (overrides.dash_down) {
      const e = loadEntry(overrides.dash_down, dashFrames);
      this.spriteSets.dash.down = e;
    }
    if (overrides.dash_up) {
      const e = loadEntry(overrides.dash_up, dashFrames);
      this.spriteSets.dash.up = e;
    }
    if (overrides.dash_left) {
      const e = loadEntry(overrides.dash_left, dashFrames);
      this.spriteSets.dash.left = e;
      this.spriteSets.dash.left_down = e;
      this.spriteSets.dash.left_up = e;
    }
    if (overrides.dash_right) {
      const e = loadEntry(overrides.dash_right, dashFrames);
      this.spriteSets.dash.right = e;
      this.spriteSets.dash.right_down = e;
      this.spriteSets.dash.right_up = e;
    }
    if (overrides.dash_side) {
      const e = loadEntry(overrides.dash_side, dashFrames);
      for (const d of dashDirs) {
        if (!this.spriteSets.dash[d]) this.spriteSets.dash[d] = e;
      }
    }
    if (overrides.attack_1 && overrides.attack_2) {
      const a1Frames = framesByType.attack_1 ?? 4;
      const a2Frames = framesByType.attack_2 ?? 6;
      const e1 = loadEntry(overrides.attack_1, a1Frames);
      const e2 = loadEntry(overrides.attack_2, a2Frames);
      this.knightAttackSheets = [e1, e2];
      this.knightAttackSheetIndex = 0; // 0 = attack 1, 1 = attack 2 (set in triggerAttackAnimation by 0.3s follow-up rule)
      for (const d of ['down', 'up', 'left', 'right', 'left_down', 'left_up', 'right_down', 'right_up']) {
        this.spriteSets.attack[d] = e1;
      }
      this.attackAlternateFrames = true;
    }
    const slideFrames = framesByType.slide ?? defaultFrames;
    if (overrides.slide_down || overrides.slide_side) {
      this.spriteSets.slide = this.spriteSets.slide || {};
      const slideEntry = overrides.slide_down ? loadEntry(overrides.slide_down, slideFrames) : loadEntry(overrides.slide_side, slideFrames);
      for (const d of dashDirs) this.spriteSets.slide[d] = slideEntry;
      if (overrides.slide_up) this.spriteSets.slide.up = loadEntry(overrides.slide_up, slideFrames);
      if (overrides.slide_side) {
        for (const d of ['left', 'right', 'left_down', 'left_up', 'right_down', 'right_up']) this.spriteSets.slide[d] = this.spriteSets.slide[d] || loadEntry(overrides.slide_side, slideFrames);
      }
    }
    if (character.id === 'reaper') {
      const dirs = ['down', 'up', 'left', 'right', 'left_down', 'left_up', 'right_down', 'right_up'];
      for (const d of dirs) {
        this.spriteSets.attack[d] = this.spriteSets.idle.down || this.spriteSets.idle[d];
      }
      const hostile = character.reaperHostileSprites;
      const revealSheet = character.reaperRevealSheet;
      const holsterSheet = character.reaperHolsterSheet;
      if (hostile && base) {
        this.reaperHostileIdle = loadEntry(hostile.idle, framesByType.idle ?? 5);
        this.reaperHostileWalk = loadEntry(hostile.run, framesByType.run ?? 8);
        this.reaperHostileAttack = loadEntry(hostile.attack, 8);
      }
      if (revealSheet && base) this.reaperRevealSheet = loadEntry(revealSheet, 8);
      if (holsterSheet && base) this.reaperHolsterSheet = loadEntry(holsterSheet, 8);
    }
  }

  _applyCharacterFolderAnimations(character, spriteProfile = null) {
    const base = (spriteProfile?.basePath || character.spriteFolderBase || '').replace(/\/$/, '');
    const animations = spriteProfile?.states || character.spriteFolderAnimations || {};
    const framesByType = spriteProfile?.frames || character.spriteFrames || {};
    const dirs = ["down", "up", "left", "right", "left_down", "left_up", "right_down", "right_up"];
    const assetByDirection = {
      down: { folder: "S", angle: "270" },
      up: { folder: "N", angle: "90" },
      left: { folder: "W", angle: "180" },
      right: { folder: "E", angle: "0" },
      left_down: { folder: "SW", angle: "225" },
      left_up: { folder: "NW", angle: "135" },
      right_down: { folder: "SE", angle: "315" },
      right_up: { folder: "NE", angle: "45" }
    };
    const loadDirectionalFolder = (actionFolder, direction, frames) => {
      const asset = assetByDirection[direction];
      if (!actionFolder || !asset) return null;
      return this._loadFrameArrayFromFolder(
        `${base}/${actionFolder}/${asset.folder}`,
        actionFolder,
        asset.angle,
        frames,
        `${character.id} ${actionFolder} ${asset.folder}`
      );
    };

    const idleFrames = framesByType.idle ?? 15;
    if (animations.idle) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.idle, dir, idleFrames);
        if (entry) this.spriteSets.idle[dir] = entry;
      }
    }

    const crouchIdleFrames = framesByType.crouchIdle ?? idleFrames;
    if (animations.crouchIdle) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.crouchIdle, dir, crouchIdleFrames);
        if (entry) this.spriteSets.crouchIdle[dir] = entry;
      }
    } else {
      for (const dir of dirs) {
        this.spriteSets.crouchIdle[dir] = this.spriteSets.idle[dir];
      }
    }

    const walkFrames = framesByType.walk ?? framesByType.run ?? 15;
    if (animations.walk) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.walk, dir, walkFrames);
        if (entry) this.spriteSets.walk[dir] = entry;
      }
      const trailEntry = this.spriteSets.walk.right_down || this.spriteSets.walk.right || this.spriteSets.walk.down;
      if (trailEntry) {
        this.walkingSpriteLoaded = true;
        this.walkingSprite = trailEntry.images?.[0] || null;
        this.walkingSpriteSheet = trailEntry.sheet;
      }
    }

    const runFrames = framesByType.run ?? walkFrames;
    if (animations.run) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.run, dir, runFrames);
        if (entry) this.spriteSets.run[dir] = entry;
      }
    } else {
      for (const dir of dirs) {
        this.spriteSets.run[dir] = this.spriteSets.walk[dir];
      }
    }

    const crouchRunFrames = framesByType.crouchRun ?? walkFrames;
    if (animations.crouchRun) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.crouchRun, dir, crouchRunFrames);
        if (entry) this.spriteSets.crouchRun[dir] = entry;
      }
    } else {
      for (const dir of dirs) {
        this.spriteSets.crouchRun[dir] = this.spriteSets.walk[dir];
      }
    }

    const dashFrames = framesByType.dash ?? 15;
    if (animations.dash) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.dash, dir, dashFrames);
        if (entry) this.spriteSets.dash[dir] = entry;
      }
    }

    const slideFrames = framesByType.slide ?? dashFrames;
    if (animations.slide) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.slide, dir, slideFrames);
        if (entry) this.spriteSets.slide[dir] = entry;
      }
    }

    const castFrames = framesByType.cast ?? walkFrames;
    if (animations.cast) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.cast, dir, castFrames);
        if (entry) this.spriteSets.cast[dir] = entry;
      }
    }
    const cast2Frames = framesByType.cast2 ?? castFrames;
    if (animations.cast2) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.cast2, dir, cast2Frames);
        if (entry) this.spriteSets.cast2[dir] = entry;
      }
    }
    const cast3Frames = framesByType.cast3 ?? castFrames;
    if (animations.cast3) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.cast3, dir, cast3Frames);
        if (entry) this.spriteSets.cast3[dir] = entry;
      }
    }
    const cast4Frames = framesByType.cast4 ?? castFrames;
    if (animations.cast4) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.cast4, dir, cast4Frames);
        if (entry) this.spriteSets.cast4[dir] = entry;
      }
    }
    const turn180Frames = framesByType.turn180 ?? 15;
    if (animations.turn180) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.turn180, dir, turn180Frames);
        if (entry) this.spriteSets.turn180[dir] = entry;
      }
    }

    const attackFrames = framesByType.attack ?? 15;
    if (animations.attack) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.attack, dir, attackFrames);
        if (entry) this.spriteSets.attack[dir] = entry;
      }
    }

    const attack2Frames = framesByType.attack2 ?? attackFrames;
    if (animations.attack2) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.attack2, dir, attack2Frames);
        if (entry) this.spriteSets.attack2[dir] = entry;
      }
    }

    const attack3Frames = framesByType.attack3 ?? attackFrames;
    if (animations.attack3) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.attack3, dir, attack3Frames);
        if (entry) this.spriteSets.attack3[dir] = entry;
      }
    }

    const attack4Frames = framesByType.attack4 ?? attackFrames;
    if (animations.attack4) {
      for (const dir of dirs) {
        const entry = loadDirectionalFolder(animations.attack4, dir, attack4Frames);
        if (entry) this.spriteSets.attack4[dir] = entry;
      }
    }
  }

  _applyCharacterDirectionalSpritesheets(character, spriteProfile) {
    const base = (spriteProfile?.basePath || '').replace(/\/$/, '');
    const states = spriteProfile?.states || {};
    const framesByType = spriteProfile?.frames || {};
    const loadState = (stateKey, onLoaded) => {
      const imageFile = states[stateKey];
      if (!imageFile) return null;
      return this._loadDirectionalRowsFromSpritesheet(
        `${base}/${imageFile}.png`,
        framesByType[stateKey] ?? 15,
        `${character.id} ${stateKey}`,
        spriteProfile?.rowCount || 8,
        onLoaded
      );
    };

    const idleEntries = loadState('idle', () => this._syncSizeFromIdleDownFirstFrame());
    if (idleEntries) Object.assign(this.spriteSets.idle, idleEntries);

    const crouchIdleEntries = loadState('crouchIdle');
    if (crouchIdleEntries) {
      Object.assign(this.spriteSets.crouchIdle, crouchIdleEntries);
    } else {
      Object.assign(this.spriteSets.crouchIdle, this.spriteSets.idle);
    }

    const walkEntries = loadState('walk', () => {
      const trailEntry = this.spriteSets.walk.right_down || this.spriteSets.walk.right || this.spriteSets.walk.down;
      if (trailEntry) {
        this.walkingSpriteLoaded = true;
        this.walkingSprite = trailEntry.image || null;
        this.walkingSpriteSheet = trailEntry.sheet;
      }
    });
    if (walkEntries) Object.assign(this.spriteSets.walk, walkEntries);

    const runEntries = loadState('run');
    if (runEntries) {
      Object.assign(this.spriteSets.run, runEntries);
    } else {
      Object.assign(this.spriteSets.run, this.spriteSets.walk);
    }

    const crouchRunEntries = loadState('crouchRun');
    if (crouchRunEntries) {
      Object.assign(this.spriteSets.crouchRun, crouchRunEntries);
    } else {
      Object.assign(this.spriteSets.crouchRun, this.spriteSets.walk);
    }

    const dashEntries = loadState('dash');
    if (dashEntries) Object.assign(this.spriteSets.dash, dashEntries);

    const slideEntries = loadState('slide');
    if (slideEntries) Object.assign(this.spriteSets.slide, slideEntries);

    const castEntries = loadState('cast');
    if (castEntries) Object.assign(this.spriteSets.cast, castEntries);
    const cast2Entries = loadState('cast2');
    if (cast2Entries) Object.assign(this.spriteSets.cast2, cast2Entries);
    const cast3Entries = loadState('cast3');
    if (cast3Entries) Object.assign(this.spriteSets.cast3, cast3Entries);
    const cast4Entries = loadState('cast4');
    if (cast4Entries) Object.assign(this.spriteSets.cast4, cast4Entries);
    const turn180Entries = loadState('turn180');
    if (turn180Entries) Object.assign(this.spriteSets.turn180, turn180Entries);

    const attackEntries = loadState('attack');
    if (attackEntries) Object.assign(this.spriteSets.attack, attackEntries);

    const attack2Entries = loadState('attack2');
    if (attack2Entries) Object.assign(this.spriteSets.attack2, attack2Entries);

    const attack3Entries = loadState('attack3');
    if (attack3Entries) Object.assign(this.spriteSets.attack3, attack3Entries);

    const attack4Entries = loadState('attack4');
    if (attack4Entries) Object.assign(this.spriteSets.attack4, attack4Entries);
  }

  _createDirectionalSheet(src, label) {
    const image = new Image();
    const sheet = {
      frameWidth: 160,
      frameHeight: 128,
      columns: 8,
      rows: 1,
      frames: 8
    };
    const state = { image, loaded: false, sheet };
    image.onload = () => {
      state.loaded = true;
      sheet.frameWidth = 160;
      sheet.frameHeight = 128;
      sheet.columns = 8;
      sheet.rows = 1;
      sheet.frames = 8;
      if (src.includes('walk_Right_Down')) {
        this.walkingSpriteLoaded = true;
      }
    };
    image.onerror = () => {
      state.loaded = false;
      console.warn(`Failed to load player sprite: ${label}`);
    };
    image.src = src;
    return state;
  }

  /** Returns a placeholder dash entry that never loads (no network request). Used when Dash_Dust assets are omitted. */
  _createEmptyDirectionalSheet() {
    const sheet = { frameWidth: 160, frameHeight: 128, columns: 8, rows: 1, frames: 8 };
    return { image: null, loaded: false, sheet };
  }

  /**
   * Load per-frame images from a folder. Files named {prefix}-{direction}-NN.png (NN zero-padded).
   * @param {string} folder - e.g. 'assets/images/player/idle'
   * @param {string} prefix - e.g. 'idle'
   * @param {string} direction - e.g. 'down', 'up', 'side'
   * @param {number} count - number of frames (01..count)
   * @param {string} label - for error logging
   * @param {() => void} onAllLoaded - optional callback when all frames loaded (e.g. set walkingSpriteLoaded)
   * @returns {{ images: HTMLImageElement[], sheet: { frameWidth, frameHeight, frames }, loaded: boolean }}
   */
  _loadFrameArray(folder, prefix, direction, count, label, onAllLoaded) {
    const sheet = { frameWidth: 160, frameHeight: 128, frames: count };
    const images = [];
    let loadedCount = 0;
    const state = { images, sheet, loaded: false };

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === 1 && images[0].naturalWidth) {
        sheet.frameWidth = images[0].naturalWidth;
        sheet.frameHeight = images[0].naturalHeight;
      }
      if (loadedCount === count) {
        state.loaded = true;
        if (onAllLoaded) onAllLoaded();
      }
    };

    for (let n = 1; n <= count; n++) {
      const nn = String(n).padStart(2, '0');
      const src = `${folder}/${prefix}-${direction}-${nn}.png`;
      const img = new Image();
      img.onload = checkAllLoaded;
      img.onerror = () => {
        console.warn(`Failed to load player sprite: ${label} ${direction} frame ${n}`);
        checkAllLoaded();
      };
      img.src = src;
      images.push(img);
    }
    return state;
  }

  _loadFrameArrayFromFolder(folder, prefix, angle, count, label, onAllLoaded) {
    const sheet = { frameWidth: 160, frameHeight: 128, frames: count };
    const images = [];
    let loadedCount = 0;
    let successCount = 0;
    const state = { images, sheet, loaded: false };

    const checkAllLoaded = (imgLoaded = false) => {
      loadedCount++;
      if (imgLoaded) {
        successCount++;
      }
      if (imgLoaded && successCount === 1) {
        const firstLoaded = images.find((img) => img?.naturalWidth);
        if (firstLoaded) {
          sheet.frameWidth = firstLoaded.naturalWidth;
          sheet.frameHeight = firstLoaded.naturalHeight;
        }
      }
      if (loadedCount === count) {
        state.loaded = successCount > 0;
        if (state.loaded && onAllLoaded) onAllLoaded();
      }
    };

    for (let n = 0; n < count; n++) {
      const frameNumber = String(1 + n * 2).padStart(3, '0');
      const src = `${folder}/${prefix}_${angle}_${frameNumber}.png`;
      const img = new Image();
      img.onload = () => checkAllLoaded(true);
      img.onerror = () => {
        console.warn(`Failed to load player sprite folder frame: ${label} ${frameNumber}`);
        checkAllLoaded(false);
      };
      img.src = src;
      images.push(img);
    }
    return state;
  }

  _loadDirectionalRowsFromSpritesheet(src, frameCount, label, rowCount = 8, onLoaded) {
    const directions = ['right', 'right_down', 'down', 'left_down', 'left', 'left_up', 'up', 'right_up'];
    const image = new Image();
    const states = Object.fromEntries(directions.map((direction, rowIndex) => [
      direction,
      {
        image,
        loaded: false,
        sheet: {
          frameWidth: 160,
          frameHeight: 128,
          frames: frameCount,
          rows: rowCount,
          rowIndex
        }
      }
    ]));

    image.onload = () => {
      const frameWidth = Math.max(1, Math.floor(image.naturalWidth / Math.max(1, frameCount)));
      const frameHeight = Math.max(1, Math.floor(image.naturalHeight / Math.max(1, rowCount)));
      for (const direction of directions) {
        const state = states[direction];
        state.loaded = true;
        state.sheet.frameWidth = frameWidth;
        state.sheet.frameHeight = frameHeight;
      }
      if (onLoaded) onLoaded();
    };
    image.onerror = () => {
      console.warn(`Failed to load player directional spritesheet: ${label}`);
      for (const direction of directions) {
        states[direction].loaded = false;
      }
    };
    image.src = src;
    return states;
  }

  /** Map game direction to asset direction for idle/run (3 sets: down, up, side). */
  _idleRunDirectionToAsset(direction) {
    if (direction === 'down' || direction === 'up') return direction;
    return 'side';
  }

  /** Map game direction to attack variant (5 sets: down, up, side, angle-down, angle-up). */
  _attackDirectionToVariant(direction) {
    if (direction === 'down') return 'down';
    if (direction === 'up') return 'up';
    if (direction === 'left' || direction === 'right') return 'side';
    if (direction === 'left_down' || direction === 'right_down') return 'angle-down';
    if (direction === 'left_up' || direction === 'right_up') return 'angle-up';
    return 'side';
  }

  /**
   * Load attack from a single sprite sheet image (horizontal strip).
   * @param {string} folder - e.g. 'assets/images/player/main_attacks'
   * @param {string} imageFile - e.g. 'attack-angle-down.png'
   * @param {number} frameWidth - width of each frame in the sheet
   * @param {number} frameHeight - height of each frame
   * @param {number} frameCount - total number of frames
   * @returns {{ image, sheet, loaded }}
   */
  _loadAttackFromSpriteSheet(folder, imageFile, frameWidth, frameHeight, frameCount) {
    const sheet = { frameWidth, frameHeight, frames: frameCount };
    const state = { image: null, sheet, loaded: false };
    const img = new Image();
    img.onload = () => {
      state.loaded = true;
    };
    img.onerror = () => {
      console.warn(`Failed to load attack sprite sheet: ${folder}/${imageFile}`);
      state.loaded = true;
    };
    img.src = `${folder}/${imageFile}`;
    state.image = img;
    return state;
  }

  /**
   * Load idle from a single sprite sheet image (horizontal strip). Same pattern as attack sheets.
   * @param {string} folder - e.g. 'assets/images/player/idle'
   * @param {string} imageFile - e.g. 'idle_down.png'
   * @param {number} frameWidth - width of each frame
   * @param {number} frameHeight - height of each frame
   * @param {number} frameCount - total number of frames
   * @returns {{ image, sheet, loaded }}
   */
  _loadIdleFromSpriteSheet(folder, imageFile, frameWidth, frameHeight, frameCount, onLoaded) {
    const sheet = { frameWidth, frameHeight, frames: frameCount };
    const state = { image: null, sheet, loaded: false };
    const img = new Image();
    img.onload = () => {
      state.loaded = true;
      if (onLoaded) onLoaded();
    };
    img.onerror = () => {
      console.warn(`Failed to load idle sprite sheet: ${folder}/${imageFile}`);
      state.loaded = true;
    };
    img.src = `${folder}/${imageFile}`;
    state.image = img;
    return state;
  }

  /**
   * Load attack frames: main (attack-{variant}-01..NN) + continue (attack-{variant}-continue-MM..).
   * @param {string} folder - e.g. 'assets/images/player/main_attacks'
   * @param {string} variant - e.g. 'down', 'angle-down'
   * @param {number} mainCount - main frames 01..mainCount
   * @param {number} continueStart - first continue frame number (e.g. 10)
   * @param {number} continueCount - number of continue frames
   * @returns {{ images, sheet, loaded }}
   */
  _loadAttackWithContinue(folder, variant, mainCount, continueStart, continueCount, label) {
    const totalFrames = mainCount + continueCount;
    const sheet = { frameWidth: 160, frameHeight: 128, frames: totalFrames };
    const images = [];
    let loadedCount = 0;
    const state = { images, sheet, loaded: false };

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === 1 && images[0]?.naturalWidth) {
        sheet.frameWidth = images[0].naturalWidth;
        sheet.frameHeight = images[0].naturalHeight;
      }
      if (loadedCount === totalFrames) state.loaded = true;
    };

    for (let n = 1; n <= mainCount; n++) {
      const nn = String(n).padStart(2, '0');
      const src = `${folder}/attack-${variant}-${nn}.png`;
      const img = new Image();
      img.onload = checkAllLoaded;
      img.onerror = () => { console.warn(`Failed to load ${label} ${variant} main ${n}`); checkAllLoaded(); };
      img.src = src;
      images.push(img);
    }
    for (let i = 0; i < continueCount; i++) {
      const n = continueStart + i;
      const nn = String(n).padStart(2, '0');
      const src = `${folder}/attack-${variant}-continue-${nn}.png`;
      const img = new Image();
      img.onload = checkAllLoaded;
      img.onerror = () => { console.warn(`Failed to load ${label} ${variant} continue ${n}`); checkAllLoaded(); };
      img.src = src;
      images.push(img);
    }
    return state;
  }

  /** Load per-frame images with names {prefix}-NN.png (e.g. death-01.png). */
  _loadFrameArrayNoDirection(folder, prefix, count, label) {
    const sheet = { frameWidth: 160, frameHeight: 128, frames: count };
    const images = [];
    let loadedCount = 0;
    const state = { images, sheet, loaded: false };
    for (let n = 1; n <= count; n++) {
      const nn = String(n).padStart(2, '0');
      const src = `${folder}/${prefix}-${nn}.png`;
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === 1 && img.naturalWidth) {
          sheet.frameWidth = img.naturalWidth;
          sheet.frameHeight = img.naturalHeight;
        }
        if (loadedCount === count) state.loaded = true;
      };
      img.onerror = () => {
        console.warn(`Failed to load player sprite: ${label} frame ${n}`);
        loadedCount++;
        if (loadedCount === count) state.loaded = true;
      };
      img.src = src;
      images.push(img);
    }
    return state;
  }

  /**
   * Maps angle (radians, from atan2(dy, dx) player→cursor) to one of 8 direction strings.
   * 0 = right, π/2 = down, π = left, -π/2 = up (y down).
   */
  _getDirectionFromAngle(angleRad) {
    const TAU = 2 * Math.PI;
    const angleNorm = ((angleRad % TAU) + TAU) % TAU;
    const sector = Math.floor((angleNorm + Math.PI / 8) / (Math.PI / 4)) % 8;
    const dirs = ['right', 'right_down', 'down', 'left_down', 'left', 'left_up', 'up', 'right_up'];
    return dirs[sector];
  }

  _pickFacingDirection(axis) {
    const absX = Math.abs(axis.x);
    const absY = Math.abs(axis.y);
    const movingX = absX > 0.01;
    const movingY = absY > 0.01;
    if (!movingX && !movingY) return this.facingDirection;

    if (movingY) {
      this.lastVerticalPreference = axis.y < 0 ? "up" : "down";
    }

    if (movingX && movingY) {
      if (axis.x < 0 && axis.y < 0) return "left_up";
      if (axis.x < 0 && axis.y > 0) return "left_down";
      if (axis.x > 0 && axis.y < 0) return "right_up";
      return "right_down";
    }
    if (movingY) {
      return axis.y < 0 ? "up" : "down";
    }
    // Horizontal-only: use side attack (left/right) so attack-side sprite sheet is used.
    if (axis.x < 0) return "left";
    return "right";
  }

  _directionToUnitVector(direction) {
    switch (direction) {
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
      case 'up': return { x: 0, y: -1 };
      case 'down': return { x: 0, y: 1 };
      case 'left_up': return { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
      case 'left_down': return { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
      case 'right_up': return { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
      case 'right_down': return { x: Math.SQRT1_2, y: Math.SQRT1_2 };
      default: return { x: 0, y: 0 };
    }
  }

  _isHardReverseTurn(fromDirection, toDirection) {
    const from = this._directionToUnitVector(fromDirection);
    const to = this._directionToUnitVector(toDirection);
    return (from.x * to.x + from.y * to.y) <= -0.8;
  }

  _beginTurn180(fromDirection, toDirection) {
    this.turnState = {
      active: true,
      elapsed: 0,
      duration: this.turn180Duration,
      currentFrame: 0,
      fromDirection,
      toDirection
    };
  }

  setFacingFromVector(dx, dy) {
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
    this.facingDirection = this._getDirectionFromAngle(Math.atan2(dy, dx));
  }

  beginDashAnimation(dx = 0, dy = 0, duration = null) {
    this.dashAnimationTimer = 0;
    if (Number.isFinite(duration) && duration > 0) {
      this.dashAnimationDuration = duration;
    }
    this.setFacingFromVector(dx, dy);
  }

  tickDashAnimation(dt) {
    this.dashAnimationTimer += dt;
  }

  beginCastAnimation(duration = 0.7, targetX = null, targetY = null) {
    const castDuration = Number.isFinite(duration) && duration > 0 ? duration : 0.7;
    let castDirection = this.facingDirection;
    if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
      const px = this.position.x + this.size / 2;
      const py = this.position.y + this.size / 2;
      const dx = targetX - px;
      const dy = targetY - py;
      if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
        castDirection = this._getDirectionFromAngle(Math.atan2(dy, dx));
      }
    }
    const availableCastStates = this.castStateKeys.filter((stateKey) => this._getDirectionalSprite(stateKey, castDirection));
    const castStateName = availableCastStates.length > 0
      ? availableCastStates[this.castStateCycleIndex % availableCastStates.length]
      : 'cast';
    if (availableCastStates.length > 0) {
      this.castStateCycleIndex = (this.castStateCycleIndex + 1) % availableCastStates.length;
    }
    this.castStateName = castStateName;
    this.castFacingDirection = castDirection;
    this.castState = {
      active: true,
      elapsed: 0,
      duration: castDuration,
      currentFrame: 0
    };
  }

  _getDirectionalSprite(stateName, direction) {
    const state = this.spriteSets[stateName];
    if (!state) return null;
    return state[direction] || state.down || null;
  }

  _getAnimFrameCount(stateName, direction) {
    const entry = this._getDirectionalSprite(stateName, direction);
    return entry?.sheet?.frames || 1;
  }

  _getLoopFrameCount(stateName, direction) {
    const sequence = this.spriteProfile?.loopSequence?.[stateName];
    if (Array.isArray(sequence) && sequence.length > 0) return sequence.length;
    const sheetFrames = this._getAnimFrameCount(stateName, direction);
    const configured = Number(this.spriteProfile?.loopFrames?.[stateName]);
    if (!Number.isFinite(configured) || configured <= 0) return sheetFrames;
    return Math.max(1, Math.min(sheetFrames, Math.floor(configured)));
  }

  _mapStateFrame(stateName, frame) {
    const sequence = this.spriteProfile?.loopSequence?.[stateName];
    if (!Array.isArray(sequence) || sequence.length <= 0) return frame;
    const idx = ((frame % sequence.length) + sequence.length) % sequence.length;
    return sequence[idx];
  }

  _shouldFlipDirection(direction) {
    if (!this.mirrorLeftFacing) return false;
    return direction === 'left_down' || direction === 'left_up' || direction === 'left';
  }

  _drawDirectionalFrame(ctx, stateName, direction, frame, dx, dy, dw, dh, flipH = false) {
    const entry = this._getDirectionalSprite(stateName, direction);
    if (!entry) return false;
    const sheet = entry.sheet;
    const total = Math.max(1, sheet.frames);
    const mappedFrame = this._mapStateFrame(stateName, frame);
    const f = ((mappedFrame % total) + total) % total;

    if (flipH) {
      ctx.save();
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    }

    let drawn = false;
    const cropTop = sheet.cropTop || 0;
    const sourceH = sheet.frameHeight - cropTop;
    if (entry.images) {
      if (entry.loaded && entry.images[f]?.complete && entry.images[f].naturalWidth > 0) {
        const img = entry.images[f];
        ctx.drawImage(img, 0, cropTop, sheet.frameWidth, sourceH, dx, dy, dw, dh);
        drawn = true;
      }
    } else if (entry.loaded && entry.image?.complete) {
      const sourceX = f * sheet.frameWidth;
      const cropTop = sheet.cropTop || 0;
      const rowIndex = Math.max(0, sheet.rowIndex || 0);
      const sourceY = rowIndex * sheet.frameHeight + cropTop;
      const sourceH = sheet.frameHeight - cropTop;
      ctx.drawImage(entry.image, sourceX, sourceY, sheet.frameWidth, sourceH, dx, dy, dw, dh);
      drawn = true;
    }

    if (flipH) ctx.restore();
    return drawn;
  }

  _drawEntryFrame(ctx, entry, frame, dx, dy, dw, dh, flipH = false) {
    if (!entry?.loaded || !entry.image?.complete) return false;
    const sheet = entry.sheet;
    const total = Math.max(1, sheet.frames);
    const f = ((frame % total) + total) % total;
    const cropTop = sheet.cropTop || 0;
    const sourceH = sheet.frameHeight - cropTop;
    if (flipH) {
      ctx.save();
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    }
    const sourceX = f * sheet.frameWidth;
    const rowIndex = Math.max(0, sheet.rowIndex || 0);
    const sourceY = rowIndex * sheet.frameHeight + cropTop;
    ctx.drawImage(entry.image, sourceX, sourceY, sheet.frameWidth, sourceH, dx, dy, dw, dh);
    if (flipH) ctx.restore();
    return true;
  }

  getTrailSpriteDrawData() {
    const preferred = this._getDirectionalSprite("walk", this.facingDirection)
      || this._getDirectionalSprite("walk", "right_down");
    if (!preferred || !preferred.loaded) return null;
    const image = preferred.images ? preferred.images[0] : preferred.image;
    if (!image?.complete) return null;
    return {
      image,
      frameWidth: preferred.sheet.frameWidth,
      frameHeight: preferred.sheet.frameHeight,
      sourceY: (preferred.sheet.rowIndex || 0) * preferred.sheet.frameHeight,
    };
  }

  update(dt, input, world, obstacles = [], walls = [], cursorWorld = null) {
    const axis = input.getAxis();

    // Advance attack animation timeline
    if (this.attackState?.active) {
      if (this.attackState.recoveryActive) {
        this.attackState.recoveryElapsed += dt;
        if (this.attackState.recoveryElapsed >= this.attackState.recoveryDuration) {
          this.attackState.active = false;
          this.attackMoveState.active = false;
          this.attackFacingDirection = null;
        }
      } else {
        this.attackState.stepElapsed += dt;
        const steps = this.attackState.timelineSteps;
        while (this.attackState.stepIndex < steps.length && this.attackState.stepElapsed >= steps[this.attackState.stepIndex].duration) {
          this.attackState.stepElapsed -= steps[this.attackState.stepIndex].duration;
          this.attackState.stepIndex++;
        }
        if (this.attackState.stepIndex >= steps.length) {
          this.attackState.recoveryActive = true;
          this.attackState.recoveryElapsed = 0;
        } else {
          this.attackState.currentFrame = steps[this.attackState.stepIndex].frame;
        }
      }
    }

    if (this.castState?.active) {
      this.castState.elapsed += dt;
      const castStateName = this.castStateName || 'cast';
      const castDirection = this.castFacingDirection || this.facingDirection;
      const castFrames = this._getAnimFrameCount(castStateName, castDirection);
      const castDuration = Math.max(0.0001, this.castState.duration || 0.7);
      const castProgress = Math.max(0, Math.min(0.999999, this.castState.elapsed / castDuration));
      this.castState.currentFrame = Math.min(Math.max(1, castFrames) - 1, Math.floor(castProgress * Math.max(1, castFrames)));
      if (this.castState.elapsed >= castDuration) {
        this.castState.active = false;
        this.castFacingDirection = null;
      }
    }

    if (this.turnState?.active) {
      this.turnState.elapsed += dt;
      const turnDirection = this.turnState.fromDirection || this.facingDirection;
      const turnFrames = this._getAnimFrameCount('turn180', turnDirection);
      const turnDuration = Math.max(0.0001, this.turnState.duration || this.turn180Duration);
      const turnProgress = Math.max(0, Math.min(0.999999, this.turnState.elapsed / turnDuration));
      this.turnState.currentFrame = Math.min(Math.max(1, turnFrames) - 1, Math.floor(turnProgress * Math.max(1, turnFrames)));
      if (this.turnState.elapsed >= turnDuration) {
        this.turnState.active = false;
      }
    }

    // Update attack movement state timer
    if (this.attackMoveState?.active) {
      this.attackMoveState.t += dt;
      // Clamp t to duration (optional safety)
      if (this.attackMoveState.t > this.attackMoveState.duration) {
        this.attackMoveState.t = this.attackMoveState.duration;
      }
    }
    
    // Compute movement with attack slowdown multiplier
    const moveMult = this.getAttackMoveMult();
    const sprintMult = this.isSprinting ? 1.3 : 1.0;
    const castMoveMult = this.getCastMoveMult();
    const turnMoveMult = this.turnState?.active ? this.turn180MoveMult : 1.0;
    const effectiveSpeed = this.speed * moveMult * sprintMult * castMoveMult * turnMoveMult;
    const dx = axis.x * effectiveSpeed * dt;
    const dy = axis.y * effectiveSpeed * dt;

    // Check if player is moving
    const wasMoving = this.isMoving;
    this.isMoving = Math.abs(axis.x) > 0.01 || Math.abs(axis.y) > 0.01;

    // Facing: when moving use movement direction so run animation always plays; when idle use cursor angle if valid
    if (!this.attackState?.active && !this.castState?.active) {
      const moving = Math.abs(axis.x) > 0.01 || Math.abs(axis.y) > 0.01;
      const desiredDirection = moving ? this._pickFacingDirection(axis) : this.facingDirection;
      const previousMoveDirection = this.lastMoveDirection || this.facingDirection;
      const canTurn180 = moving
        && this.isSprinting
        && !this.isCrouching
        && !this.turnState?.active
        && this._getDirectionalSprite('turn180', previousMoveDirection)
        && this._isHardReverseTurn(previousMoveDirection, desiredDirection);
      if (canTurn180) {
        this._beginTurn180(previousMoveDirection, desiredDirection);
      }
      const cx = this.position.x + this.size / 2;
      const cy = this.position.y + this.size / 2;
      const useCursor = cursorWorld && typeof cursorWorld.x === 'number' && typeof cursorWorld.y === 'number';
      const dx = useCursor ? cursorWorld.x - cx : 0;
      const dy = useCursor ? cursorWorld.y - cy : 0;
      const distSq = dx * dx + dy * dy;
      if (!moving && useCursor && distSq > 1) {
        this.facingDirection = this._getDirectionFromAngle(Math.atan2(dy, dx));
      } else {
        this.facingDirection = desiredDirection;
      }
    }
    
    // Reset animation frame when transitioning from walking to idle (optional, both use 8 frames now)
    // Keeping this for smooth transition, but not strictly necessary since both use 8 frames
    if (wasMoving && !this.isMoving) {
      this.animationTimer = 0; // Reset timer for smooth transition
    }
    
    // Update animation
    {
      this.animationTimer += dt;
      if (this.isMoving) {
        const moveState = this.isCrouching && this._getDirectionalSprite('crouchRun', this.facingDirection)
          ? 'crouchRun'
          : (this.isSprinting && this._getDirectionalSprite('run', this.facingDirection) ? 'run' : 'walk');
        const moveFrames = this._getLoopFrameCount(moveState, this.facingDirection);
        while (this.animationTimer >= this.walkingAnimationSpeed) {
          this.animationTimer -= this.walkingAnimationSpeed;
          this.animationFrame = (this.animationFrame + 1) % moveFrames;
        }
      } else {
        const idleState = this.isCrouching && this._getDirectionalSprite('crouchIdle', this.facingDirection) ? 'crouchIdle' : 'idle';
        const idleFrames = this._getLoopFrameCount(idleState, this.facingDirection);
        while (this.animationTimer >= this.idleAnimationSpeed) {
          this.animationTimer -= this.idleAnimationSpeed;
          this.animationFrame = (this.animationFrame + 1) % idleFrames;
        }
      }
    }

    let nx = this.position.x + dx;
    let ny = this.position.y + dy;

    const wallMargin = world.wallCollisionThickness ?? world.wallThickness;
    nx = Math.max(wallMargin, Math.min(nx, world.width - wallMargin - this.size));
    ny = Math.max(wallMargin, Math.min(ny, world.height - wallMargin - this.size));

    // Obstacle collision rect: 30x30 centered in the player (walls are not checked – player can pass through walls)
    const OBSTACLE_RECT_SIZE = 30;
    const pw = OBSTACLE_RECT_SIZE;
    const ph = OBSTACLE_RECT_SIZE;
    const pxo = Math.max(0, (this.size - pw) / 2);
    const pyo = Math.max(0, (this.size - ph) / 2);
    const testX = { x: nx + pxo, y: this.position.y + pyo, w: pw, h: ph };
    const testY = { x: this.position.x + pxo, y: ny + pyo, w: pw, h: ph };

    let canMoveX = true;
    let canMoveY = true;

    for (const obstacle of obstacles) {
      if (obstacle.destroyed || !obstacle.blocksMovement) continue;
      if (obstacleIntersectsRect(obstacle, testX)) canMoveX = false;
      if (obstacleIntersectsRect(obstacle, testY)) canMoveY = false;
    }

    if (!canMoveX && !canMoveY) {
      nx = this.position.x;
      ny = this.position.y;
    } else if (!canMoveX) {
      nx = this.position.x;
    } else if (!canMoveY) {
      ny = this.position.y;
    }

    this.position.set(nx, ny);
    if (this.isMoving) {
      this.lastMoveDirection = this.facingDirection;
    }
  }

  draw(ctx, camera, isDashing = false, isDead = false, isSliding = false) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const dx = Math.floor(sx + (this.size - this.drawWidth) / 2);
    const dy = Math.floor(sy + (this.size - this.drawHeight) / 2);
    const flipH = this._shouldFlipDirection(this.facingDirection);

    ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
    let drawn = false;

    if (isDead) {
      const deadEntry = this._getDirectionalSprite("dead", "down");
      if (deadEntry?.loaded && deadEntry.images?.length) {
        const total = deadEntry.sheet.frames;
        const lastFrame = Math.min(7, total - 1);
        drawn = this._drawDirectionalFrame(ctx, "dead", "down", lastFrame, dx, dy, this.drawWidth, this.drawHeight, false);
      }
    }
    if (!drawn && this.characterId === 'reaper') {
      const t = this._reaperGameTime ?? 0;
      if (this.reaperRevealAnimationUntil != null && t < this.reaperRevealAnimationUntil && this.reaperRevealSheet?.loaded) {
        const start = this.reaperRevealAnimationStart ?? t;
        const duration = (this.reaperRevealAnimationUntil - start) || 0.6;
        const frames = this.reaperRevealSheet.sheet?.frames ?? 8;
        const frame = Math.min(Math.max(0, Math.floor((t - start) / (duration / Math.max(1, frames)))), (frames || 8) - 1);
        drawn = this._drawEntryFrame(ctx, this.reaperRevealSheet, frame, dx, dy, this.drawWidth, this.drawHeight, flipH);
      }
      if (!drawn && this.reaperHolsterAnimationUntil != null && t < this.reaperHolsterAnimationUntil && this.reaperHolsterSheet?.loaded) {
        const start = this.reaperHolsterAnimationStart ?? t;
        const duration = (this.reaperHolsterAnimationUntil - start) || 0.5;
        const frames = this.reaperHolsterSheet.sheet?.frames ?? 8;
        const frame = Math.min(Math.max(0, Math.floor((t - start) / (duration / Math.max(1, frames)))), (frames || 8) - 1);
        drawn = this._drawEntryFrame(ctx, this.reaperHolsterSheet, frame, dx, dy, this.drawWidth, this.drawHeight, flipH);
      }
      if (!drawn && this.reaperHostileMode) {
        if (this.attackState?.active && this.reaperHostileAttack?.loaded) {
          const attackFlipH = this._shouldFlipDirection(this.attackFacingDirection ?? this.facingDirection);
          const maxFrame = (this.reaperHostileAttack.sheet?.frames ?? 8) - 1;
          const frame = Math.min(Math.max(0, this.attackState.currentFrame ?? 0), maxFrame);
          drawn = this._drawEntryFrame(ctx, this.reaperHostileAttack, frame, dx, dy, this.drawWidth, this.drawHeight, attackFlipH);
        }
        if (!drawn && this.isMoving && this.reaperHostileWalk?.loaded) {
          const walkFrames = Math.max(1, this.reaperHostileWalk.sheet?.frames ?? 8);
          const walkFrame = Math.floor(this.animationFrame) % walkFrames;
          drawn = this._drawEntryFrame(ctx, this.reaperHostileWalk, walkFrame, dx, dy, this.drawWidth, this.drawHeight, flipH);
        }
        if (!drawn && this.reaperHostileIdle?.loaded) {
          const idleFrames = Math.max(1, this.reaperHostileIdle.sheet?.frames ?? 5);
          const idleFrame = Math.floor(this.animationFrame) % idleFrames;
          drawn = this._drawEntryFrame(ctx, this.reaperHostileIdle, idleFrame, dx, dy, this.drawWidth, this.drawHeight, flipH);
        }
      }
    }
    if (!drawn && this.knightSlideEndFrameUntil != null && this.knightSlideEnd != null) {
      const now = typeof performance !== 'undefined' && performance.now ? performance.now() / 1000 : 0;
      if (now < this.knightSlideEndFrameUntil) {
        drawn = this._drawEntryFrame(ctx, this.knightSlideEnd, 0, dx, dy, this.drawWidth, this.drawHeight, flipH);
      } else {
        this.knightSlideEndFrameUntil = null;
      }
    }
    if (!drawn && isSliding && this.knightSlideIntro != null && this.knightSlideHold != null) {
      const duration = this.knightSlideDuration ?? 0.35;
      const timer = this.knightSlideTimer ?? 0;
      const elapsed = duration - timer;
      const INTRO_DURATION = 0.1;
      if (elapsed < INTRO_DURATION) {
        const frame = Math.min(1, Math.floor(elapsed / (INTRO_DURATION / 2)));
        drawn = this._drawEntryFrame(ctx, this.knightSlideIntro, frame, dx, dy, this.drawWidth, this.drawHeight, flipH);
      } else {
        drawn = this._drawEntryFrame(ctx, this.knightSlideHold, 0, dx, dy, this.drawWidth, this.drawHeight, flipH);
      }
    }
    if (!drawn && isSliding && this.spriteSets.slide && this._getDirectionalSprite("slide", this.facingDirection)) {
      const slideFrames = this._getAnimFrameCount("slide", this.facingDirection);
      const slideFrame = Math.floor(this.dashAnimationTimer / this.dashAnimationSpeed) % Math.max(1, slideFrames);
      drawn = this._drawDirectionalFrame(ctx, "slide", this.facingDirection, slideFrame, dx, dy, this.drawWidth, this.drawHeight, flipH);
    }
    if (!drawn && isDashing) {
      const dashFrames = this._getLoopFrameCount("dash", this.facingDirection);
      const dashDuration = Math.max(0.0001, this.dashAnimationDuration || 0.2);
      const dashProgress = Math.max(0, Math.min(0.999999, this.dashAnimationTimer / dashDuration));
      const dashFrame = Math.min(Math.max(1, dashFrames) - 1, Math.floor(dashProgress * Math.max(1, dashFrames)));
      drawn = this._drawDirectionalFrame(ctx, "dash", this.facingDirection, dashFrame, dx, dy, this.drawWidth, this.drawHeight, flipH);
    }
    if (!drawn && this.castState?.active) {
      const castDirection = this.castFacingDirection || this.facingDirection;
      const castFlipH = this._shouldFlipDirection(castDirection);
      const castStateName = this.castStateName || "cast";
      const castFrame = Math.max(0, this.castState.currentFrame ?? 0);
      drawn = this._drawDirectionalFrame(ctx, castStateName, castDirection, castFrame, dx, dy, this.drawWidth, this.drawHeight, castFlipH)
        || this._drawDirectionalFrame(ctx, "cast", castDirection, castFrame, dx, dy, this.drawWidth, this.drawHeight, castFlipH);
    }
    if (!drawn && this.turnState?.active && !this.attackState?.active && !this.castState?.active) {
      const turnDirection = this.turnState.fromDirection || this.facingDirection;
      const turnFlipH = this._shouldFlipDirection(turnDirection);
      const turnFrame = Math.max(0, this.turnState.currentFrame ?? 0);
      drawn = this._drawDirectionalFrame(ctx, "turn180", turnDirection, turnFrame, dx, dy, this.drawWidth, this.drawHeight, turnFlipH);
    }
    if (!drawn && this.attackState?.active) {
      const attackDir = this.attackFacingDirection ?? this.facingDirection;
      const attackFlipH = this._shouldFlipDirection(attackDir);
      if (this.characterId === 'knight' && this.knightAttackSheets?.length >= 2) {
        const sheetIndex = this.knightAttackSheetIndex ?? 0;
        const entry = this.knightAttackSheets[sheetIndex];
        const maxFrame = Math.max(0, (entry?.sheet?.frames ?? 1) - 1);
        const frame = Math.min(Math.max(0, this.attackState.currentFrame ?? 0), maxFrame);
        drawn = this._drawEntryFrame(ctx, entry, frame, dx, dy, this.drawWidth, this.drawHeight, attackFlipH);
      } else {
        const attackStateName = this.attackStateName || "attack";
        const entry = this._getDirectionalSprite(attackStateName, attackDir) || this._getDirectionalSprite("attack", attackDir);
        const maxFrame = entry?.sheet?.frames != null ? Math.max(0, entry.sheet.frames - 1) : 12;
        const frame = Math.min(Math.max(0, this.attackState.currentFrame), maxFrame);
        drawn = this._drawDirectionalFrame(ctx, attackStateName, attackDir, frame, dx, dy, this.drawWidth, this.drawHeight, attackFlipH)
          || this._drawDirectionalFrame(ctx, "attack", attackDir, frame, dx, dy, this.drawWidth, this.drawHeight, attackFlipH);
      }
    }
    if (!drawn && this.isMoving) {
      let moveState = 'walk';
      if (this.isCrouching && this._getDirectionalSprite('crouchRun', this.facingDirection)) {
        moveState = 'crouchRun';
      } else if (this.isSprinting && this._getDirectionalSprite('run', this.facingDirection)) {
        moveState = 'run';
      }
      const walkDirs = [this.facingDirection, 'down', 'up', 'right_down', 'left', 'right', 'right_up', 'left_up', 'left_down'];
      for (const dir of walkDirs) {
        if (this._getDirectionalSprite(moveState, dir)) {
          drawn = this._drawDirectionalFrame(ctx, moveState, dir, this.animationFrame, dx, dy, this.drawWidth, this.drawHeight, flipH);
          if (drawn) break;
        }
      }
    }
    if (!drawn) {
      const idleState = this.isCrouching && this._getDirectionalSprite('crouchIdle', this.facingDirection) ? 'crouchIdle' : 'idle';
      drawn = this._drawDirectionalFrame(ctx, idleState, this.facingDirection, this.animationFrame, dx, dy, this.drawWidth, this.drawHeight, flipH);
    }
    if (!drawn) {
      // Fallback to colored rectangle while sprites load
      ctx.fillStyle = this.color;
      ctx.fillRect(dx, dy, this.drawWidth, this.drawHeight);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(dx, dy, this.drawWidth, this.drawHeight);
    }

    ctx.imageSmoothingEnabled = true; // Restore for other elements
  }
}
