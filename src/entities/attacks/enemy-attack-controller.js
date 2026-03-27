/**
 * EnemyAttackController - runs telegraph  execute  recover loop per enemy.
 * State: idle | windup | active | recover
 *
 * Projectile attacks: `_execute` (spawn) runs once during windup when elapsed reaches
 * `execute.projectileSpawnWindupT` of the telegraph (0 = start, 1 = end). Default 0.5 (middle).
 */

import { getWallCollisionRect, getObstacleCollisionRect, obstacleIntersectsRect } from '../../utils.js';
import {
  drawCircleTelegraph,
  drawRingTelegraph,
  drawConeTelegraph,
  drawLineTelegraph,
  getTelegraphColor
} from './telegraph-renderer.js';
import { ENEMY_ATTACK_KITS } from './enemy-attack-kits.js';
import { ENEMY_TYPES } from '../enemy.js';
import { getAnimatedSpritePreset } from '../../vfx/animated-sprite-presets.js';

function getConeAttackImpactAnimatedSprite(attackId, range) {
  const drawWidth = Math.max(72, Number(range) || 120);
  const drawHeight = Math.max(64, drawWidth * 0.7);
  if (attackId === 'death_knight_cleave') {
    return getAnimatedSpritePreset('darkSlash', {
      drawWidth,
      drawHeight,
      baseAngleRad: Math.PI / 2
    });
  }
  if (attackId === 'death_bringer_cleave') {
    return getAnimatedSpritePreset('doubleStrike', {
      drawWidth,
      drawHeight
    });
  }
  if (attackId === 'orc_cleave' || attackId === 'rock_giant_cone') {
    return getAnimatedSpritePreset('downwardSlash', {
      drawWidth,
      drawHeight
    });
  }
  if (attackId === 'troll_cleave') {
    return {
      path: 'assets/Projectiles/Upward Slash.png',
      frameWidth: 128,
      frameHeight: 128,
      frameCount: 9,
      columns: 9,
      fps: 16,
      loop: false,
      rotateWithVelocity: true,
      baseAngleRad: 0,
      anchorX: 0.5,
      anchorY: 0.5,
      drawWidth: Math.max(120, drawWidth),
      drawHeight: Math.max(96, drawHeight)
    };
  }
  if (attackId === 'human_warrior_slash') {
    return getAnimatedSpritePreset('doubleStrike', {
      drawWidth: Math.max(64, drawWidth * 0.8),
      drawHeight: Math.max(56, drawHeight * 0.8)
    });
  }
  if (attackId === 'skeleton_warrior_slash') {
    return getAnimatedSpritePreset('downwardSlash', {
      drawWidth,
      drawHeight
    });
  }
  if (attackId === 'death_lord_cleave') {
    return getAnimatedSpritePreset('downwardSlash', {
      drawWidth,
      drawHeight
    });
  }
  if (attackId === 'banshee_wail_slash') {
    return getAnimatedSpritePreset('downwardSlash', {
      drawWidth,
      drawHeight
    });
  }
  if (attackId === 'ud_warrior_kick') {
    return getAnimatedSpritePreset('downwardSlash', {
      drawWidth: Math.max(48, drawWidth * 0.55),
      drawHeight: Math.max(40, drawHeight * 0.5)
    });
  }
  if (attackId === 'ud_archer_kick') {
    return getAnimatedSpritePreset('downwardSlash', {
      drawWidth: Math.max(48, drawWidth * 0.55),
      drawHeight: Math.max(40, drawHeight * 0.5)
    });
  }
  if (attackId === 'ud_necromancer_dark_wave') {
    return getAnimatedSpritePreset('darkSlash', {
      drawWidth: Math.max(88, drawWidth * 0.95),
      drawHeight: Math.max(72, drawHeight * 0.85),
      baseAngleRad: Math.PI / 2
    });
  }
  return null;
}

function getCircleAttackImpactAnimatedSprite(attackId, radius) {
  const drawSize = Math.max(56, (Number(radius) || 70) * 1.8);
  if (attackId === 'death_bringer_ground_spell' || attackId === 'lich_death_circle') {
    return getAnimatedSpritePreset('smokeBurstRing', {
      drawWidth: drawSize,
      drawHeight: drawSize
    });
  }
  if (attackId === 'giant_spider_web_trap') {
    return getAnimatedSpritePreset('smokeBurstGround', {
      drawWidth: Math.max(72, drawSize),
      drawHeight: Math.max(40, drawSize * 0.6)
    });
  }
  return getAnimatedSpritePreset('smokeBurstSoft', {
    drawWidth: drawSize,
    drawHeight: drawSize
  });
}

export class EnemyAttackController {
  constructor(enemy) {
    this.enemy = enemy;
    this.state = "idle";
    this.currentAttack = null;
    /** Set during recover after active; cleared when returning to idle (sprite FSM may still need attack id). */
    this.recoveringAttackId = null;
    this.timer = 0;
    this.cooldowns = {}; // attackId -> remaining cooldown
    this.targetSnapshot = null; // { x, y } during windup
    this.dashTraveled = 0;
    this.dashTotalDist = 0;
    this.dashDir = null;
    this.dashHitApplied = false;
    this.rageUntil = null;
    this.phaseUntil = null; // invuln/phase
    this.regenChannelUntil = null;
    this.regenBreakDamage = 0;
    this.orbitingOrbsUntil = null;
    this.orbitingOrbAngle = 0;
    /** Multi-shot attacks (execute.comboShots): strict counts so we never chain an extra windup. */
    this._comboShotTotal = 1;
    this._comboShotsCompleted = 0;
    /** Increments each windup start (idle→windup or combo chain); for sprite sync on sheet enemies. */
    this._attackWindupCycle = 0;
    this.attackUses = {}; // attackId -> times executed (for maxUses-limited attacks)
    this.attackScale = enemy.attackScale ?? 1;
    this.enableHiddenAttacks = enemy.enableHiddenAttacks ?? false;
    this._activeDurationOverride = null;
    /** Pending animation-driven hitbox spawn (kind-limited). */
    this._pendingAnimationHitbox = null; // { hitboxTrigger, fired, lastFrameIndex, kind, payload }
    /** For kind "projectile" windup: total telegraph duration and whether _execute already ran (spawn at mid-windup by default). */
    this._projectileWindupTotal = 0;
    this._projectileWindupExecuteDone = false;
    this._sameStripConeCombo = null;
    /** Total windup duration for current windup phase (seconds). */
    this._windupTotal = 0;
    /** Windup cycle index that just transitioned to active (for sprite sync). */
    this._enteredActiveCycle = 0;
    /** Brute-sheet archetype: fixed-interval warcry schedule (see enemy.bruteSheetArchetype). */
    this._bruteNextWarcryAt = 0;
    /** Game time (`game.time`) until ANY next attack may start; separate from per-attack cooldowns. */
    this._globalAttackCooldownUntil = 0;
    this.availableAttacks = this._getAvailableAttacks();
  }

  /**
   * Lockout after completing an attack (minion 4s, elite 3s, miniboss 1s). Main bosses skip.
   */
  _globalAttackCooldownSec() {
    const e = this.enemy;
    if (e?.isBoss || e?.enemyTier === "boss") return 0;
    const raw = e?.enemyTier;
    const t = raw === "miniboss" ? "miniBoss" : raw;
    if (e?.isMiniBoss || t === "miniBoss") return 1;
    if (e?.isElite || t === "elite" || t === "special") return 3;
    return 4;
  }

  _applyGlobalAttackCooldown(game) {
    const sec = this._globalAttackCooldownSec();
    if (sec <= 0) return;
    this._globalAttackCooldownUntil = (game?.time || 0) + sec;
  }

  _getAvailableAttacks() {
    const kitKey = this.enemy.bruteSheetArchetype?.attackKitName || this.enemy.name;
    const kit = ENEMY_ATTACK_KITS[kitKey];
    if (!kit) return [];
    let list = [...(kit.base || [])];
    if (this.enableHiddenAttacks && kit.hidden?.length) {
      list = [...list, ...kit.hidden];
    }
    if (this.enemy.bruteSheetArchetype?.filterAttacksByRarityTier) {
      list = list.filter((a) => this._bruteSheetArchetypeAttackAllowedByTier(a));
    }
    return list;
  }

  /** Brute-sheet archetype: minion = normal only; elite = normal + uncommon; miniBoss = uncommon + rare. */
  _bruteSheetArchetypeAttackTierBucket() {
    const e = this.enemy;
    const raw = e.enemyTier;
    const t = raw === "miniboss" ? "miniBoss" : raw;
    if (e.isMiniBoss || t === "miniBoss" || t === "boss") return "miniBoss";
    if (e.isElite || t === "elite" || t === "special") return "elite";
    return "minion";
  }

  _bruteSheetArchetypeAttackAllowedByTier(attack) {
    const rarity = attack.rarity ?? "normal";
    const bucket = this._bruteSheetArchetypeAttackTierBucket();
    if (bucket === "minion") return rarity === "normal";
    if (bucket === "elite") return rarity === "normal" || rarity === "uncommon";
    if (bucket === "miniBoss") return rarity === "uncommon" || rarity === "rare";
    return true;
  }

  canAct() {
    const e = this.enemy;
    if (e.stunUntil != null && e.stunUntil > (e._gameTime ?? 0)) return false;
    if (e._undyingRespawnTime != null && (e._gameTime ?? 0) < e._undyingRespawnTime) return false;
    if (this.phaseUntil != null && (e._gameTime ?? 0) < this.phaseUntil) return false;
    if (this.regenChannelUntil != null && (e._gameTime ?? 0) < this.regenChannelUntil) return false;
    if (e._arrowRainUntil != null && (e._gameTime ?? 0) < e._arrowRainUntil) return false;
    if (e._fireThrowerUntil != null && (e._gameTime ?? 0) < e._fireThrowerUntil) return false;
    if (e._earthquakeUntil != null && (e._gameTime ?? 0) < e._earthquakeUntil) return false;
    if (e._volcanoEruptionUntil != null && (e._gameTime ?? 0) < e._volcanoEruptionUntil) return false;
    if ((e._monsterflyRecoverTimer || 0) > 0) return false;
    if (e.bruteSheetArchetype && e._bruteBurstMove) return false;
    if (e._attackRollState) return false;
    if (e._cycloneState) return false;
    if ((e._cycloneEndTimer || 0) > 0) return false;
    if (e.name === "RockGiant" && (e._rockGiantHealing || e._rockGiantHitReaction)) return false;
    return true;
  }

