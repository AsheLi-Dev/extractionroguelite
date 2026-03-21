/**
 * EnemyAttackController - runs telegraph  execute  recover loop per enemy.
 * State: idle | windup | active | recover
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

export class EnemyAttackController {
  constructor(enemy) {
    this.enemy = enemy;
    this.state = "idle";
    this.currentAttack = null;
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
    this.comboIndex = 0;
    this.attackUses = {}; // attackId -> times executed (for maxUses-limited attacks)
    this.attackScale = enemy.attackScale ?? 1;
    this.enableHiddenAttacks = enemy.enableHiddenAttacks ?? false;
    this._activeDurationOverride = null;
    this.availableAttacks = this._getAvailableAttacks();
  }

  _getAvailableAttacks() {
    const kit = ENEMY_ATTACK_KITS[this.enemy.name];
    if (!kit) return [];
    let list = [...(kit.base || [])];
    if (this.enableHiddenAttacks && kit.hidden?.length) {
      list = [...list, ...kit.hidden];
    }
    return list;
  }

  canAct() {
    const e = this.enemy;
    if (e.stunUntil != null && e.stunUntil > (e._gameTime ?? 0)) return false;
    if (e._undyingRespawnTime != null && (e._gameTime ?? 0) < e._undyingRespawnTime) return false;
    if (this.phaseUntil != null && (e._gameTime ?? 0) < this.phaseUntil) return false;
    if (this.regenChannelUntil != null && (e._gameTime ?? 0) < this.regenChannelUntil) return false;
    if ((e._monsterflyRecoverTimer || 0) > 0) return false;
    if (e._attackRollState) return false;
    if (e._cycloneState) return false;
    if ((e._cycloneEndTimer || 0) > 0) return false;
    if (e.name === "RockGiant" && (e._rockGiantHealing || e._rockGiantHitReaction)) return false;
    return true;
  }

  _pickAttack(player, game) {
    const cx = this.enemy.position.x + this.enemy.size / 2;
    const cy = this.enemy.position.y + this.enemy.size / 2;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

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
        this.currentAttack = attack;
        this.state = "windup";
        this.timer = (attack.telegraph?.windup ?? 0.5) / (this.rageUntil && game.time < this.rageUntil ? 1.2 : 1);
        this.targetSnapshot = { x: px, y: py };
        this.comboShotIndex = attack.execute?.comboShots ? 0 : undefined;
        // 5px horizontal dead zone to avoid rapid left/right flipping when player is centered on enemy
        if (px >= ex + 5) enemy.facingRight = true;
        else if (px <= ex - 5) enemy.facingRight = false;
      }
      return;
    }

    if (this.state === "windup") {
      if (this.currentAttack?.kind === "projectile" && this.timer > 0.2 && this.timer - dt <= 0.2) {
        const px = player.position.x + player.size / 2;
        const py = player.position.y + player.size / 2;
        this.targetSnapshot = { x: px, y: py };
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        this._execute(game);
        this.state = "active";
        this.timer = this._activeDurationOverride ?? 0.05;
        this._activeDurationOverride = null;
      }
      return;
    }

    if (this.state === "active") {
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
        const comboShots = this.currentAttack?.execute?.comboShots;
        const comboIndex = this.comboShotIndex ?? 0;
        if (comboShots != null && comboIndex + 1 < comboShots) {
          this.comboShotIndex = comboIndex + 1;
          this.state = "windup";
          this.timer = (this.currentAttack.telegraph?.windup ?? 0.5) / (this.rageUntil && game.time < this.rageUntil ? 1.2 : 1);
          if (game.player) {
            const px = game.player.position.x + game.player.size / 2;
            const py = game.player.position.y + game.player.size / 2;
            this.targetSnapshot = { x: px, y: py };
          }
        } else {
          this.state = "recover";
          const recoverTime = this.currentAttack?.execute?.chainRecover ?? this.currentAttack?.recover ?? 0.2;
          this.timer = recoverTime * (this.attackScale > 1.2 ? 0.9 : 1);
          this.cooldowns[this.currentAttack.id] = (this.currentAttack.cooldown ?? 1.5) * (this.rageUntil && game.time < this.rageUntil ? 0.7 : 1);
          this.currentAttack = null;
          this.comboShotIndex = undefined;
        }
      }
      return;
    }

    if (this.state === "recover") {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = "idle";
      }
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
        if (typeof game.spawnEnemyConeHitbox === "function") {
          game.spawnEnemyConeHitbox(enemy, ex, ey, dirX, dirY, range, arc, baseDmg, a.id);
          if (a.id !== "banshee_scream") this._applyDebuffs(game, a);
        } else {
          const arcRad = (arc * Math.PI) / 180;
          const px = player.position.x + player.size / 2;
          const py = player.position.y + player.size / 2;
          const pr = Math.max(2, (player.size || 0) * 0.5);
          if (this._isCircleInCone(ex, ey, dirAngle, range, arcRad, px, py, pr)) {
            game.onPlayerDamaged(baseDmg, true);
            game.lastDamagingEnemy = enemy;
            this._applyDebuffs(game, a);
          }
        }
        break;
      }
      case "circle": {
        const r = a.execute?.radius ?? 70;
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
            game.addDelayedEnemyImpact(atTime, ix, iy, r, Math.round(baseDmg / count), enemy, !!a.execute?.slowZone, a.execute?.slowDuration ?? 1.5, useHitbox ? a.id : null);
          }
        } else if (useHitbox) {
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
        const spawnCount = a.execute?.count ?? 2;
        const spawnType = a.execute?.spawnType ?? "m_3a_small_slime";
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
