import { Vec2, clamp } from './utils.js';
import { getWallCollisionRect, obstacleIntersectsRect } from './utils.js';
import { PLAYER_WALL_COLLISION_INSET } from './data/constants.js';

export class Player {
  constructor(x, y) {
    this.position = new Vec2(x, y);
    this.size = 100;
    this.speed = 220;
    this.color = "#ffff4d";
    
    // Animation properties
    this.animationFrame = 0; // Current frame (0-3 for 2x2 grid)
    this.animationTimer = 0;
    this.walkingAnimationSpeed = 1 / 16; // 16 frames per second = 0.0625 seconds per frame
    this.idleAnimationSpeed = 1 / 4; // 4 frames per second = 0.25 seconds per frame
    this.dashAnimationSpeed = 1 / 24; // 24 fps while dashing
    this.dashAnimationTimer = 0;
    this.isMoving = false; // Track movement state
    this.facingDirection = "down"; // down/up/left_down/left_up/right_down/right_up
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
      windUpMult: 0.60,
      hitMult: 0.40,
      recoveryMult: 0.80,
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
    
    this.spriteSets = {
      idle: {
        down: this._createDirectionalSheet('assets/images/player/Idle_Down.png', 'idle down'),
        up: this._createDirectionalSheet('assets/images/player/Idle_Up.png', 'idle up'),
        left_down: this._createDirectionalSheet('assets/images/player/Idle_Left_Down.png', 'idle left down'),
        left_up: this._createDirectionalSheet('assets/images/player/Idle_Left_Up.png', 'idle left up'),
        right_down: this._createDirectionalSheet('assets/images/player/Idle_Right_Down.png', 'idle right down'),
        right_up: this._createDirectionalSheet('assets/images/player/Idle_Right_Up.png', 'idle right up'),
      },
      walk: {
        down: this._createDirectionalSheet('assets/images/player/walk_Down.png', 'walk down'),
        up: this._createDirectionalSheet('assets/images/player/walk_Up.png', 'walk up'),
        left_down: this._createDirectionalSheet('assets/images/player/walk_Left_Down.png', 'walk left down'),
        left_up: this._createDirectionalSheet('assets/images/player/walk_Left_Up.png', 'walk left up'),
        right_down: this._createDirectionalSheet('assets/images/player/walk_Right_Down.png', 'walk right down'),
        right_up: this._createDirectionalSheet('assets/images/player/walk_Right_Up.png', 'walk right up'),
      },
      dash: {
        down: this._createDirectionalSheet('assets/images/player/Dash_Dust_Down.png', 'dash down'),
        up: this._createDirectionalSheet('assets/images/player/Dash_Dust_Up.png', 'dash up'),
        left_down: this._createDirectionalSheet('assets/images/player/Dash_Dust_left_Down.png', 'dash left down'),
        left_up: this._createDirectionalSheet('assets/images/player/Dash_Dust_left_Up.png', 'dash left up'),
        right_down: this._createDirectionalSheet('assets/images/player/Dash_Dust_right_Down.png', 'dash right down'),
        right_up: this._createDirectionalSheet('assets/images/player/Dash_Dust_right_Up.png', 'dash right up'),
      },
    };

    // Compatibility fields used by trail rendering in game.js.
    this.walkingSprite = this.spriteSets.walk.right_down.image;
    this.walkingSpriteLoaded = false;
    this.walkingSpriteSheet = this.spriteSets.walk.right_down.sheet;
    
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
   * Builds attack animation timeline based on available duration.
   * Uses LOD (Level of Detail) sequences for different time budgets.
   * @param {number} duration - Available attack duration in seconds
   * @returns {Array} Array of {frame, duration} steps
   */
  buildAttackTimeline(duration) {
    const steps = [];
    let remainingDuration = duration;
    
    // Calculate recovery hold (subtract from available time)
    const recoveryHold = Math.max(
      this.RECOVERY_HOLD_MIN,
      Math.min(this.RECOVERY_HOLD_MAX, duration * this.RECOVERY_HOLD_RATIO)
    );
    remainingDuration -= recoveryHold;
    remainingDuration = Math.max(0, remainingDuration);
    
    // Weight function: frame 5 (peak) = 2.2x, frame 0 (anticipation) = 1.3x, others = 1.0x
    const getFrameWeight = (frame) => {
      if (frame === 5) return 2.2;
      if (frame === 0) return 1.3;
      return 1.0;
    };
    
    // LOD: Full sequence (duration >= 0.55s)
    // Frames: [0,1,2,3,4,5,5,6,7] - one-way with peak hold on frame 5
    // Using 3x3 grid: frames 0-8 (0=top-left, 5=row 2 col 3 = peak/impact)
    if (duration >= this.LOD_FULL_THRESHOLD) {
      const frames = [0, 1, 2, 3, 4, 5, 5, 6, 7];
      
      // Calculate total weight
      let totalWeight = 0;
      for (const frame of frames) {
        totalWeight += getFrameWeight(frame);
      }
      
      // Allocate duration based on weights
      for (const frame of frames) {
        const weight = getFrameWeight(frame);
        const frameDuration = (remainingDuration * weight) / totalWeight;
        steps.push({
          frame: frame,
          duration: frameDuration
        });
      }
    }
    // LOD: Medium sequence (0.40s <= duration < 0.55s)
    // Frames: [0,2,4,5,6,7] - skip some transitions but keep correct peak
    else if (duration >= this.LOD_MEDIUM_THRESHOLD) {
      const frames = [0, 2, 4, 5, 6, 7];
      
      // Calculate total weight
      let totalWeight = 0;
      for (const frame of frames) {
        totalWeight += getFrameWeight(frame);
      }
      
      // Allocate duration based on weights
      for (const frame of frames) {
        const weight = getFrameWeight(frame);
        const frameDuration = (remainingDuration * weight) / totalWeight;
        steps.push({
          frame: frame,
          duration: frameDuration
        });
      }
    }
    // LOD: Short sequence (duration < 0.40s)
    // Minimal readable snap: [0,4,5]
    else {
      const frames = [0, 4, 5];
      
      // Calculate total weight
      let totalWeight = 0;
      for (const frame of frames) {
        totalWeight += getFrameWeight(frame);
      }
      
      // Allocate duration based on weights
      for (const frame of frames) {
        const weight = getFrameWeight(frame);
        const frameDuration = (remainingDuration * weight) / totalWeight;
        steps.push({
          frame: frame,
          duration: frameDuration
        });
      }
    }
    
    return { steps, recoveryHold };
  }
  
  /**
   * Triggers attack animation with variable duration support.
   * @param {number} attackDurationSeconds - Available attack duration (default: 0.6)
   */
  triggerAttackAnimation(attackDurationSeconds = 0.6) {
    const { steps, recoveryHold } = this.buildAttackTimeline(attackDurationSeconds);
    
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
   * @returns {number} Movement multiplier (1.0 = normal speed)
   */
  getAttackMoveMult() {
    if (!this.attackMoveState?.active) {
      return 1.0;
    }
    
    const state = this.attackMoveState;
    const profile = this.attackMoveProfile;
    
    if (state.t < state.windUpEnd) {
      return profile.windUpMult;
    } else if (state.t < state.hitEnd) {
      return profile.hitMult;
    } else {
      return profile.recoveryMult;
    }
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
      frameWidth: 48,
      frameHeight: 64,
      columns: 8,
      rows: 1,
      frames: 8
    };
    const state = { image, loaded: false, sheet };
    image.onload = () => {
      state.loaded = true;
      // Fixed atlas contract for new player sheets: 8 frames, each 48x64 in one row.
      sheet.frameWidth = 48;
      sheet.frameHeight = 64;
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
    // Horizontal-only input should always use down-facing diagonals.
    if (axis.x < 0) return "left_down";
    return "right_down";
  }

  setFacingFromVector(dx, dy) {
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
    this.facingDirection = this._pickFacingDirection({ x: dx, y: dy });
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

  _drawDirectionalFrame(ctx, stateName, direction, frame, dx, dy, dw, dh) {
    const entry = this._getDirectionalSprite(stateName, direction);
    if (!entry || !entry.loaded || !entry.image.complete) return false;
    const sheet = entry.sheet;
    const total = Math.max(1, sheet.frames);
    const f = ((frame % total) + total) % total;
    const sourceX = f * sheet.frameWidth;
    const sourceY = 0;
    ctx.drawImage(entry.image, sourceX, sourceY, sheet.frameWidth, sheet.frameHeight, dx, dy, dw, dh);
    return true;
  }

  getTrailSpriteDrawData() {
    const preferred = this._getDirectionalSprite("walk", this.facingDirection)
      || this._getDirectionalSprite("walk", "right_down");
    if (!preferred || !preferred.loaded || !preferred.image.complete) return null;
    return {
      image: preferred.image,
      frameWidth: preferred.sheet.frameWidth,
      frameHeight: preferred.sheet.frameHeight,
    };
  }

  update(dt, input, world, obstacles = [], walls = []) {
    const axis = input.getAxis();
    
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
    
    this.facingDirection = this._pickFacingDirection(axis);
    
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

    // Use a slightly smaller collision box vs walls/obstacles so the character can get closer (sprite doesn't fill full size)
    const pi = PLAYER_WALL_COLLISION_INSET;
    const pBase = Math.max(1, this.size - 2 * pi);
    const pw = Math.max(1, pBase * 0.25);
    const ph = Math.max(1, pBase * 0.5);
    const pxo = pi + (pBase - pw) / 2;
    const pyo = pi + (pBase - ph) / 2;
    const testX = { x: nx + pxo, y: this.position.y + pyo, w: pw, h: ph };
    const testY = { x: this.position.x + pxo, y: ny + pyo, w: pw, h: ph };
    
    let canMoveX = true;
    let canMoveY = true;
    
    // Check obstacles
    for (const obstacle of obstacles) {
      if (obstacle.destroyed || !obstacle.blocksMovement) continue;
      // Check if X-only movement would collide
      if (obstacleIntersectsRect(obstacle, testX)) {
        canMoveX = false;
      }
      
      // Check if Y-only movement would collide
      if (obstacleIntersectsRect(obstacle, testY)) {
        canMoveY = false;
      }
    }
    
    // Check walls (e.g. procedural tile walls)
    for (const wall of walls) {
      const wallRect = getWallCollisionRect(wall);
      
      // Check if X-only movement would collide
      if (testX.x < wallRect.x + wallRect.w && testX.x + testX.w > wallRect.x &&
          testX.y < wallRect.y + wallRect.h && testX.y + testX.h > wallRect.y) {
        canMoveX = false;
      }
      
      // Check if Y-only movement would collide
      if (testY.x < wallRect.x + wallRect.w && testY.x + testY.w > wallRect.x &&
          testY.y < wallRect.y + wallRect.h && testY.y + testY.h > wallRect.y) {
        canMoveY = false;
      }
    }
    
    // If both axes would collide, block movement completely
    if (!canMoveX && !canMoveY) {
      nx = this.position.x;
      ny = this.position.y;
    } else if (!canMoveX) {
      // Block X movement, allow Y
      nx = this.position.x;
    } else if (!canMoveY) {
      // Block Y movement, allow X
      ny = this.position.y;
    }
    // If both can move, allow the diagonal movement (already set to nx, ny)

    this.position.set(nx, ny);
  }

  draw(ctx, camera, isDashing = false) {
    const sx = Math.floor(this.position.x - camera.position.x);
    const sy = Math.floor(this.position.y - camera.position.y);

    ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
    let drawn = false;
    if (isDashing) {
      const dashFrames = this._getAnimFrameCount("dash", this.facingDirection);
      const dashFrame = Math.floor(this.dashAnimationTimer / this.dashAnimationSpeed) % Math.max(1, dashFrames);
      drawn = this._drawDirectionalFrame(ctx, "dash", this.facingDirection, dashFrame, sx, sy, this.size, this.size);
    }
    if (!drawn && this.isMoving) {
      drawn = this._drawDirectionalFrame(ctx, "walk", this.facingDirection, this.animationFrame, sx, sy, this.size, this.size);
    }
    if (!drawn) {
      drawn = this._drawDirectionalFrame(ctx, "idle", this.facingDirection, this.animationFrame, sx, sy, this.size, this.size);
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