  _pickAttack(player, game) {
    const now = game?.time || 0;
    if (now < (this._globalAttackCooldownUntil || 0)) return null;

    const cx = this.enemy.position.x + this.enemy.size / 2;
    const cy = this.enemy.position.y + this.enemy.size / 2;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const bsa = this.enemy.bruteSheetArchetype;
    if (bsa?.attackIds?.warcry) {
      const warcryId = bsa.attackIds.warcry;
      const warcry = this.availableAttacks.find((a) => a?.id === warcryId);
      if (warcry) {
        const cdOk = (this.cooldowns[warcry.id] || 0) <= 0;
        const timeOk = (game?.time || 0) >= (Number(this._bruteNextWarcryAt) || 0);
        const minR = warcry.minRange ?? 0;
        const maxR = warcry.maxRange ?? 999;
        const rangeOk = dist >= minR && dist <= maxR;
        if (cdOk && timeOk && rangeOk) return warcry;
      }
    }

    const candidates = this.availableAttacks.filter((a) => {
      if (this.cooldowns[a.id] > 0) return false;
      const maxUses = Number(a.execute?.maxUses);
      if (Number.isFinite(maxUses) && maxUses > 0) {
        const used = this.attackUses[a.id] || 0;
        if (used >= maxUses) return false;
      }
      const minR = a.minRange ?? 0;
      const maxR = a.maxRange ?? 999;
      if (dist < minR || dist > maxR) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    let totalWeight = 0;
    for (const a of candidates) totalWeight += a.weight ?? 1;
    let r = Math.random() * totalWeight;
    for (const a of candidates) {
      r -= a.weight ?? 1;
      if (r <= 0) return a;
    }
    return candidates[0];
  }

  update(dt, game) {
    const enemy = this.enemy;
    const player = game.player;
    enemy._gameTime = game.time;

    if (enemy.bruteSheetArchetype && enemy._bruteBurstMove && this.state !== "idle") {
      this.state = "idle";
      this.currentAttack = null;
      this.recoveringAttackId = null;
      this.timer = 0;
      this._windupTotal = 0;
      this._enteredActiveCycle = 0;
      this.targetSnapshot = null;
      enemy._whirlwindBurstState = null;
      enemy._whirlwindPulsePayload = null;
      enemy._fireThrowerState = null;
      enemy._fireThrowerUntil = null;
      enemy._fireThrowerFreezeUntil = null;
      enemy._fireWaveBackstep = null;
      enemy._fireLeapState = null;
      enemy._earthquakeState = null;
      enemy._earthquakeUntil = null;
      enemy._volcanoEruptionState = null;
      enemy._volcanoEruptionUntil = null;
      this._pendingAnimationHitbox = null;
      this._projectileWindupTotal = 0;
      this._projectileWindupExecuteDone = false;
      this.dashDir = null;
      this.dashTraveled = 0;
      this.dashTotalDist = 0;
      this.dashHitApplied = false;
      this._globalAttackCooldownUntil = 0;
    }

    // Update cooldowns
    for (const id of Object.keys(this.cooldowns)) {
      let cd = this.cooldowns[id] - dt;
      if (this.rageUntil != null && game.time < this.rageUntil) cd -= dt * 0.5;
      this.cooldowns[id] = Math.max(0, cd);
    }

    if (this.rageUntil != null && game.time >= this.rageUntil) this.rageUntil = null;
    if (this.phaseUntil != null && game.time >= this.phaseUntil) this.phaseUntil = null;
    if (this.regenChannelUntil != null && game.time >= this.regenChannelUntil) this.regenChannelUntil = null;
    if (this.orbitingOrbsUntil != null && game.time >= this.orbitingOrbsUntil) this.orbitingOrbsUntil = null;

    this._tickArrowRain(game);
    this._tickFireThrower(game);
    this._tickEarthquake(game);
    this._tickVolcanoEruption(game);

    if (this.state === "idle") {
      if (!this.canAct()) return;
      if (!enemy.activated) return;
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      const engagementRange = 350;
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const d = Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);
      if (d > engagementRange) return;

      const attack = this._pickAttack(player, game);
      if (attack) {
        if (enemy?.enemyTypeId === "m_ud_dark_knight_3") {
          console.log(`[DarkKnight Attack] ${attack.id}`);
        }
        this.currentAttack = attack;
        this.state = "windup";
        this.timer = (attack.telegraph?.windup ?? 0.5) / (this.rageUntil && game.time < this.rageUntil ? 1.2 : 1);
        this._windupTotal = this.timer;
      const warcryId = enemy.bruteSheetArchetype?.attackIds?.warcry;
      if (warcryId && attack.id === warcryId) {
        const cadence = Math.max(0.5, Number(enemy.bruteSheetArchetype.warcryCadenceSec) || 8);
        this._bruteNextWarcryAt = (game.time || 0) + cadence;
      }
        this.targetSnapshot = { x: px, y: py };
        if (attack.id === "ud_wizard_fire_leap") {
          const ex = enemy.position.x + enemy.size / 2;
          const ey = enemy.position.y + enemy.size / 2;
          const dx = px - ex;
          const dy = py - ey;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          this._fireLeapDir = { x: dx / dist, y: dy / dist };
          enemy._fireLeapState = {
            active: true,
            dirX: dx / dist,
            dirY: dy / dist,
            elapsed: 0,
            duration: Math.max(0.01, Number(attack.telegraph?.windup) || 1.2),
            distance: Math.max(0, Number(attack.execute?.leapDistance) || 240)
          };
        }
        const rawCombo = Number(attack.execute?.comboShots);
        this._comboShotTotal =
          Number.isFinite(rawCombo) && rawCombo > 1 ? Math.max(2, Math.floor(rawCombo)) : 1;
        this._comboShotsCompleted = 0;
        this._attackWindupCycle = (this._attackWindupCycle ?? 0) + 1;
        if (attack.kind === "projectile") {
          this._projectileWindupTotal = this.timer;
          this._projectileWindupExecuteDone = false;
        } else {
          this._projectileWindupTotal = 0;
          this._projectileWindupExecuteDone = false;
        }
        // 5px horizontal dead zone to avoid rapid left/right flipping when player is centered on enemy
        if (px >= ex + 5) enemy.facingRight = true;
        else if (px <= ex - 5) enemy.facingRight = false;
      }
      return;
    }

    if (this.state === "windup") {
      if (enemy._fireLeapState?.active && this.currentAttack?.id === "ud_wizard_fire_leap") {
        const st = enemy._fireLeapState;
        const dur = Math.max(0.01, Number(st.duration) || 1.2);
        const speed = (Math.max(0, Number(st.distance) || 240) / dur) || 0;
        enemy.position.x += (Number(st.dirX) || 0) * speed * dt;
        enemy.position.y += (Number(st.dirY) || 0) * speed * dt;
        st.elapsed = (Number(st.elapsed) || 0) + dt;
      }
      if (this.currentAttack?.kind === "projectile" && this.timer > 0.2 && this.timer - dt <= 0.2) {
        const px = player.position.x + player.size / 2;
        const py = player.position.y + player.size / 2;
        this.targetSnapshot = { x: px, y: py };
      }
      this.timer -= dt;
      if (
        this.currentAttack?.kind === "projectile" &&
        this._projectileWindupTotal > 0 &&
        !this._projectileWindupExecuteDone
      ) {
        const execEarly = this.currentAttack.execute || {};
        const deferToAnimTrigger =
          execEarly.hitboxTrigger != null &&
          Number.isInteger(Number(execEarly.hitboxTrigger)) &&
          execEarly.projectileSpawnWindupT == null;
        if (!deferToAnimTrigger) {
          const rawT = Number(this.currentAttack.execute?.projectileSpawnWindupT);
          const spawnT = Number.isFinite(rawT) ? Math.max(0, Math.min(1, rawT)) : 0.5;
          const threshold = this._projectileWindupTotal * (1 - spawnT);
          if (this.timer <= threshold + 1e-6) {
            const px = player.position.x + player.size / 2;
            const py = player.position.y + player.size / 2;
            this.targetSnapshot = { x: px, y: py };
            this._execute(game);
            this._projectileWindupExecuteDone = true;
          }
        }
      }
      if (this.timer <= 0) {
        // If this attack defines an animation frame trigger for the hitbox, prime payload now and delay spawn.
        const a = this.currentAttack;
        const exec = a?.execute || {};
        const hitboxTriggerRaw = exec?.hitboxTrigger;
        const hitboxTrigger =
          hitboxTriggerRaw == null || !Number.isFinite(Number(hitboxTriggerRaw))
            ? null
            : Math.floor(Number(hitboxTriggerRaw));
        const animFrameProjectile =
          a?.kind === "projectile" &&
          hitboxTrigger != null &&
          hitboxTrigger >= 0 &&
          hitboxTriggerRaw != null &&
          Number.isInteger(Number(hitboxTriggerRaw)) &&
          exec?.projectileSpawnWindupT == null;
        const shouldDelayAnimationHitbox =
          (a?.kind === "cone" ||
            a?.kind === "circle" ||
            a?.kind === "whirlwind" ||
            a?.kind === "summon" ||
            animFrameProjectile) &&
          hitboxTrigger != null &&
          hitboxTrigger >= 0 &&
          hitboxTriggerRaw != null &&
          Number.isInteger(Number(hitboxTriggerRaw));

        if (shouldDelayAnimationHitbox) {
          this._primeAnimationHitboxForCurrentAttack(game, { hitboxTrigger });
        } else if (!(a?.kind === "projectile" && this._projectileWindupExecuteDone)) {
          this._execute(game);
        }
        if (a?.id === "ud_wizard_fire_leap" && enemy._fireLeapState) {
          enemy._fireLeapState.active = false;
        }
        this.state = "active";
        this._enteredActiveCycle = this._attackWindupCycle ?? 0;
        this.timer = this._activeDurationOverride ?? 0.05;
        this._activeDurationOverride = null;
      }
      return;
    }

    if (this.state === "active") {
      this._tickSameStripConeCombo(game);
      if (this.currentAttack?.kind === "frame_synced_circle" && enemy._frameSyncedCircleHits) {
        this._tickFrameSyncedCircleHits(game);
      }
      this._tickWhirlwindScheduledBursts(game);
      const fireWave = enemy._fireWaveBackstep;
      if (fireWave) {
        const mv = Math.max(0, Number(fireWave.speed) || 0);
        const dur = Math.max(0.001, Number(fireWave.duration) || 0.5);
        fireWave.elapsed = (Number(fireWave.elapsed) || 0) + dt;
        const dirX = Number(fireWave.dirX) || 0;
        const dirY = Number(fireWave.dirY) || 0;
        enemy.position.x += dirX * mv * dt;
        enemy.position.y += dirY * mv * dt;
        if (fireWave.elapsed >= dur) {
          enemy._fireWaveBackstep = null;
        }
      }
      const backstep = enemy._attackBackstepChainState;
      if (backstep) {
        if (this.timer > 0.5) {
          const movePerSec = backstep.backstepDist / Math.max(0.01, backstep.backstepDuration);
          enemy.position.x -= backstep.dirX * movePerSec * dt;
          enemy.position.y -= backstep.dirY * movePerSec * dt;
        }
        const prevTimer = this.timer;
        this.timer -= dt;
        if (prevTimer > 1.5 && this.timer <= 1.5 && !backstep.shot2Fired && game.spawnEnemyProjectile) {
          backstep.shot2Fired = true;
          const ex = enemy.position.x + enemy.size / 2;
          const ey = enemy.position.y + enemy.size / 2;
          const vx = Math.cos(Math.atan2(backstep.dirY, backstep.dirX)) * backstep.speed;
          const vy = Math.sin(Math.atan2(backstep.dirY, backstep.dirX)) * backstep.speed;
          game.spawnEnemyProjectile(ex, ey, vx, vy, backstep.baseDmg, backstep.size, backstep.color, backstep.execute, enemy);
        }
        if (this.timer <= 0) {
          enemy._attackBackstepChainState = null;
        }
      } else {
        this.timer -= dt;
      }
      if (this.timer <= 0) {
        // Clear pending hitbox when leaving active.
        this._pendingAnimationHitbox = null;
        this._sameStripConeCombo = null;
        if (enemy._frameSyncedCircleHits) {
          enemy._frameSyncedCircleHits = null;
        }
        enemy._whirlwindBurstState = null;
        enemy._whirlwindPulsePayload = null;
        this._comboShotsCompleted++;
        const total = Math.max(1, Math.floor(Number(this._comboShotTotal) || 1));
        if (this._comboShotsCompleted < total) {
          if (this.currentAttack?.execute?.comboNoWindup === true) {
            // Continue combo swings immediately after active ends (no extra windup).
            if (game.player) {
              const px = game.player.position.x + game.player.size / 2;
              const py = game.player.position.y + game.player.size / 2;
              this.targetSnapshot = { x: px, y: py };
            }
            this._execute(game);
            this.state = "active";
            this.timer = this._activeDurationOverride ?? 0.05;
            this._activeDurationOverride = null;
          } else {
            this._attackWindupCycle = (this._attackWindupCycle ?? 0) + 1;
            this.state = "windup";
            this.timer = (this.currentAttack.telegraph?.windup ?? 0.5) / (this.rageUntil && game.time < this.rageUntil ? 1.2 : 1);
            this._windupTotal = this.timer;
            if (this.currentAttack?.kind === "projectile") {
              this._projectileWindupTotal = this.timer;
              this._projectileWindupExecuteDone = false;
            }
            if (game.player) {
              const px = game.player.position.x + game.player.size / 2;
              const py = game.player.position.y + game.player.size / 2;
              this.targetSnapshot = { x: px, y: py };
            }
          }
        } else {
          const recoverTime = 0;
          this.cooldowns[this.currentAttack.id] = (this.currentAttack.cooldown ?? 1.5) * (this.rageUntil && game.time < this.rageUntil ? 0.7 : 1);
          this.recoveringAttackId = null;
          this.currentAttack = null;
          this._comboShotsCompleted = 0;
          this._comboShotTotal = 1;
          this._applyGlobalAttackCooldown(game);
          if (recoverTime > 0) {
            this.state = "recover";
            this.timer = recoverTime;
          } else {
            this.state = "idle";
            this.timer = 0;
          }
        }
      }
      return;
    }

    if (this.state === "recover") {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = "idle";
        this.recoveringAttackId = null;
      }
    }
  }

  _primeAnimationHitboxForCurrentAttack(game, { hitboxTrigger }) {
    const enemy = this.enemy;
    const a = this.currentAttack;
    const exec = a?.execute || {};
    if (
      !a ||
      (a.kind !== "cone" &&
        a.kind !== "circle" &&
        a.kind !== "whirlwind" &&
        a.kind !== "summon" &&
        a.kind !== "projectile")
    )
      return;

    const player = game.player;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const tx = this.targetSnapshot?.x ?? (player ? player.position.x + player.size / 2 : ex);
    const ty = this.targetSnapshot?.y ?? (player ? player.position.y + player.size / 2 : ey);

    const dx = tx - ex;
    const dy = ty - ey;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirAngle = Math.atan2(dirY, dirX);

    const scale = this.attackScale * (enemy.attack ?? 10) / 10;
    const baseDmg = Math.round((exec?.damage ?? 1) * scale);

    // Active duration: match remaining animation frames exactly.
    // We enter active on `hitboxTrigger` frame (see sprite FSM), so remaining frames are [hitboxTrigger .. last].
    const animFps = Math.max(1, Number(exec?.animFps) || 14);
    const animDur = Number(exec?.activeAnimDuration);
    const totalFramesRaw =
      Number(exec?.totalFrames) ||
      (Number.isFinite(animDur) && animDur > 0 ? Math.round(animDur * animFps) : null) ||
      15;
    const totalFrames = Math.max(1, Math.floor(totalFramesRaw));
    const trigger = Math.max(0, Math.min(totalFrames - 1, Math.floor(Number(hitboxTrigger) || 0)));
    const remainingFrames = Math.max(1, totalFrames - trigger);
    this._activeDurationOverride = Math.max(0.06, remainingFrames / animFps);
    if (exec?.effect === "fire_thrower") {
      const dur = Math.max(0.01, Number(exec.fireThrowerDurationSec) || 2.0);
      this._activeDurationOverride = Math.max(0.06, dur + remainingFrames / animFps);
    }

    let payload = null;
    if (a.kind === "cone") {
      const range = exec?.range ?? 80;
      const arc = exec?.arc ?? 90;
      const arcRad = (arc * Math.PI) / 180;
      payload = {
        kind: a.kind,
        attackId: a.id,
        ex,
        ey,
        dirX,
        dirY,
        dirAngle,
        range,
        arc,
        arcRad,
        baseDmg,
        knockback: exec.knockback,
        attack: a
      };
    } else if (a.kind === "circle") {
      const r = exec?.radius ?? 70;
      // For animation-synced circle attacks we default to "around the enemy" unless explicitly atTarget.
      const impactX = exec?.atTarget ? tx : ex;
      const impactY = exec?.atTarget ? ty : ey;
      payload = {
        kind: a.kind,
        attackId: a.id,
        impactX,
        impactY,
        radius: r,
        baseDmg,
        attack: a
      };
    } else if (a.kind === "whirlwind") {
      const r = exec?.radius ?? 100;
      payload = {
        kind: "whirlwind",
        attackId: a.id,
        impactX: ex,
        impactY: ey,
        radius: r,
        baseDmg,
        circleDurationMs: Math.max(1, Number(exec?.circleDurationMs) || 100),
        attack: a
      };
    } else if (a.kind === "summon") {
      payload = {
        kind: "summon",
        attackId: a.id,
        ex,
        ey,
        dirX,
        dirY,
        attack: a
      };
    } else if (a.kind === "projectile") {
      payload = {
        kind: "projectile",
        attackId: a.id,
        ex,
        ey,
        dirX,
        dirY,
        dirAngle,
        baseDmg,
        attack: a
      };
    }
    if (!payload) return;

    this._pendingAnimationHitbox = {
      hitboxTrigger,
      fired: false,
      lastFrameIndex: -1,
      kind: a.kind,
      payload
    };
  }

