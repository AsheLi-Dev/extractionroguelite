import { Vec2, clamp } from './utils.js';
import { obstacleIntersectsRect } from './utils.js';

export class Player {
  constructor(x, y) {
    this.position = new Vec2(x, y);
    this.size = 120;
    this.speed = 44; // 20% of original 220
    this.color = "#ffff4d";
    
    // Animation properties
    this.animationFrame = 0; // Current frame (0-3 for 2x2 grid)
    this.animationTimer = 0;
    this.walkingAnimationSpeed = 1 / 16; // 16 frames per second = 0.0625 seconds per frame
    this.idleAnimationSpeed = 1 / 4; // 4 frames per second = 0.25 seconds per frame
    this.dashAnimationSpeed = 1 / 24; // 24 fps while dashing
    this.dashAnimationTimer = 0;
    this.isMoving = false; // Track movement state
    this.facingDirection = "down"; // down/up/left/right/left_down/left_up/right_down/right_up
    this.lastVerticalPreference = "down"; // used when moving horizontally only
    
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
    this.COMBO_RESET_SEC = 1.4; // Must be longer than attack cooldown so next attack within cooldown counts as combo
    
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
    const idleDown = this._loadIdleFromSpriteSheet(idleBase, 'idle_down.png', 160, 128, 9);
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
      dash: {
        down: this._createDirectionalSheet('assets/images/player/Dash_Dust_Down.png', 'dash down'),
        up: this._createDirectionalSheet('assets/images/player/Dash_Dust_Up.png', 'dash up'),
        left: this._createDirectionalSheet('assets/images/player/Dash_Dust_left_Down.png', 'dash left'),
        right: this._createDirectionalSheet('assets/images/player/Dash_Dust_right_Down.png', 'dash right'),
        left_down: this._createDirectionalSheet('assets/images/player/Dash_Dust_left_Down.png', 'dash left down'),
        left_up: this._createDirectionalSheet('assets/images/player/Dash_Dust_left_Up.png', 'dash left up'),
        right_down: this._createDirectionalSheet('assets/images/player/Dash_Dust_right_Down.png', 'dash right down'),
        right_up: this._createDirectionalSheet('assets/images/player/Dash_Dust_right_Up.png', 'dash right up'),
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
  buildAttackTimeline(duration, sequenceType = 'main') {
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

    const { steps, recoveryHold } = this.buildAttackTimeline(attackDurationSeconds, sequenceType);

    this.attackFacingDirection = this.facingDirection;
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
    const state = this.attackMoveState;
    const d = state.duration;
    const t = state.t;
    const q1 = 0.20 * d;
    const q2 = 0.55 * d;
    const midMult = 0.7;
    if (t <= q1) return 1 - (1 - midMult) * (t / q1);
    if (t < q2) return midMult;
    return midMult + (1 - midMult) * (t - q2) / (d - q2);
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

  setFacingFromVector(dx, dy) {
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
    this.facingDirection = this._getDirectionFromAngle(Math.atan2(dy, dx));
  }

  beginDashAnimation(dx = 0, dy = 0) {
    this.dashAnimationTimer = 0;
    this.setFacingFromVector(dx, dy);
  }

  tickDashAnimation(dt) {
    this.dashAnimationTimer += dt;
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

  _drawDirectionalFrame(ctx, stateName, direction, frame, dx, dy, dw, dh, flipH = false) {
    const entry = this._getDirectionalSprite(stateName, direction);
    if (!entry) return false;
    const sheet = entry.sheet;
    const total = Math.max(1, sheet.frames);
    const f = ((frame % total) + total) % total;

    if (flipH) {
      ctx.save();
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    }

    let drawn = false;
    if (entry.images) {
      if (entry.loaded && entry.images[f]?.complete) {
        const img = entry.images[f];
        ctx.drawImage(img, 0, 0, sheet.frameWidth, sheet.frameHeight, dx, dy, dw, dh);
        drawn = true;
      }
    } else if (entry.loaded && entry.image?.complete) {
      const sourceX = f * sheet.frameWidth;
      const sourceY = 0;
      ctx.drawImage(entry.image, sourceX, sourceY, sheet.frameWidth, sheet.frameHeight, dx, dy, dw, dh);
      drawn = true;
    }

    if (flipH) ctx.restore();
    return drawn;
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
    const effectiveSpeed = this.speed * moveMult;
    const dx = axis.x * effectiveSpeed * dt;
    const dy = axis.y * effectiveSpeed * dt;

    // Check if player is moving
    const wasMoving = this.isMoving;
    this.isMoving = Math.abs(axis.x) > 0.01 || Math.abs(axis.y) > 0.01;

    // Facing: cursor angle when valid, else movement
    if (!this.attackState?.active) {
      const cx = this.position.x + this.size / 2;
      const cy = this.position.y + this.size / 2;
      const useCursor = cursorWorld && typeof cursorWorld.x === 'number' && typeof cursorWorld.y === 'number';
      const dx = useCursor ? cursorWorld.x - cx : 0;
      const dy = useCursor ? cursorWorld.y - cy : 0;
      const distSq = dx * dx + dy * dy;
      if (useCursor && distSq > 1) {
        this.facingDirection = this._getDirectionFromAngle(Math.atan2(dy, dx));
      } else {
        this.facingDirection = this._pickFacingDirection(axis);
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
        const walkFrames = this._getAnimFrameCount("walk", this.facingDirection);
        if (this.animationTimer >= this.walkingAnimationSpeed) {
          this.animationTimer = 0;
          this.animationFrame = (this.animationFrame + 1) % walkFrames;
        }
      } else {
        const idleFrames = this._getAnimFrameCount("idle", this.facingDirection);
        if (this.animationTimer >= this.idleAnimationSpeed) {
          this.animationTimer = 0;
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
  }

  draw(ctx, camera, isDashing = false, isDead = false) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);
    const flipH = this.facingDirection === 'left_down' || this.facingDirection === 'left_up' || this.facingDirection === 'left';

    ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
    let drawn = false;

    if (isDead) {
      const deadEntry = this._getDirectionalSprite("dead", "down");
      if (deadEntry?.loaded && deadEntry.images?.length) {
        const total = deadEntry.sheet.frames;
        const lastFrame = Math.min(7, total - 1);
        drawn = this._drawDirectionalFrame(ctx, "dead", "down", lastFrame, sx, sy, this.size, this.size, false);
      }
    }
    if (!drawn && this.attackState?.active) {
      const attackDir = this.attackFacingDirection ?? this.facingDirection;
      const entry = this._getDirectionalSprite("attack", attackDir);
      const maxFrame = entry?.sheet?.frames != null ? Math.max(0, entry.sheet.frames - 1) : 12;
      const frame = Math.min(Math.max(0, this.attackState.currentFrame), maxFrame);
      const attackFlipH = attackDir === 'left_down' || attackDir === 'left_up' || attackDir === 'left';
      drawn = this._drawDirectionalFrame(ctx, "attack", attackDir, frame, sx, sy, this.size, this.size, attackFlipH);
    }
    if (!drawn && isDashing) {
      const dashFrames = this._getAnimFrameCount("dash", this.facingDirection);
      const dashFrame = Math.floor(this.dashAnimationTimer / this.dashAnimationSpeed) % Math.max(1, dashFrames);
      drawn = this._drawDirectionalFrame(ctx, "dash", this.facingDirection, dashFrame, sx, sy, this.size, this.size, flipH);
    }
    if (!drawn && this.isMoving) {
      drawn = this._drawDirectionalFrame(ctx, "walk", this.facingDirection, this.animationFrame, sx, sy, this.size, this.size, flipH);
    }
    if (!drawn) {
      drawn = this._drawDirectionalFrame(ctx, "idle", this.facingDirection, this.animationFrame, sx, sy, this.size, this.size, flipH);
    }
    if (!drawn) {
      // Fallback to colored rectangle while sprites load
      ctx.fillStyle = this.color;
      ctx.fillRect(sx, sy, this.size, this.size);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, this.size, this.size);
    }

    ctx.imageSmoothingEnabled = true; // Restore for other elements
  }
}