  trySpawnAnimationHitboxOnFrame(game, spriteFrameIndex) {
    if (this.state !== "active") return false;
    const pending = this._pendingAnimationHitbox;
    if (!pending || pending.fired) return false;
    const cur = Number(spriteFrameIndex);
    if (!Number.isFinite(cur)) return false;

    // Spawn once when we reach/cross the trigger frame.
    const prev = Number(pending.lastFrameIndex);
    if (cur >= pending.hitboxTrigger && prev < pending.hitboxTrigger) {
      pending.fired = true;
      this._spawnPendingAnimationHitbox(game, pending.payload);
      return true;
    }

    pending.lastFrameIndex = cur;
    return false;
  }

  _spawnPendingAnimationHitbox(game, payload) {
    const enemy = this.enemy;
    const player = game.player;
    if (!payload) return;
    const k = payload.kind;
    if (k === "summon") {
      const a = payload.attack;
      const exec = a?.execute || {};
      const spawnType = exec.spawnType ?? "m_3a_small_slime";
      const count = Math.max(1, Math.floor(Number(exec.count ?? exec.spawnCount) || 1));
      const ex = payload.ex;
      const ey = payload.ey;
      const dirX = payload.dirX;
      const dirY = payload.dirY;
      if (typeof game.spawnEnemyMinion !== "function") return;
      const delayedSummon = exec.hitboxTrigger != null && Number.isInteger(Number(exec.hitboxTrigger));
      const forwardDist = Number.isFinite(Number(exec.spawnForward)) ? Number(exec.spawnForward) : 260;
      if (delayedSummon && count === 1 && exec.spawnRing !== true) {
        const typeDef = ENEMY_TYPES.find((t) => t.id === spawnType) || ENEMY_TYPES[0];
        const sz = Math.max(16, Number(typeDef?.size) || 160);
        const cx = ex + dirX * forwardDist;
        const cy = ey + dirY * forwardDist;
        game.spawnEnemyMinion(cx - sz / 2, cy - sz / 2, spawnType);
      } else {
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
          const off = 40 + Math.random() * 30;
          const sx = ex + Math.cos(angle) * off - 43;
          const sy = ey + Math.sin(angle) * off - 43;
          game.spawnEnemyMinion(sx, sy, spawnType);
        }
      }
      return;
    }
    if (k === "projectile") {
      const a = payload.attack;
      const exec = a?.execute || {};
      const ex = payload.ex;
      const ey = payload.ey;
      const dirAngle = payload.dirAngle;
      const baseDmg = payload.baseDmg;
      const speed = (exec.speed ?? 280) * (this.attackScale > 1.2 ? 1.1 : 1);
      const size = exec.size ?? 12;
      const color = exec.color ?? "#a855f7";
      const useHitbox = exec.useHitbox === true && typeof game.spawnEnemyProjectileHitbox === "function";
      const random360 = exec.random360 === true;
      const burstCount = Math.max(1, Math.floor(Number(exec.count ?? 1) || 1));
      if (random360) {
        for (let i = 0; i < burstCount; i++) {
          const ang = Math.random() * Math.PI * 2;
          if (useHitbox) {
            game.spawnEnemyProjectileHitbox(ex, ey, Math.cos(ang), Math.sin(ang), baseDmg, a.execute, enemy);
          } else if (typeof game.spawnEnemyProjectile === "function") {
            game.spawnEnemyProjectile(
              ex,
              ey,
              Math.cos(ang) * speed,
              Math.sin(ang) * speed,
              baseDmg,
              size,
              color,
              a.execute,
              enemy
            );
          }
        }
        return;
      }
      if (exec.effect === "fire_wave") {
        const backstepSpeed = Math.max(0, Number(exec.backstepSpeed) || 400);
        const backstepDuration = Math.max(0.01, Number(exec.backstepDuration) || 0.5);
        // Move opposite the shot direction starting on the spawn tick.
        enemy._fireWaveBackstep = {
          dirX: -Math.cos(dirAngle),
          dirY: -Math.sin(dirAngle),
          speed: backstepSpeed,
          duration: backstepDuration,
          elapsed: 0
        };
      }
      if (useHitbox) {
        game.spawnEnemyProjectileHitbox(
          ex,
          ey,
          Math.cos(dirAngle),
          Math.sin(dirAngle),
          baseDmg,
          a.execute,
          enemy
        );
      } else if (typeof game.spawnEnemyProjectile === "function") {
        game.spawnEnemyProjectile(
          ex,
          ey,
          Math.cos(dirAngle) * speed,
          Math.sin(dirAngle) * speed,
          baseDmg,
          size,
          color,
          a.execute,
          enemy
        );
      }
      return;
    }
    if (k === "cone") {
      const attackId = payload.attackId;
      const ex = payload.ex;
      const ey = payload.ey;
      const dirX = payload.dirX;
      const dirY = payload.dirY;
      const dirAngle = payload.dirAngle;
      const range = payload.range;
      const arc = payload.arc;
      const arcRad = payload.arcRad;
      const baseDmg = payload.baseDmg;
      const a = payload.attack;
      const effect = a?.execute?.effect;

      if (effect === "fire_thrower") {
        const intervalSec = Math.max(0.01, Number(a?.execute?.fireThrowerIntervalSec) || 0.2);
        const durationSec = Math.max(0.01, Number(a?.execute?.fireThrowerDurationSec) || 2.0);
        const pulses = Math.max(1, Math.ceil(durationSec / intervalSec));

        // Freeze the strike sheet on trigger frame during the thrower duration (handled in Enemy sprite FSM).
        enemy._fireThrowerFreezeUntil = (game.time || 0) + durationSec;

        if (typeof game.spawnEnemyConeHitbox === "function") {
          game.spawnEnemyConeHitbox(enemy, ex, ey, dirX, dirY, range, arc, baseDmg, attackId);
          this._applyDebuffs(game, a);
        }

        const startAt = game.time || 0;
        enemy._fireThrowerState = {
          remainingPulses: pulses - 1,
          nextAt: startAt + intervalSec,
          intervalSec,
          untilAt: startAt + durationSec,
          ex,
          ey,
          dirX,
          dirY,
          dirAngle,
          range,
          arc,
          arcRad,
          baseDmg,
          attackId
        };
        enemy._fireThrowerUntil = enemy._fireThrowerState.untilAt;
        return;
      }

      const coneImpactSprite = getConeAttackImpactAnimatedSprite(attackId, range);
      if (coneImpactSprite && Array.isArray(game.skillEffects)) {
        game.skillEffects.push({
          type: "animatedSpriteImpact",
          x: ex + dirX * (range * 0.45),
          y: ey + dirY * (range * 0.45),
          t: 0,
          angleRad: dirAngle,
          flipY: dirX < 0,
          animatedSprite: coneImpactSprite
        });
      }

      if (typeof game.spawnEnemyConeHitbox === "function") {
        const kb = payload.knockback;
        const coneOpts =
          kb != null && Number.isFinite(Number(kb)) ? { knockback: Number(kb) } : {};
        game.spawnEnemyConeHitbox(enemy, ex, ey, dirX, dirY, range, arc, baseDmg, attackId, coneOpts);
        if (attackId !== "banshee_scream") this._applyDebuffs(game, a);
      } else {
        // Fallback to circle-in-cone test.
        if (!player) return;
        const px = player.position.x + player.size / 2;
        const py = player.position.y + player.size / 2;
        const pr = Math.max(2, (player.size || 0) * 0.5);
        const kbFallback = payload.knockback;
        if (this._isCircleInCone(ex, ey, dirAngle, range, arcRad, px, py, pr)) {
          game.onPlayerDamaged(baseDmg, true);
          game.lastDamagingEnemy = enemy;
          if (
            kbFallback != null &&
            Number.isFinite(Number(kbFallback)) &&
            typeof game.applyKnockback === "function"
          ) {
            game.applyKnockback("player", ex, ey, Number(kbFallback));
          }
          if (attackId !== "banshee_scream") this._applyDebuffs(game, a);
        }
      }
    } else if (k === "circle") {
      const attackId = payload.attackId;
      const impactX = payload.impactX;
      const impactY = payload.impactY;
      const r = payload.radius;
      const baseDmg = payload.baseDmg;
      const a = payload.attack;
      const effect = a?.execute?.effect;

      if (effect === "fire_cleanse") {
        // Small self-centered hit + flat heal.
        const healFlat = Math.max(0, Math.floor(Number(a?.execute?.healFlat) || 50));
        if (healFlat > 0 && Number.isFinite(enemy.health) && Number.isFinite(enemy.maxHealth)) {
          enemy.health = Math.min(enemy.maxHealth, enemy.health + healFlat);
        }
        const vfx = getAnimatedSpritePreset(a?.execute?.impactVfxPreset || "smokeBurstSoft", {
          drawWidth: Math.max(56, r * 2.2),
          drawHeight: Math.max(56, r * 2.2)
        });
        if (vfx && Array.isArray(game.skillEffects)) {
          game.skillEffects.push({
            type: "animatedSpriteImpact",
            x: impactX,
            y: impactY,
            t: 0,
            animatedSprite: vfx
          });
        }
        if (typeof game.spawnEnemyCircleHitbox === "function") {
          game.spawnEnemyCircleHitbox(enemy, impactX, impactY, r, baseDmg, attackId);
          this._applyDebuffs(game, a);
        } else if (player) {
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          if ((px - impactX) ** 2 + (py - impactY) ** 2 <= r * r) {
            game.onPlayerDamaged(baseDmg, true);
            game.lastDamagingEnemy = enemy;
            this._applyDebuffs(game, a);
          }
        }
        return;
      }

      if (effect === "necro_explosion_burst") {
        if (typeof game.spawnEnemyCircleHitbox === "function") {
          game.spawnEnemyCircleHitbox(enemy, impactX, impactY, r, baseDmg, attackId);
        } else if (player) {
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          if ((px - impactX) ** 2 + (py - impactY) ** 2 <= r * r) {
            game.onPlayerDamaged(baseDmg, true);
            game.lastDamagingEnemy = enemy;
          }
        }

        const count = Math.max(1, Math.floor(Number(a?.execute?.burstProjectileCount) || 8));
        const speed = Math.max(80, Number(a?.execute?.burstProjectileSpeed) || 280);
        const projSize = Math.max(4, Number(a?.execute?.burstProjectileSize) || 12);
        const projColor = a?.execute?.burstProjectileColor ?? "#7c3aed";
        const useHitbox = a?.execute?.burstUseHitbox !== false && typeof game.spawnEnemyProjectileHitbox === "function";
        const projExec = {
          ...(a?.execute || {}),
          speed,
          size: projSize,
          color: projColor,
          useHitbox,
          hitboxTrigger: undefined,
          projectileSpawnWindupT: undefined
        };
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2;
          const dirX = Math.cos(ang);
          const dirY = Math.sin(ang);
          if (useHitbox) {
            game.spawnEnemyProjectileHitbox(impactX, impactY, dirX, dirY, baseDmg, projExec, enemy);
          } else if (typeof game.spawnEnemyProjectile === "function") {
            game.spawnEnemyProjectile(
              impactX,
              impactY,
              dirX * speed,
              dirY * speed,
              baseDmg,
              projSize,
              projColor,
              projExec,
              enemy
            );
          }
        }
        this._applyDebuffs(game, a);
        return;
      }

      if (effect === "darkfire_pillar") {
        const n = Math.max(1, Math.floor(Number(a?.execute?.pillarCount) || 5));
        const ring = Math.max(8, Number(a?.execute?.pillarRingOffset) || 72);
        const pr = Math.max(4, Number(a?.execute?.pillarHitRadius) || 28);
        const durMs = Math.max(1, Math.round(Number(a?.execute?.pillarDurationMs) || 140));
        const multRaw = Number(a?.execute?.pillarDamageMult);
        const mult = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 0.35;
        const dmgEach = Math.max(1, Math.round(baseDmg * mult));
        const vfxId = a?.execute?.pillarImpactVfxPreset || "soulSiphonSpiritFireballImpact";
        const vfxCfg = getAnimatedSpritePreset(vfxId, a?.execute?.pillarImpactVfxOverrides || null);
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const px = impactX + Math.cos(ang) * ring;
          const py = impactY + Math.sin(ang) * ring;
          if (vfxCfg && Array.isArray(game.skillEffects)) {
            game.skillEffects.push({
              type: "animatedSpriteImpact",
              x: px,
              y: py,
              t: 0,
              animatedSprite: { ...vfxCfg }
            });
          }
          if (typeof game.spawnEnemyCircleHitbox === "function") {
            game.spawnEnemyCircleHitbox(enemy, px, py, pr, dmgEach, attackId, { durationMs: durMs });
          } else if (player) {
            const pcx = player.position.x + player.size / 2;
            const pcy = player.position.y + player.size / 2;
            if ((pcx - px) ** 2 + (pcy - py) ** 2 <= pr * pr) {
              game.onPlayerDamaged(dmgEach, true);
              game.lastDamagingEnemy = enemy;
            }
          }
        }
        this._applyDebuffs(game, a);
        return;
      }

      if (effect === "arrow_rain") {
        const intervalSec = Math.max(0.01, Number(a?.execute?.rainIntervalSec) || 0.2);
        const durationSec = Math.max(0.01, Number(a?.execute?.rainDurationSec) || 2.0);
        const pulses = Math.max(1, Math.ceil(durationSec / intervalSec));
        const pulseDurationMs = Math.max(1, Math.round(intervalSec * 1000));

        // First pulse happens immediately on the animation hitbox trigger frame.
        const px = impactX;
        const py = impactY;
        if (typeof game.spawnEnemyCircleHitbox !== "function") return;
        game.spawnEnemyCircleHitbox(enemy, px, py, r, baseDmg, attackId, { durationMs: pulseDurationMs });

        this._applyDebuffs(game, a);

        const startAt = game.time || 0;
        enemy._arrowRainState = {
          remainingPulses: pulses - 1,
          nextAt: startAt + intervalSec,
          intervalSec,
          untilAt: startAt + durationSec,
          centerX: px,
          centerY: py,
          radius: r,
          baseDmg,
          attackId,
          pulseDurationMs
        };
        enemy._arrowRainUntil = enemy._arrowRainState.untilAt;
        return;
      }

      if (effect === "earthquake") {
        if (typeof game.spawnEnemyCircleHitbox !== "function") return;
        const gapSec = Math.max(0.01, Number(a?.execute?.earthquakeGapSec) || 0.3);
        const radii = Array.isArray(a?.execute?.earthquakeRadii)
          ? a.execute.earthquakeRadii
              .map((v) => Math.max(4, Number(v) || 0))
              .filter((v) => Number.isFinite(v) && v > 0)
          : [50, 100, 150];
        const pulseDurationMs = Math.max(1, Math.round(Number(a?.execute?.earthquakePulseDurationMs) || 140));
        const vfxPreset = a?.execute?.earthquakeImpactVfxPreset || "smokeBurstRing";
        const spawnWave = (waveRadius) => {
          const exNow = enemy.position.x + enemy.size / 2;
          const eyNow = enemy.position.y + enemy.size / 2;
          if (Array.isArray(game.skillEffects)) {
            const vfxCfg = getAnimatedSpritePreset(vfxPreset, {
              drawWidth: Math.max(64, waveRadius * 2.2),
              drawHeight: Math.max(64, waveRadius * 2.2)
            });
            if (vfxCfg) {
              game.skillEffects.push({
                type: "animatedSpriteImpact",
                x: exNow,
                y: eyNow,
                t: 0,
                animatedSprite: vfxCfg
              });
            }
          }
          game.spawnEnemyCircleHitbox(enemy, exNow, eyNow, waveRadius, baseDmg, attackId, { durationMs: pulseDurationMs });
        };

        spawnWave(radii[0] || 50);
        this._applyDebuffs(game, a);

        const startAt = game.time || 0;
        enemy._earthquakeState = {
          radii,
          nextIndex: 1,
          nextAt: startAt + gapSec,
          gapSec,
          untilAt: startAt + gapSec * Math.max(0, radii.length - 1),
          baseDmg,
          attackId,
          pulseDurationMs,
          vfxPreset
        };
        enemy._earthquakeUntil = enemy._earthquakeState.untilAt;
        return;
      }

      if (effect === "volcano_eruption") {
        const hits = Math.max(1, Math.floor(Number(a?.execute?.eruptionHits) || 10));
        const gapSec = Math.max(0.001, Number(a?.execute?.eruptionGapSec) || 0.05);
        const spawnRadius = Math.max(0, Number(a?.execute?.eruptionSpawnRadius) || 400);
        const pulseDurationMs = Math.max(1, Math.round(Number(a?.execute?.eruptionPulseDurationMs) || 120));
        if (typeof game.spawnEnemyCircleHitbox !== "function") return;
        const spawnOne = () => {
          const exNow = enemy.position.x + enemy.size / 2;
          const eyNow = enemy.position.y + enemy.size / 2;
          const ang = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * spawnRadius;
          const px = exNow + Math.cos(ang) * rr;
          const py = eyNow + Math.sin(ang) * rr;
          game.spawnEnemyCircleHitbox(enemy, px, py, r, baseDmg, attackId, { durationMs: pulseDurationMs });
        };

        // First hit lands on trigger frame; remaining hits are scheduled.
        spawnOne();
        this._applyDebuffs(game, a);

        const startAt = game.time || 0;
        enemy._volcanoEruptionState = {
          remainingHits: hits - 1,
          nextAt: startAt + gapSec,
          gapSec,
          untilAt: startAt + gapSec * Math.max(0, hits - 1),
          radius: r,
          baseDmg,
          attackId,
          pulseDurationMs,
          spawnRadius
        };
        enemy._volcanoEruptionUntil = enemy._volcanoEruptionState.untilAt;
        return;
      }

      if (effect === "warcry") {
        const speedMult = Math.max(0, Number(a?.execute?.speedMult) || 1.2);
        const buffDuration = Math.max(0, Number(a?.execute?.buffDuration) || 3);
        const healAmount = Math.max(0, Number(a?.execute?.healAmount) || 20);
        if (game?.enemySystem?.enemies && Array.isArray(game.enemySystem.enemies)) {
          const src = enemy;
          const sx = src.position.x + src.size / 2;
          const sy = src.position.y + src.size / 2;
          for (const other of game.enemySystem.enemies) {
            if (!other || other === src) continue;
            if (other.isDead) continue;
            const ox = other.position.x + other.size / 2;
            const oy = other.position.y + other.size / 2;
            if (Math.hypot(ox - sx, oy - sy) <= r) {
              const until = (game.time || 0) + buffDuration;
              other._warcrySpeedUntil = Math.max(Number(other._warcrySpeedUntil) || 0, until);
              // (speedMult is currently fixed at 1.2 via Enemy.update; keep values in sync.)
              other._warcrySpeedMult = speedMult;
              if (healAmount > 0 && Number.isFinite(other.health) && Number.isFinite(other.maxHealth)) {
                other.health = Math.min(other.maxHealth, other.health + healAmount);
              }
            }
          }
        }
        return;
      }

      const circleImpactSprite = getCircleAttackImpactAnimatedSprite(attackId, r);
      if (circleImpactSprite && Array.isArray(game.skillEffects)) {
        game.skillEffects.push({
          type: "animatedSpriteImpact",
          x: impactX,
          y: impactY,
          t: 0,
          animatedSprite: { ...circleImpactSprite }
        });
      }

      if (typeof game.spawnEnemyCircleHitbox === "function") {
        game.spawnEnemyCircleHitbox(enemy, impactX, impactY, r, baseDmg, attackId);
        this._applyDebuffs(game, a);
      } else if (player) {
        const px = player.position.x + player.size / 2;
        const py = player.position.y + player.size / 2;
        if ((px - impactX) ** 2 + (py - impactY) ** 2 <= r * r) {
          game.onPlayerDamaged(baseDmg, true);
          game.lastDamagingEnemy = enemy;
          this._applyDebuffs(game, a);
        }
      }
    } else if (k === "whirlwind") {
      const a = payload.attack;
      const exec = a?.execute || {};
      const burstCount = Math.max(1, Math.floor(Number(exec.burstCount) || 3));
      const burstGap = Number.isFinite(Number(exec.burstGap)) ? Math.max(0, Number(exec.burstGap)) : 0.2;
      this._spawnOneWhirlwindPulse(game, payload);
      enemy._whirlwindPulsePayload = payload;
      if (burstCount > 1) {
        enemy._whirlwindBurstState = {
          remaining: burstCount - 1,
          nextAt: (game.time || 0) + burstGap,
          gap: burstGap
        };
      } else {
        enemy._whirlwindBurstState = null;
      }
    } else {
      return;
    }

    // Clear pending after spawn.
    this._pendingAnimationHitbox = null;
  }

  _spawnOneWhirlwindPulse(game, payload) {
    const enemy = this.enemy;
    const player = game.player;
    const a = payload.attack;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const r = payload.radius;
    const baseDmg = payload.baseDmg;
    const attackId = payload.attackId;
    const circleDur = Math.max(1, Number(payload.circleDurationMs) || 100);
    const exec = a?.execute || {};
    const scale = this.attackScale * (enemy.attack ?? 10) / 10;
    const bladeDmg = Math.round((Number(exec.bladeDamage ?? exec.damage ?? 1)) * scale);
    const speed = Math.max(80, Number(exec.bladeSpeed) || 380);
    const size = Math.max(4, Number(exec.bladeSize) || 12);
    const color = exec.bladeColor || "#bae6fd";
    const angle = Math.random() * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const vx = dirX * speed;
    const vy = dirY * speed;

    const circleImpactSprite = getCircleAttackImpactAnimatedSprite(attackId, r);
    if (circleImpactSprite && Array.isArray(game.skillEffects)) {
      game.skillEffects.push({
        type: "animatedSpriteImpact",
        x: ex,
        y: ey,
        t: 0,
        animatedSprite: { ...circleImpactSprite }
      });
    }

    const hitStunMs = Math.max(0, Number(exec.hitStunMs) || 0);
    if (typeof game.spawnEnemyCircleHitbox === "function") {
      game.spawnEnemyCircleHitbox(enemy, ex, ey, r, baseDmg, attackId, {
        durationMs: circleDur,
        hitStunMs: hitStunMs || undefined
      });
      this._applyDebuffs(game, a);
    } else if (player) {
      const px = player.position.x + player.size / 2;
      const py = player.position.y + player.size / 2;
      if ((px - ex) ** 2 + (py - ey) ** 2 <= r * r) {
        game.onPlayerDamaged(baseDmg, true);
        game.lastDamagingEnemy = enemy;
        this._applyDebuffs(game, a);
      }
    }

    if (exec.omitBlade === true) return;

    const bladeOpts = {
      lifetime: Number(exec.bladeLifetime) > 0 ? Number(exec.bladeLifetime) : 2.5,
      speed: Number(exec.bladeSpeed) > 0 ? Number(exec.bladeSpeed) : undefined,
      size: Number(exec.bladeSize) > 0 ? Number(exec.bladeSize) : undefined,
      color: exec.bladeColor,
      magicStyle: exec.magicStyle,
      animatedSprite: exec.animatedSprite,
      movementType: exec.movementType
    };
    const useHitbox = exec.useHitbox !== false && typeof game.spawnEnemyProjectileHitbox === "function";
    if (useHitbox) {
      game.spawnEnemyProjectileHitbox(ex, ey, dirX, dirY, bladeDmg, bladeOpts, enemy);
    } else if (typeof game.spawnEnemyProjectile === "function") {
      game.spawnEnemyProjectile(ex, ey, vx, vy, bladeDmg, size, color, bladeOpts, enemy);
    }
  }

  _tickWhirlwindScheduledBursts(game) {
    if (this.state !== "active" || this.currentAttack?.kind !== "whirlwind") return;
    const enemy = this.enemy;
    const st = enemy._whirlwindBurstState;
    const pl = enemy._whirlwindPulsePayload;
    if (!st || !pl || st.remaining <= 0) return;
    const now = game.time || 0;
    const gap = Math.max(0.001, Number(st.gap) || 0.2);
    while (st.remaining > 0 && now >= st.nextAt) {
      this._spawnOneWhirlwindPulse(game, pl);
      st.remaining--;
      st.nextAt += gap;
    }
  }

  _tickArrowRain(game) {
    const enemy = this.enemy;
    const st = enemy._arrowRainState;
    if (!st) return;
    if (enemy?.isDead) {
      enemy._arrowRainState = null;
      enemy._arrowRainUntil = null;
      return;
    }
    if (typeof game.spawnEnemyCircleHitbox !== "function") return;

    const now = game.time || 0;
    const intervalSec = Math.max(0.01, Number(st.intervalSec) || 0.2);
    const pulseDurationMs = Math.max(1, Number(st.pulseDurationMs) || Math.round(intervalSec * 1000));

    // Spawn multiple pulses if dt skips ahead.
    while (st.remainingPulses > 0 && now >= st.nextAt) {
      const px = st.centerX;
      const py = st.centerY;
      game.spawnEnemyCircleHitbox(
        enemy,
        px,
        py,
        st.radius,
        st.baseDmg,
        st.attackId,
        { durationMs: pulseDurationMs }
      );
      st.remainingPulses--;
      st.nextAt += intervalSec;
    }

    if (st.remainingPulses <= 0 || (Number.isFinite(st.untilAt) && now >= st.untilAt)) {
      enemy._arrowRainState = null;
      enemy._arrowRainUntil = null;
    }
  }

  _tickFireThrower(game) {
    const enemy = this.enemy;
    const st = enemy._fireThrowerState;
    if (!st) return;
    if (enemy?.isDead) {
      enemy._fireThrowerState = null;
      enemy._fireThrowerUntil = null;
      enemy._fireThrowerFreezeUntil = null;
      return;
    }
    if (typeof game.spawnEnemyConeHitbox !== "function") return;

    const now = game.time || 0;
    const intervalSec = Math.max(0.01, Number(st.intervalSec) || 0.2);

    while (st.remainingPulses > 0 && now >= st.nextAt) {
      game.spawnEnemyConeHitbox(enemy, st.ex, st.ey, st.dirX, st.dirY, st.range, st.arc, st.baseDmg, st.attackId);
      // (Debuffs for this kit are fine to apply repeatedly; this matches other repeated-hit patterns.)
      const a = this.currentAttack;
      if (a && a.id === st.attackId) this._applyDebuffs(game, a);
      st.remainingPulses--;
      st.nextAt += intervalSec;
    }

    if (st.remainingPulses <= 0 || (Number.isFinite(st.untilAt) && now >= st.untilAt)) {
      enemy._fireThrowerState = null;
      enemy._fireThrowerUntil = null;
      // Keep freezeUntil as-is; sprite FSM will unfreeze based on time.
    }
  }

  _tickEarthquake(game) {
    const enemy = this.enemy;
    const st = enemy._earthquakeState;
    if (!st) return;
    if (enemy?.isDead) {
      enemy._earthquakeState = null;
      enemy._earthquakeUntil = null;
      return;
    }
    if (typeof game.spawnEnemyCircleHitbox !== "function") return;

    const now = game.time || 0;
    const gapSec = Math.max(0.01, Number(st.gapSec) || 0.3);
    const pulseDurationMs = Math.max(1, Number(st.pulseDurationMs) || 140);
    while (st.nextIndex < st.radii.length && now >= st.nextAt) {
      const waveRadius = Math.max(4, Number(st.radii[st.nextIndex]) || 4);
      const exNow = enemy.position.x + enemy.size / 2;
      const eyNow = enemy.position.y + enemy.size / 2;
      if (Array.isArray(game.skillEffects)) {
        const vfxCfg = getAnimatedSpritePreset(st.vfxPreset || "smokeBurstRing", {
          drawWidth: Math.max(64, waveRadius * 2.2),
          drawHeight: Math.max(64, waveRadius * 2.2)
        });
        if (vfxCfg) {
          game.skillEffects.push({
            type: "animatedSpriteImpact",
            x: exNow,
            y: eyNow,
            t: 0,
            animatedSprite: vfxCfg
          });
        }
      }
      game.spawnEnemyCircleHitbox(enemy, exNow, eyNow, waveRadius, st.baseDmg, st.attackId, {
        durationMs: pulseDurationMs
      });
      st.nextIndex++;
      st.nextAt += gapSec;
    }

    if (st.nextIndex >= st.radii.length || (Number.isFinite(st.untilAt) && now >= st.untilAt + gapSec)) {
      enemy._earthquakeState = null;
      enemy._earthquakeUntil = null;
    }
  }

  _tickVolcanoEruption(game) {
    const enemy = this.enemy;
    const st = enemy._volcanoEruptionState;
    if (!st) return;
    if (enemy?.isDead) {
      enemy._volcanoEruptionState = null;
      enemy._volcanoEruptionUntil = null;
      return;
    }
    if (typeof game.spawnEnemyCircleHitbox !== "function") return;

    const now = game.time || 0;
    const gapSec = Math.max(0.001, Number(st.gapSec) || 0.05);
    const pulseDurationMs = Math.max(1, Number(st.pulseDurationMs) || 120);
    const spawnRadius = Math.max(0, Number(st.spawnRadius) || 400);

    while (st.remainingHits > 0 && now >= st.nextAt) {
      const exNow = enemy.position.x + enemy.size / 2;
      const eyNow = enemy.position.y + enemy.size / 2;
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * spawnRadius;
      const px = exNow + Math.cos(ang) * rr;
      const py = eyNow + Math.sin(ang) * rr;
      game.spawnEnemyCircleHitbox(enemy, px, py, st.radius, st.baseDmg, st.attackId, {
        durationMs: pulseDurationMs
      });
      st.remainingHits--;
      st.nextAt += gapSec;
    }

    if (st.remainingHits <= 0 || (Number.isFinite(st.untilAt) && now >= st.untilAt + gapSec)) {
      enemy._volcanoEruptionState = null;
      enemy._volcanoEruptionUntil = null;
    }
  }

  _execute(game) {
    const a = this.currentAttack;
    const enemy = this.enemy;
    const player = game.player;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const tx = this.targetSnapshot?.x ?? (player.position.x + player.size / 2);
    const ty = this.targetSnapshot?.y ?? (player.position.y + player.size / 2);
    const dx = tx - ex;
    const dy = ty - ey;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirAngle = Math.atan2(dirY, dirX);
    const scale = this.attackScale * (enemy.attack ?? 10) / 10;
    const baseDmg = Math.round((a.execute?.damage ?? 1) * scale);
    this.attackUses[a.id] = (this.attackUses[a.id] || 0) + 1;

    switch (a.kind) {
      case "cone": {
        const range = a.execute?.range ?? 80;
        const arc = a.execute?.arc ?? 90;
        const kb = a.execute?.knockback;
        const coneImpactSprite = getConeAttackImpactAnimatedSprite(a.id, range);
        if (coneImpactSprite && Array.isArray(game.skillEffects)) {
          game.skillEffects.push({
            type: 'animatedSpriteImpact',
            x: ex + dirX * (range * 0.45),
            y: ey + dirY * (range * 0.45),
            t: 0,
            angleRad: dirAngle,
            flipY: dirX < 0,
            animatedSprite: coneImpactSprite
          });
        }
        if ((a.id === "dragon_fire_breath" || a.id === "drake_fire_breath") && Array.isArray(game.skillEffects)) {
          const spriteAspect = 48 / 48;
          const loopDrawWidth = Math.max(120, range);
          const loopDrawHeight = loopDrawWidth * spriteAspect;
          const startDrawWidth = loopDrawWidth * 0.85;
          const startDrawHeight = startDrawWidth * spriteAspect;
          const centerX = ex + dirX * (range * 0.5);
          const centerY = ey + dirY * (range * 0.5) - (loopDrawHeight * 0.22);
          game.skillEffects.push({
            type: "enemyBreathVisual",
            variant: "fire",
            x: centerX,
            y: centerY,
            dirX,
            dirY,
            range,
            arcDeg: arc,
            t: 0,
            duration: a.id === "dragon_fire_breath" ? 0.95 : 0.85,
            fireStartSprite: {
              path: 'assets/Projectiles/Fire Effect 1/Fire Effect 1/Fire Breath SpriteSheet.png',
              frameWidth: 48,
              frameHeight: 48,
              frameCount: 3,
              columns: 4,
              fps: 12,
              loop: false,
              rotateWithVelocity: true,
              anchorX: 0.5,
              anchorY: 0.5,
              drawWidth: startDrawWidth,
              drawHeight: startDrawHeight
            },
            fireLoopSprite: {
              path: 'assets/Projectiles/Fire Effect 1/Fire Effect 1/Fire Breath SpriteSheet.png',
              frameWidth: 48,
              frameHeight: 48,
              frameCount: 4,
              startFrame: 4,
              columns: 4,
              fps: 14,
              loop: true,
              rotateWithVelocity: true,
              anchorX: 0.5,
              anchorY: 0.5,
              drawWidth: loopDrawWidth,
              drawHeight: loopDrawHeight
            },
            fireEndSprite: {
              path: 'assets/Projectiles/Fire Effect 1/Fire Effect 1/Fire Breath SpriteSheet.png',
              frameWidth: 48,
              frameHeight: 48,
              frameCount: 8,
              startFrame: 8,
              columns: 4,
              fps: 18,
              loop: false,
              rotateWithVelocity: true,
              anchorX: 0.5,
              anchorY: 0.5,
              drawWidth: loopDrawWidth,
              drawHeight: loopDrawHeight
            }
          });
        }
        if (typeof game.spawnEnemyConeHitbox === "function") {
          const coneOpts =
            kb != null && Number.isFinite(Number(kb)) ? { knockback: Number(kb) } : {};
          game.spawnEnemyConeHitbox(enemy, ex, ey, dirX, dirY, range, arc, baseDmg, a.id, coneOpts);
          if (a.id !== "banshee_scream") this._applyDebuffs(game, a);
        } else {
          const arcRad = (arc * Math.PI) / 180;
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          const pr = Math.max(2, (player.size || 0) * 0.5);
          if (this._isCircleInCone(ex, ey, dirAngle, range, arcRad, px, py, pr)) {
            game.onPlayerDamaged(baseDmg, true);
            game.lastDamagingEnemy = enemy;
            if (kb != null && Number.isFinite(Number(kb)) && typeof game.applyKnockback === "function") {
              game.applyKnockback("player", ex, ey, Number(kb));
            }
            this._applyDebuffs(game, a);
          }
        }
        {
          const animDur = Number(a.execute?.activeAnimDuration);
          if (Number.isFinite(animDur) && animDur > 0) {
            this._activeDurationOverride = Math.max(0.06, animDur);
          }
        }
        {
          const projDelay = Number(a.execute?.followupProjectileDelay);
          if (
            Number.isFinite(projDelay) &&
            projDelay >= 0 &&
            typeof game.addDelayedEnemyProjectile === "function"
          ) {
            const projSpeed = Math.max(40, Number(a.execute?.followupProjectileSpeed) || 240);
            const projDamage = Math.max(1, Math.round(Number(a.execute?.followupProjectileDamage) || baseDmg));
            const projSize = Math.max(8, Number(a.execute?.followupProjectileSize) || 28);
            const projColor = a.execute?.followupProjectileColor || "#94a3b8";
            const projOpts = {
              speed: projSpeed,
              size: projSize,
              color: projColor,
              useHitbox: true
            };
            game.addDelayedEnemyProjectile(
              (game.time || 0) + projDelay,
              ex,
              ey,
              dirX * projSpeed,
              dirY * projSpeed,
              projDamage,
              projSize,
              projColor,
              projOpts,
              enemy,
              { useHitbox: true }
            );
          }
        }
        {
          const sameStripHits = Math.max(1, Math.floor(Number(a.execute?.sameStripComboHits) || 1));
          if (sameStripHits > 1) {
            const sameStripGap = Math.max(0, Number(a.execute?.sameStripComboGap) || 0.05);
            this._sameStripConeCombo = {
              remaining: sameStripHits - 1,
              nextAt: (game.time || 0) + sameStripGap,
              gap: sameStripGap,
              range,
              arc,
              dirX,
              dirY,
              baseDmg,
              attackId: a.id,
              knockback: kb,
              attackRef: a
            };
          }
        }
        break;
      }
      case "frame_synced_circle": {
        const fps = Math.max(1, Number(a.execute?.animFps) || 14);
        const totalFrames = Math.max(1, Math.floor(Number(a.execute?.totalFrames) || 15));
        const dur = totalFrames / fps;
        const r = Math.max(24, Number(a.execute?.radius) || 120);
        const rawHits = Array.isArray(a.execute?.hitFrames) ? a.execute.hitFrames : [7, 10, 14];
        const hitFrames1Based = rawHits.map((n) => Math.max(1, Math.min(totalFrames, Math.floor(Number(n) || 0))));
        enemy._frameSyncedCircleHits = {
          damage: baseDmg,
          radius: r,
          attackId: a.id,
          fps,
          totalFrames,
          hitFrames1Based,
          fired: Object.create(null),
          duration: dur
        };
        this._activeDurationOverride = Math.max(0.06, dur);
        break;
      }
      case "circle": {
        const r = a.execute?.radius ?? 70;
        const circleImpactSprite = getCircleAttackImpactAnimatedSprite(a.id, r);
        const delayedCount = a.execute?.delayedCount ?? 1;
        const delay = a.execute?.delay ?? 0;
        const impactX = a.execute?.atTarget ? tx : ex;
        const impactY = a.execute?.atTarget ? ty : ey;
        const useHitbox = typeof game.spawnEnemyCircleHitbox === "function";
        if ((delayedCount > 1 || delay > 0) && game.addDelayedEnemyImpact) {
          const count = Math.max(1, delayedCount);
          for (let i = 0; i < count; i++) {
            const jitter = count > 1 ? 15 : 0;
            const ix = impactX + (Math.random() - 0.5) * jitter * 2;
            const iy = impactY + (Math.random() - 0.5) * jitter * 2;
            const atTime = game.time + (count > 1 ? delay * (i + 1) : delay);
            game.addDelayedEnemyImpact(
              atTime,
              ix,
              iy,
              r,
              Math.round(baseDmg / count),
              enemy,
              !!a.execute?.slowZone,
              a.execute?.slowDuration ?? 1.5,
              useHitbox ? a.id : null,
              circleImpactSprite ? { ...circleImpactSprite } : null
            );
          }
        } else if (useHitbox) {
          if (circleImpactSprite && Array.isArray(game.skillEffects)) {
            game.skillEffects.push({
              type: 'animatedSpriteImpact',
              x: impactX,
              y: impactY,
              t: 0,
              animatedSprite: { ...circleImpactSprite }
            });
          }
          game.spawnEnemyCircleHitbox(enemy, impactX, impactY, r, baseDmg, a.id, {
            slowZone: !!a.execute?.slowZone,
            slowDuration: a.execute?.slowDuration ?? 2
          });
        } else {
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          if ((px - impactX) ** 2 + (py - impactY) ** 2 <= r * r) {
            game.onPlayerDamaged(baseDmg, true);
            game.lastDamagingEnemy = enemy;
            this._applyDebuffs(game, a);
          }
          if (a.execute?.slowZone && game.hazardSystem) {
            game.hazardSystem.addTemporaryPatch("slowZone", impactX, impactY, r, a.execute.slowDuration ?? 2, 0, false, 0.6);
          }
        }
        break;
      }
      case "falling_rocks": {
        const r = a.execute?.radius ?? 48;
        const count = Math.max(1, a.execute?.count ?? 5);
        const impactDelay = Math.max(0, a.execute?.impactDelay ?? 1);
        const impactX = a.execute?.atTarget ? tx : ex;
        const impactY = a.execute?.atTarget ? ty : ey;
        const useHitbox = typeof game.spawnEnemyCircleHitbox === "function";
        if (game.addDelayedEnemyImpact) {
          const jitter = 35;
          for (let i = 0; i < count; i++) {
            const ix = impactX + (Math.random() - 0.5) * jitter * 2;
            const iy = impactY + (Math.random() - 0.5) * jitter * 2;
            const atTime = game.time + impactDelay;
            game.addDelayedEnemyImpact(atTime, ix, iy, r, Math.round(baseDmg / count), enemy, false, 0, useHitbox ? a.id : null);
          }
        }
        break;
      }
      case "ring": {
        const inner = a.execute?.innerRadius ?? 40;
        const outer = a.execute?.outerRadius ?? 100;
        const impactX = a.execute?.atTarget ? tx : ex;
        const impactY = a.execute?.atTarget ? ty : ey;
        const useHitbox = typeof game.spawnEnemyRingHitbox === "function";
        if (useHitbox) {
          game.spawnEnemyRingHitbox(enemy, impactX, impactY, inner, outer, baseDmg, a.id, {
            slowZone: !!a.execute?.slowZone,
            slowDuration: a.execute?.slowDuration ?? 2
          });
        } else {
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          const d2 = (px - impactX) ** 2 + (py - impactY) ** 2;
          if (d2 >= inner * inner && d2 <= outer * outer) {
            game.onPlayerDamaged(baseDmg, true);
            game.lastDamagingEnemy = enemy;
            this._applyDebuffs(game, a);
          }
          if (a.execute?.slowZone && game.hazardSystem) {
            game.hazardSystem.addTemporaryPatch("slowZone", impactX, impactY, outer, a.execute.slowDuration ?? 2, 0, false, 0.6);
          }
        }
        break;
      }
      case "line": {
        const len = a.execute?.length ?? 120;
        const lineWidth = a.execute?.width ?? 30;
        if (typeof game.spawnEnemyRectHitbox === "function") {
          game.spawnEnemyRectHitbox(enemy, ex, ey, dirX, dirY, len, lineWidth, baseDmg, a.id);
          this._applyDebuffs(game, a);
        } else {
          const halfW = lineWidth / 2;
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          const t = (px - ex) * dirX + (py - ey) * dirY;
          const perp = Math.abs((px - ex) * dirY - (py - ey) * dirX);
          if (t >= 0 && t <= len && perp <= halfW + player.size / 2) {
            game.onPlayerDamaged(baseDmg, true);
            game.lastDamagingEnemy = enemy;
            this._applyDebuffs(game, a);
          }
        }
        break;
      }
      case "dash": {
        const dashDist = a.execute?.dashDist ?? 120;
        const dashSpeed = a.execute?.dashSpeed ?? 400;
        this.dashDir = { x: dirX, y: dirY };
        this.dashTotalDist = dashDist;
        this.dashTraveled = 0;
        this.dashHitApplied = false;
        enemy._attackDashState = {
          dirX,
          dirY,
          dist: dashDist,
          speed: dashSpeed,
          traveled: 0,
          homingTurnRate: Math.max(0, Number(a.execute?.homingTurnRate) || 0)
        };
        if (typeof game.spawnEnemyDashHitbox === "function") {
          const durationMs = Math.max(500, (dashDist / Math.max(1, dashSpeed)) * 1000 + 400);
          game.spawnEnemyDashHitbox(enemy, baseDmg, a.id, durationMs);
        }
        break;
      }
      case "roll": {
        enemy._attackRollState = {
          dirX,
          dirY,
          speed: Math.max(60, Number(a.execute?.speed) || 420),
          duration: Math.max(0.2, Number(a.execute?.duration) || 5),
          elapsed: 0,
          hitInterval: Math.max(0.05, Number(a.execute?.hitInterval) || 0.25),
          hitTimer: 0,
          damage: Math.max(1, baseDmg),
          bounceHoming: Math.max(0, Math.min(1, Number(a.execute?.bounceHoming) || 0.4)),
          bounceHomingTurnRate: Math.max(0, Number(a.execute?.bounceHomingTurnRate) || 2.8),
          endAnimDuration: Math.max(0, Number(a.execute?.postEndAnimDuration) || 0.42),
          postCooldown: Math.max(0, Number(a.execute?.postCooldown) || 5),
          attackId: a.id
        };
        break;
      }
      case "cyclone": {
        enemy._cycloneState = {
          elapsed: 0,
          duration: Math.max(0.3, Number(a.execute?.duration) || 3.0),
          radius: Math.max(20, Number(a.execute?.radius) || 160),
          dps: Math.max(0.1, Number(a.execute?.dps) || 1),
          moveSpeed: Math.max(0, Number(a.execute?.moveSpeed) || 90),
          hitInterval: Math.max(0.05, Number(a.execute?.hitInterval) || 1.0),
          hitTimer: Math.max(0.05, Number(a.execute?.hitInterval) || 1.0),
          postEndAnimDuration: Math.max(0, Number(a.execute?.postEndAnimDuration) || 0.5)
        };
        this._activeDurationOverride = enemy._cycloneState.duration;
        break;
      }
      case "burp_summon": {
        game.spawnLargeFrogSpit?.(enemy, tx, ty, Math.max(1, baseDmg), a.execute || {});
        break;
      }
      case "projectile": {
        const execProj = a.execute || {};
        if (
          execProj.hitboxTrigger != null &&
          Number.isInteger(Number(execProj.hitboxTrigger)) &&
          execProj.projectileSpawnWindupT == null
        ) {
          break;
        }
        const speed = (a.execute?.speed ?? 280) * (this.attackScale > 1.2 ? 1.1 : 1);
        const count = a.execute?.count ?? 1;
        const spread = (a.execute?.spread ?? 0) * (Math.PI / 180);
        const color = a.execute?.color ?? "#a855f7";
        const size = a.execute?.size ?? 12;
        const burstCount = Math.max(1, Number(a.execute?.burstCount) || 1);
        const burstInterval = Math.max(0, Number(a.execute?.burstInterval) || 0.1);
        const volleyCount = a.execute?.volleyCount;
        const randomSpreadDeg = a.execute?.randomSpreadDeg ?? 0;
        const arcSpreadDeg = a.execute?.arcSpreadDeg;
        const spiralOpposite = a.execute?.spiralOpposite;
        const spiralSpreadDeg = a.execute?.spiralSpreadDeg;
        const backstepChain = a.execute?.backstepChain;
        const spinSequence8Way = a.execute?.spinSequence8Way === true;

        if (spinSequence8Way) {
          const shotCount = Math.max(1, Math.floor(Number(a.execute?.spinCount) || 8));
          const startDeg = Number(a.execute?.spinStartDeg) || 45;
          const stepDeg = Number(a.execute?.spinStepDeg) || 45;
          const interval = Math.max(0, Number(a.execute?.spinFrameInterval) || (1 / 14));
          const useHitbox = a.execute?.useHitbox === true && typeof game.spawnEnemyProjectileHitbox === "function";
          for (let i = 0; i < shotCount; i++) {
            const ang = (startDeg + stepDeg * i) * (Math.PI / 180);
            const vx = Math.cos(ang) * speed;
            const vy = Math.sin(ang) * speed;
            const shotAt = interval * i;
            if (i === 0) {
              if (useHitbox) {
                game.spawnEnemyProjectileHitbox(ex, ey, Math.cos(ang), Math.sin(ang), baseDmg, a.execute, enemy);
              } else {
                game.spawnEnemyProjectile(ex, ey, vx, vy, baseDmg, size, color, a.execute, enemy);
              }
            } else if (typeof game.addDelayedEnemyProjectile === "function") {
              game.addDelayedEnemyProjectile(game.time + shotAt, ex, ey, vx, vy, baseDmg, size, color, a.execute, enemy, { useHitbox });
            } else {
              if (useHitbox) {
                game.spawnEnemyProjectileHitbox(ex, ey, Math.cos(ang), Math.sin(ang), baseDmg, a.execute, enemy);
              } else {
                game.spawnEnemyProjectile(ex, ey, vx, vy, baseDmg, size, color, a.execute, enemy);
              }
            }
          }
          break;
        }

        if (backstepChain) {
          enemy._attackBackstepChainState = {
            dirX,
            dirY,
            backstepDist: a.execute.backstepDist ?? 100,
            backstepDuration: a.execute.backstepDuration ?? 1,
            attack: a,
            baseDmg,
            speed,
            size,
            color,
            execute: a.execute,
            shot2Fired: false
          };
          this._activeDurationOverride = (a.execute.backstepDuration ?? 1) * 2 + (a.execute.chainRecover ?? 0.5);
        }

        const spawnOne = (sx, sy, angle, dmg, opts, atTime) => {
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          const useHitbox = opts?.useHitbox === true && typeof game.spawnEnemyProjectileHitbox === "function";
          const delayedOpts = {
            useHitbox,
            aimAtPlayerOnFire: opts?.retargetOnBurst === true
          };
          if (atTime == null || atTime <= 0) {
            if (useHitbox) {
              game.spawnEnemyProjectileHitbox(sx, sy, Math.cos(angle), Math.sin(angle), dmg, opts, enemy);
            } else {
              game.spawnEnemyProjectile(sx, sy, vx, vy, dmg, size, color, opts, enemy);
            }
          } else if (typeof game.addDelayedEnemyProjectile === "function") {
            game.addDelayedEnemyProjectile(game.time + atTime, sx, sy, vx, vy, dmg, size, color, opts, enemy, delayedOpts);
          } else {
            if (useHitbox) {
              game.spawnEnemyProjectileHitbox(sx, sy, Math.cos(angle), Math.sin(angle), dmg, opts, enemy);
            } else {
              game.spawnEnemyProjectile(sx, sy, vx, vy, dmg, size, color, opts, enemy);
            }
          }
        };

        if (volleyCount && randomSpreadDeg > 0) {
          const halfSpreadRad = (randomSpreadDeg * 0.5 * Math.PI) / 180;
          const burstSize = Math.max(1, Number(a.execute?.volleyBurstSize) || volleyCount);
          const burstInterval = Number(a.execute?.volleyBurstInterval) || 0;
          for (let i = 0; i < volleyCount; i++) {
            const angle = dirAngle + (Math.random() - 0.5) * 2 * halfSpreadRad;
            const burstIndex = Math.floor(i / burstSize);
            const delay = burstInterval * burstIndex;
            spawnOne(ex, ey, angle, baseDmg, a.execute, delay);
          }
        } else if (spiralOpposite && count === 2) {
          const opts0 = { ...a.execute, movementType: "spiral", spiralDirection: 1 };
          const opts1 = { ...a.execute, movementType: "spiral", spiralDirection: -1 };
          spawnOne(ex, ey, dirAngle, baseDmg, opts0, 0);
          spawnOne(ex, ey, dirAngle, baseDmg, opts1, 0);
        } else if (spiralSpreadDeg != null && count === 2) {
          const offsetRad = (spiralSpreadDeg * Math.PI) / 180;
          const opts0 = { ...a.execute, movementType: "spiral", spiralDirection: 1 };
          const opts1 = { ...a.execute, movementType: "spiral", spiralDirection: -1 };
          spawnOne(ex, ey, dirAngle + offsetRad, baseDmg, opts0, 0);
          spawnOne(ex, ey, dirAngle - offsetRad, baseDmg, opts1, 0);
        } else if (arcSpreadDeg != null && count > 1) {
          const arcRad = (arcSpreadDeg * Math.PI) / 180;
          const startAngle = dirAngle - arcRad * 0.5;
          const step = count > 1 ? arcRad / (count - 1) : 0;
          const zigzagPhaseStepRad = Number(a.execute?.zigzagPhaseStepRad) || 0;
          for (let i = 0; i < count; i++) {
            const angle = startAngle + step * i;
            const opts = zigzagPhaseStepRad !== 0
              ? { ...a.execute, zigzagPhaseOffset: (i - (count - 1) / 2) * zigzagPhaseStepRad }
              : a.execute;
            spawnOne(ex, ey, angle, baseDmg, opts, 0);
          }
        } else if (a.execute?.comboShots) {
          spawnOne(ex, ey, dirAngle, baseDmg, a.execute, 0);
        } else {
          const useHitbox = a.execute?.useHitbox === true && typeof game.spawnEnemyProjectileHitbox === "function";
          const zigzagPhaseStepRad = Number(a.execute?.zigzagPhaseStepRad) || 0;
          for (let b = 0; b < burstCount; b++) {
            const shotAt = burstInterval * b;
            for (let i = 0; i < count; i++) {
              let angle = dirAngle;
              if (count > 1 && spread > 0) {
                const offset = (i - (count - 1) / 2) * spread;
                angle = dirAngle + offset;
              }
              const opts = zigzagPhaseStepRad !== 0
                ? { ...a.execute, zigzagPhaseOffset: (i - (count - 1) / 2) * zigzagPhaseStepRad }
                : a.execute;
              const vx = Math.cos(angle) * speed;
              const vy = Math.sin(angle) * speed;
              if (b === 0) {
                if (useHitbox) {
                  game.spawnEnemyProjectileHitbox(ex, ey, Math.cos(angle), Math.sin(angle), baseDmg, opts, enemy);
                } else {
                  game.spawnEnemyProjectile(ex, ey, vx, vy, baseDmg, size, color, opts, enemy);
                }
              } else if (typeof game.addDelayedEnemyProjectile === "function") {
                game.addDelayedEnemyProjectile(game.time + shotAt, ex, ey, vx, vy, baseDmg, size, color, opts, enemy, {
                  useHitbox,
                  aimAtPlayerOnFire: opts?.retargetOnBurst === true
                });
              } else {
                if (useHitbox) {
                  game.spawnEnemyProjectileHitbox(ex, ey, Math.cos(angle), Math.sin(angle), baseDmg, opts, enemy);
                } else {
                  game.spawnEnemyProjectile(ex, ey, vx, vy, baseDmg, size, color, opts, enemy);
                }
              }
            }
          }
        }

        if (backstepChain) {
          const state = enemy._attackBackstepChainState;
          if (state) state.dirX = dirX;
          if (state) state.dirY = dirY;
        }
        break;
      }
      case "summon": {
        const exec = a.execute || {};
        if (exec.hitboxTrigger != null && Number.isInteger(Number(exec.hitboxTrigger))) {
          break;
        }
        const spawnCount = exec.count ?? 2;
        const spawnType = exec.spawnType ?? "m_3a_small_slime";
        for (let i = 0; i < spawnCount; i++) {
          const angle = (i / spawnCount) * Math.PI * 2 + Math.random() * 0.5;
          const off = 40 + Math.random() * 30;
          const sx = ex + Math.cos(angle) * off - 43;
          const sy = ey + Math.sin(angle) * off - 43;
          game.spawnEnemyMinion?.(sx, sy, spawnType);
        }
        break;
      }
      case "teleport": {
        const backDist = a.execute?.backDist ?? 100;
        enemy.position.x = ex - dirX * backDist - enemy.size / 2;
        enemy.position.y = ey - dirY * backDist - enemy.size / 2;
        this.phaseUntil = game.time + (a.execute?.invulnDuration ?? 0.3);
        break;
      }
      case "shield":
      case "armor": {
        enemy._armorUntil = game.time + (a.execute?.duration ?? 3);
        enemy._armorMult = a.execute?.damageMult ?? 0.5;
        break;
      }
      case "regen_channel": {
        enemy.regenChannelUntil = game.time + (a.execute?.duration ?? 2.5);
        enemy.regenChannelRate = a.execute?.regenRate ?? 15;
        enemy.regenBreakDamage = 0;
        enemy.regenBreakThreshold = a.execute?.breakDamage ?? 50;
        this.regenChannelUntil = game.time + (a.execute?.duration ?? 2.5);
        break;
      }
      case "heal": {
        const healRange = a.execute?.healRange ?? 120;
        const healPct = a.execute?.healAmount ?? 0.35;
        const squadId = enemy.squadId;
        const allies = (game.enemySystem?.enemies ?? []).filter(
          (e) => e !== enemy && !e.isDead && e.squadId === squadId
        );
        let target = null;
        for (const ally of allies) {
          if (ally.health / ally.maxHealth < 0.7) {
            const dist = Math.sqrt((ally.position.x + ally.size / 2 - ex) ** 2 + (ally.position.y + ally.size / 2 - ey) ** 2);
            if (dist <= healRange && (!target || ally.health < target.health)) target = ally;
          }
        }
        const selfHeal = Math.max(1, Math.round(enemy.maxHealth * healPct));
        enemy.health = Math.min(enemy.maxHealth, enemy.health + selfHeal);
        if (target) {
          const heal = Math.max(1, Math.round(target.maxHealth * healPct));
          target.health = Math.min(target.maxHealth, target.health + heal);
        }
        break;
      }
      case "jump_slam": {
        enemy._jumpSlamState = {
          targetX: tx,
          targetY: ty,
          startX: ex,
          startY: ey,
          t: 0,
          duration: Math.max(0.12, Number(a.execute?.duration) || 0.25),
          radius: a.execute?.radius ?? 80,
          jumpHeight: Math.max(0, Number(a.execute?.jumpHeight) || 80),
          recoverAnimDuration: Math.max(0, Number(a.execute?.recoverAnimDuration) || 0)
        };
        break;
      }
      case "timed_double_cone": {
        const duration = Math.max(0.05, Number(a.execute?.duration) || 1.0);
        enemy._timedDoubleConeState = {
          elapsed: 0,
          duration,
          firstHitTime: Math.max(0, Number(a.execute?.firstHitTime) || 0.7),
          secondHitTime: Math.max(0, Number(a.execute?.secondHitTime) || 0.9),
          firstHitDone: false,
          secondHitDone: false,
          damage: Math.max(1, baseDmg),
          firstCone: {
            range: Math.max(20, Number(a.execute?.firstCone?.range) || 170),
            arc: Math.max(1, Number(a.execute?.firstCone?.arc) || 42),
            angleOffsetDeg: Number(a.execute?.firstCone?.angleOffsetDeg) || -24
          },
          secondCone: {
            range: Math.max(20, Number(a.execute?.secondCone?.range) || 170),
            arc: Math.max(1, Number(a.execute?.secondCone?.arc) || 42),
            angleOffsetDeg: Number(a.execute?.secondCone?.angleOffsetDeg) || 24
          },
          baseDirAngle: dirAngle
        };
        this._activeDurationOverride = duration;
        break;
      }
      default:
        break;
    }

    // Orc rage at 40% hp
    if (a.id === "orc_cleave" && enemy.name === "Orc" && enemy.enemyTier === "miniBoss") {
      if (enemy.health / enemy.maxHealth <= 0.4 && !this.rageUntil) {
        this.rageUntil = game.time + 8;
      }
    }
    // Orc Wizard teleport at low hp
    if (a.id === "orc_wizard_fireball" && enemy.name === "Orc Wizard" && enemy.enemyTier === "miniBoss") {
      if (enemy.health / enemy.maxHealth < 0.3 && (this.cooldowns["orc_wizard_teleport"] ?? 0) <= 0) {
        this.currentAttack = this.availableAttacks.find((x) => x.id === "orc_wizard_teleport") || a;
        this._execute(game);
        this.cooldowns["orc_wizard_teleport"] = 12;
      }
    }
    // Banshee phase
    if (a.id === "banshee_scream" && enemy.name === "Banshee" && enemy.enemyTier === "miniBoss") {
      this.phaseUntil = game.time + 0.6;
    }
    // Lich phase shift (optional - on big damage would need to be triggered elsewhere)
  }

  _applyDebuffs(game, a) {
    const exec = a.execute;
    if (!exec) return;
    if (exec.slow) {
      game.applyStatusToEntity?.('player', 'slow', {
        duration: exec.slowDuration ?? 1.5,
        magnitude: 1 - (exec.slow ?? 0.3),
        sourceId: this.enemy?.id ?? null,
        sourceType: 'enemy_attack'
      });
    }
  }

  _isCircleInCone(originX, originY, dirAngle, range, arcRad, targetX, targetY, targetRadius) {
    const dx = targetX - originX;
    const dy = targetY - originY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0;
    const radius = Math.max(0, Number(targetRadius) || 0);
    if (dist > range + radius) return false;
    if (dist <= radius) return true;

    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - dirAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const halfArc = arcRad * 0.5;
    if (Math.abs(diff) <= halfArc) return true;
    const angularPad = Math.asin(Math.min(1, radius / dist));
    return Math.abs(diff) <= (halfArc + angularPad);
  }

  updateDash(dt, game) {
    const enemy = this.enemy;
    const dash = enemy._attackDashState;
    if (!dash) return;

    if ((dash.homingTurnRate || 0) > 0 && game.player) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const px = game.player.position.x + game.player.size / 2;
      const py = game.player.position.y + game.player.size / 2;
      const toPlayerX = px - ex;
      const toPlayerY = py - ey;
      const toPlayerLen = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY) || 1;
      const desiredX = toPlayerX / toPlayerLen;
      const desiredY = toPlayerY / toPlayerLen;

      const curLen = Math.sqrt(dash.dirX * dash.dirX + dash.dirY * dash.dirY) || 1;
      const curX = dash.dirX / curLen;
      const curY = dash.dirY / curLen;

      const dot = Math.max(-1, Math.min(1, curX * desiredX + curY * desiredY));
      const angle = Math.acos(dot);
      if (angle > 1e-4) {
        const maxTurn = dash.homingTurnRate * dt;
        const blend = Math.min(1, maxTurn / angle);
        const mixX = curX * (1 - blend) + desiredX * blend;
        const mixY = curY * (1 - blend) + desiredY * blend;
        const mixLen = Math.sqrt(mixX * mixX + mixY * mixY) || 1;
        dash.dirX = mixX / mixLen;
        dash.dirY = mixY / mixLen;
      }
    }

    const move = Math.min(dash.dist - dash.traveled, dash.speed * dt);
    enemy.position.x += dash.dirX * move;
    enemy.position.y += dash.dirY * move;
    dash.traveled += move;

    if (typeof game.spawnEnemyDashHitbox !== "function") {
      if (!this.dashHitApplied && enemy.intersects(game.player)) {
        this.dashHitApplied = true;
        const dmg = Math.round((this.currentAttack?.execute?.damage ?? 1) * this.attackScale * (enemy.attack ?? 10) / 10);
        game.onPlayerDamaged(dmg, true);
        game.lastDamagingEnemy = enemy;
      }
    }

    if (dash.traveled >= dash.dist) {
      enemy._attackDashState = null;
    }
  }

  _isPlayerInCone(game, originX, originY, dirAngle, range, arcDeg) {
    const player = game.player;
    if (!player) return false;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const pr = Math.max(2, (player.size || 0) * 0.5);
    const arc = (arcDeg * Math.PI) / 180;
    return this._isCircleInCone(originX, originY, dirAngle, range, arc, px, py, pr);
  }

  _applyTimedDoubleConeHit(game, timedState, coneDef) {
    const enemy = this.enemy;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const coneAngle = timedState.baseDirAngle + ((coneDef.angleOffsetDeg || 0) * Math.PI / 180);
    const dirX = Math.cos(coneAngle);
    const dirY = Math.sin(coneAngle);
    if (typeof game.spawnEnemyConeHitbox === "function") {
      game.spawnEnemyConeHitbox(enemy, ex, ey, dirX, dirY, coneDef.range, coneDef.arc, timedState.damage, "monster_slasher_full_combo");
    } else if (this._isPlayerInCone(game, ex, ey, coneAngle, coneDef.range, coneDef.arc)) {
      game.onPlayerDamaged(timedState.damage, true);
      game.lastDamagingEnemy = enemy;
      this._applyDebuffs(game, this.currentAttack || {});
    }
  }

  _enemyMoveRect(x, y) {
    const enemy = this.enemy;
    const hitW = Math.max(4, enemy.size * 0.5);
    const hitH = Math.max(4, enemy.size * 0.5);
    const hitOffX = (enemy.size - hitW) / 2;
    const hitOffY = (enemy.size - hitH) / 2;
    return { x: x + hitOffX, y: y + hitOffY, w: hitW, h: hitH };
  }

  _rectIntersects(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  _collidesWorldAt(x, y, game) {
    const enemy = this.enemy;
    const rect = this._enemyMoveRect(x, y);
    const worldW = game.world?.width ?? 3600;
    const worldH = game.world?.height ?? 900;
    const wallMargin = Math.max(
      0,
      Number(game.world?.wallCollisionThickness ?? game.world?.wallThickness ?? 0) || 0
    );
    const minX = wallMargin;
    const minY = wallMargin;
    const maxX = worldW - wallMargin;
    const maxY = worldH - wallMargin;
    if (x < minX || y < minY || x + enemy.size > maxX || y + enemy.size > maxY) return true;

    const tileWalls = game.world?.tileWallRects || [];
    for (const wall of tileWalls) {
      const wallRect = getWallCollisionRect(wall);
      if (this._rectIntersects(rect, wallRect)) return true;
    }

    const obstacles = game.obstacles || [];
    for (const obstacle of obstacles) {
      if (!obstacle || obstacle.destroyed || !obstacle.blocksMovement) continue;
      if (obstacleIntersectsRect(obstacle, rect)) return true;
      const obstacleRect = getObstacleCollisionRect(obstacle);
      if (this._rectIntersects(rect, obstacleRect)) return true;
    }

    return false;
  }

  _homeDirectionTowardPlayer(dirX, dirY, dt, game, amount, turnRate) {
    if (!game.player) return { x: dirX, y: dirY };
    const enemy = this.enemy;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const toPX = px - ex;
    const toPY = py - ey;
    const toPLen = Math.sqrt(toPX * toPX + toPY * toPY) || 1;
    const targetX = toPX / toPLen;
    const targetY = toPY / toPLen;

    const curLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const curX = dirX / curLen;
    const curY = dirY / curLen;

    const dot = Math.max(-1, Math.min(1, curX * targetX + curY * targetY));
    const angle = Math.acos(dot);
    if (angle <= 1e-4) return { x: curX, y: curY };

    const maxTurn = Math.max(0, turnRate) * dt;
    const turnBlend = Math.min(1, maxTurn / angle);
    const blend = Math.max(0, Math.min(1, amount)) * turnBlend;
    const mixX = curX * (1 - blend) + targetX * blend;
    const mixY = curY * (1 - blend) + targetY * blend;
    const mixLen = Math.sqrt(mixX * mixX + mixY * mixY) || 1;
    return { x: mixX / mixLen, y: mixY / mixLen };
  }

  updateRoll(dt, game) {
    const enemy = this.enemy;
    const roll = enemy._attackRollState;
    if (!roll) return;

    roll.elapsed += dt;
    if (roll.elapsed >= roll.duration) {
      enemy._attackRollState = null;
      enemy._attackRollEndTimer = Math.max(enemy._attackRollEndTimer || 0, roll.endAnimDuration || 0.42);
      if (roll.attackId) this.cooldowns[roll.attackId] = Math.max(this.cooldowns[roll.attackId] || 0, roll.postCooldown || 5);
      return;
    }

    let remaining = Math.max(0, roll.speed * dt);
    const maxStep = 16;
    while (remaining > 0) {
      const step = Math.min(maxStep, remaining);
      remaining -= step;

      let bounced = false;

      const nextX = enemy.position.x + roll.dirX * step;
      if (!this._collidesWorldAt(nextX, enemy.position.y, game)) {
        enemy.position.x = nextX;
      } else {
        roll.dirX *= -1;
        bounced = true;
      }

      const nextY = enemy.position.y + roll.dirY * step;
      if (!this._collidesWorldAt(enemy.position.x, nextY, game)) {
        enemy.position.y = nextY;
      } else {
        roll.dirY *= -1;
        bounced = true;
      }

      if (bounced) {
        const homed = this._homeDirectionTowardPlayer(
          roll.dirX,
          roll.dirY,
          dt,
          game,
          roll.bounceHoming,
          roll.bounceHomingTurnRate
        );
        roll.dirX = homed.x;
        roll.dirY = homed.y;
      }
    }

    roll.hitTimer -= dt;
    if (roll.hitTimer <= 0 && game.player && enemy.intersects(game.player)) {
      roll.hitTimer = roll.hitInterval;
      game.onPlayerDamaged(roll.damage, true);
      game.lastDamagingEnemy = enemy;
    }
  }

  updateJumpSlam(dt, game) {
    const enemy = this.enemy;
    const js = enemy._jumpSlamState;
    if (!js) return;

    js.t += dt;
    const progress = Math.min(1, js.t / js.duration);
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;

    if (progress < 1) {
      const x = js.startX + (js.targetX - js.startX) * progress;
      const jumpHeight = js.jumpHeight ?? 80;
      const y = js.startY + (js.targetY - js.startY) * progress - jumpHeight * Math.sin(progress * Math.PI);
      enemy.position.x = x - enemy.size / 2;
      enemy.position.y = y - enemy.size / 2;
    } else {
      const dmg = Math.round((this.currentAttack?.execute?.damage ?? 1) * this.attackScale * (enemy.attack ?? 10) / 10);
      if (typeof game.spawnEnemyCircleHitbox === "function") {
        game.spawnEnemyCircleHitbox(enemy, js.targetX, js.targetY, js.radius, dmg, this.currentAttack?.id || "jump_slam");
      } else {
        const px = game.player.position.x + game.player.size / 2;
        const py = game.player.position.y + game.player.size / 2;
        if ((px - js.targetX) ** 2 + (py - js.targetY) ** 2 <= js.radius * js.radius) {
          game.onPlayerDamaged(dmg, true);
          game.lastDamagingEnemy = enemy;
        }
      }
      game.hazardSystem?.addTemporaryPatch?.("slamGround", js.targetX, js.targetY, js.radius * 0.5, 0.5, 0, false);
      if ((js.recoverAnimDuration || 0) > 0 && enemy.enemyTypeId === "m_5v_monsteryfly") {
        enemy._monsterflyRecoverTimer = Math.max(enemy._monsterflyRecoverTimer || 0, js.recoverAnimDuration);
      }
      enemy._jumpSlamState = null;
    }
  }

  updateCyclone(dt, game) {
    const enemy = this.enemy;
    const cyclone = enemy._cycloneState;
    if (!cyclone) return;

    cyclone.elapsed += dt;

    if (game.player && cyclone.moveSpeed > 0) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const px = game.player.position.x + game.player.size / 2;
      const py = game.player.position.y + game.player.size / 2;
      const dx = px - ex;
      const dy = py - ey;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const dirX = dx / len;
      const dirY = dy / len;
      const move = cyclone.moveSpeed * dt;

      const nextX = enemy.position.x + dirX * move;
      if (!this._collidesWorldAt(nextX, enemy.position.y, game)) {
        enemy.position.x = nextX;
      }
      const nextY = enemy.position.y + dirY * move;
      if (!this._collidesWorldAt(enemy.position.x, nextY, game)) {
        enemy.position.y = nextY;
      }
    }

    cyclone.hitTimer -= dt;
    if (cyclone.hitTimer <= 0 && game.player) {
      cyclone.hitTimer += cyclone.hitInterval;
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const tickDamage = Math.max(1, Math.round(cyclone.dps * cyclone.hitInterval));
      if (typeof game.spawnEnemyCircleHitbox === "function") {
        game.spawnEnemyCircleHitbox(enemy, ex, ey, cyclone.radius, tickDamage, "mercenary_cyclone");
      } else {
        const px = game.player.position.x + game.player.size / 2;
        const py = game.player.position.y + game.player.size / 2;
        if ((px - ex) ** 2 + (py - ey) ** 2 <= cyclone.radius * cyclone.radius) {
          game.onPlayerDamaged(tickDamage, true);
          game.lastDamagingEnemy = enemy;
        }
      }
    }

    if (cyclone.elapsed >= cyclone.duration) {
      enemy._cycloneState = null;
      enemy._cycloneEndTimer = Math.max(enemy._cycloneEndTimer || 0, cyclone.postEndAnimDuration || 0.5);
    }
  }

  updateTimedDoubleCone(dt, game) {
    const enemy = this.enemy;
    const timed = enemy._timedDoubleConeState;
    if (!timed) return;

    timed.elapsed += dt;

    if (!timed.firstHitDone && timed.elapsed >= timed.firstHitTime) {
      timed.firstHitDone = true;
      this._applyTimedDoubleConeHit(game, timed, timed.firstCone);
    }
    if (!timed.secondHitDone && timed.elapsed >= timed.secondHitTime) {
      timed.secondHitDone = true;
      this._applyTimedDoubleConeHit(game, timed, timed.secondCone);
    }

    if (timed.elapsed >= timed.duration) {
      enemy._timedDoubleConeState = null;
    }
  }

  _tickFrameSyncedCircleHits(game) {
    const enemy = this.enemy;
    const st = enemy._frameSyncedCircleHits;
    if (!st || !this.currentAttack || this.state !== "active") return;
    const D = st.duration;
    const remaining = Math.max(0, Number(this.timer) || 0);
    const elapsed = Math.max(0, D - remaining);
    const idx1 = Math.min(st.totalFrames, Math.floor(elapsed * st.fps) + 1);
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    for (const hf of st.hitFrames1Based) {
      if (st.fired[hf] || idx1 < hf) continue;
      st.fired[hf] = true;
      if (typeof game.spawnEnemyCircleHitbox === "function") {
        game.spawnEnemyCircleHitbox(enemy, ex, ey, st.radius, st.damage, st.attackId);
      } else if (game.player) {
        const px = game.player.position.x + game.player.size / 2;
        const py = game.player.position.y + game.player.size / 2;
        if ((px - ex) ** 2 + (py - ey) ** 2 <= st.radius * st.radius) {
          game.onPlayerDamaged(st.damage, true);
          game.lastDamagingEnemy = enemy;
        }
      }
      this._applyDebuffs(game, this.currentAttack);
    }
  }

  _tickSameStripConeCombo(game) {
    if (this.state !== "active") return;
    const combo = this._sameStripConeCombo;
    if (!combo || combo.remaining <= 0) return;
    const enemy = this.enemy;
    const now = game.time || 0;
    while (combo.remaining > 0 && now >= combo.nextAt) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      if (typeof game.spawnEnemyConeHitbox === "function") {
        const coneOpts =
          combo.knockback != null && Number.isFinite(Number(combo.knockback))
            ? { knockback: Number(combo.knockback) }
            : {};
        game.spawnEnemyConeHitbox(
          enemy,
          ex,
          ey,
          combo.dirX,
          combo.dirY,
          combo.range,
          combo.arc,
          combo.baseDmg,
          combo.attackId,
          coneOpts
        );
        if (combo.attackId !== "banshee_scream") this._applyDebuffs(game, combo.attackRef);
      }
      combo.remaining -= 1;
      combo.nextAt += combo.gap;
    }
    if (combo.remaining <= 0) this._sameStripConeCombo = null;
  }

  draw(ctx, camera) {
    const enemy = this.enemy;
    const timed = enemy._timedDoubleConeState;
    if (timed && this.currentAttack?.kind === "timed_double_cone" && this.state === "active") {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const sx = ex - camera.position.x;
      const sy = ey - camera.position.y;
      const pos = { x: sx, y: sy };
      const color = getTelegraphColor("heavy");
      const progress = Math.max(0, Math.min(1, timed.elapsed / Math.max(0.001, timed.duration)));
      const alpha = 0.38 + (1 - progress) * 0.22;
      drawConeTelegraph(
        ctx,
        pos,
        timed.baseDirAngle + ((timed.firstCone.angleOffsetDeg || 0) * Math.PI / 180),
        timed.firstCone.arc,
        timed.firstCone.range,
        alpha,
        color
      );
      drawConeTelegraph(
        ctx,
        pos,
        timed.baseDirAngle + ((timed.secondCone.angleOffsetDeg || 0) * Math.PI / 180),
        timed.secondCone.arc,
        timed.secondCone.range,
        alpha,
        color
      );
      return;
    }

    const cyclone = enemy._cycloneState;
    if (cyclone) {
      const ex = enemy.position.x + enemy.size / 2;
      const ey = enemy.position.y + enemy.size / 2;
      const sx = ex - camera.position.x;
      const sy = ey - camera.position.y;
      const pos = { x: sx, y: sy };
      const color = getTelegraphColor("heavy");
      const alpha = 0.5;
      drawCircleTelegraph(ctx, pos, cyclone.radius, alpha, color);
      return;
    }

    if (this.state !== "windup" || !this.currentAttack) return;

    const a = this.currentAttack;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const useTargetPos = a.telegraph?.atTarget && this.targetSnapshot;
    const sx = useTargetPos ? this.targetSnapshot.x - camera.position.x : ex - camera.position.x;
    const sy = useTargetPos ? this.targetSnapshot.y - camera.position.y : ey - camera.position.y;

    const windup = a.telegraph?.windup ?? 0.5;
    const elapsed = windup - this.timer;
    const alpha = 0.4 + 0.5 * (elapsed / windup);

    const colorKey = a.flags?.heavy ? "heavy" : a.flags?.magic ? "magic" : a.flags?.poison ? "poison" : a.flags?.fast ? "fast" : "heavy";
    const color = getTelegraphColor(colorKey);

    const pos = { x: sx, y: sy };

    switch (a.telegraph?.shape ?? "circle") {
      case "circle":
        drawCircleTelegraph(ctx, pos, a.execute?.radius ?? 70, alpha, color);
        break;
      case "falling_rocks": {
        const count = Math.max(1, a.telegraph?.count ?? 5);
        const radius = a.execute?.radius ?? a.telegraph?.radius ?? 48;
        const growRadius = radius * (elapsed / windup);
        const spread = 28;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const ox = sx + Math.cos(angle) * spread;
          const oy = sy + Math.sin(angle) * spread;
          drawCircleTelegraph(ctx, { x: ox, y: oy }, growRadius, alpha, color);
        }
        break;
      }
      case "ring":
        drawRingTelegraph(ctx, pos, a.execute?.outerRadius ?? 100, 15, alpha, color);
        break;
      case "cone":
        const dirAngle = this.targetSnapshot
          ? Math.atan2(this.targetSnapshot.y - ey, this.targetSnapshot.x - ex)
          : 0;
        drawConeTelegraph(ctx, pos, dirAngle, a.execute?.arc ?? 90, a.execute?.range ?? 80, alpha, color);
        break;
      case "line":
        const da = this.targetSnapshot
          ? Math.atan2(this.targetSnapshot.y - ey, this.targetSnapshot.x - ex)
          : 0;
        drawLineTelegraph(ctx, pos, da, a.execute?.length ?? 120, a.execute?.width ?? 30, alpha, color);
        break;
      default:
        drawCircleTelegraph(ctx, pos, 50, alpha, color);
    }
  }
}
