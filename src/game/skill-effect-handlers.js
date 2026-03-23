import { setSkillUnlock } from '../data/constants.js';
import { PLAYER_PROJECTILE_SIZE, PlayerProjectile } from '../entities/projectile.js';
import { mirrorAncestorDebuffToPlayer } from './ancestor-system.js';
import { tryInteractProjectileWithOrbs } from './projectile-interactions.js';

/**
 * Skill-effect update handlers.
 *
 * Conventions:
 * - Handlers may mutate `eff` (it is the live `this.skillEffects` entry).
 * - Handlers may push `eff` into `surviving` to keep it alive, or return early
 *   to let the caller's lifecycle rules drop it.
 * - Shared logic should go into helpers/modules (avoid copy/paste between handlers).
 */

function updateFireball(game, eff, dt, surviving) {
  eff.mods = eff.mods || [];
  eff.maxRange = eff.maxRange ?? 360;
  eff.distanceTraveled = eff.distanceTraveled ?? 0;
  const margin = game.world.wallCollisionThickness ?? game.world.wallThickness;
  const w = game.world.width;
  const h = game.world.height;

  if (eff.phase === "orbit") {
    eff.orbitT = (eff.orbitT ?? 0) + dt;
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const orbitRadius = 70;
    const angle = (eff.orbitT * 1.2) % (Math.PI * 2);
    eff.x = px + Math.cos(angle) * orbitRadius;
    eff.y = py + Math.sin(angle) * orbitRadius;
    if (eff.orbitT >= (eff.orbitDuration ?? 3)) {
      eff.phase = "seek";
      const target = game.getNearestEnemy(eff.x, eff.y, 600);
      if (target) {
        const tx = target.position.x + target.size / 2;
        const ty = target.position.y + target.size / 2;
        const dx = tx - eff.x;
        const dy = ty - eff.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 180;
        eff.vx = (dx / dist) * speed;
        eff.vy = (dy / dist) * speed;
      }
    }
  } else {
    if (eff.mods.includes("projectilesStop1s") && eff.t >= 1) {
      eff.vx = 0;
      eff.vy = 0;
    }
    if (eff.mods.includes("projectilesGrow")) {
      eff.radius = (eff.radius || 60) + 12 * dt;
    }
    if (eff.returning) {
      const px = game.player.position.x + game.player.size / 2;
      const py = game.player.position.y + game.player.size / 2;
      const dx = px - eff.x;
      const dy = py - eff.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 180;
      eff.vx = (dx / dist) * speed;
      eff.vy = (dy / dist) * speed;
    }
    eff.x += eff.vx * dt;
    eff.y += eff.vy * dt;
    const moveLen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) * dt;
    eff.distanceTraveled += moveLen;

    // Check ice block collision
    if (game.obstacles) {
      for (const obstacle of game.obstacles) {
        if (obstacle.destroyed || obstacle.type !== "iceBlock") continue;
        const dist = Math.sqrt((eff.x - (obstacle.position.x + obstacle.size.w / 2)) ** 2 +
                               (eff.y - (obstacle.position.y + obstacle.size.h / 2)) ** 2);
        if (dist < 30) {
          game.dealDamageToBreakable(obstacle, 9999, {
            useDamageFacade: true,
            sourceType: "player_skill",
            reason: "projectile_melt_ice_block",
            damageClass: "object",
            tags: ["skill", "projectile", "melt"]
          });
          break;
        }
      }
    }

    if (eff.mods.includes("homing") && eff.distanceTraveled >= 0.2 * eff.maxRange) {
      const excludeHit = (eff.hitIds && eff.hitIds.size > 0) ? eff.hitIds : null;
      const target = game.getNearestEnemy(eff.x, eff.y, 500, excludeHit);
      if (target) {
        const tx = target.position.x + target.size / 2;
        const ty = target.position.y + target.size / 2;
        const dx = tx - eff.x;
        const dy = ty - eff.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 180;
        eff.vx = (dx / dist) * speed * 0.15 + eff.vx * 0.85;
        eff.vy = (dy / dist) * speed * 0.15 + eff.vy * 0.85;
        const vlen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) || 1;
        eff.vx = (eff.vx / vlen) * speed;
        eff.vy = (eff.vy / vlen) * speed;
      }
    }

    if (eff.mods.includes("boomerang") && !eff.returning && eff.distanceTraveled >= eff.maxRange) {
      eff.returning = true;
      eff.hitIds = eff.hitIds || new Set();
      eff.hitIds.clear();
      eff.vx = -eff.vx;
      eff.vy = -eff.vy;
    }

    if (eff.bouncesLeft != null && eff.bouncesLeft > 0) {
      if (eff.x < margin) {
        eff.x = margin;
        eff.vx = -eff.vx;
        eff.bouncesLeft--;
      }
      if (eff.x > w - margin) {
        eff.x = w - margin;
        eff.vx = -eff.vx;
        eff.bouncesLeft--;
      }
      if (eff.y < margin) {
        eff.y = margin;
        eff.vy = -eff.vy;
        eff.bouncesLeft--;
      }
      if (eff.y > h - margin) {
        eff.y = h - margin;
        eff.vy = -eff.vy;
        eff.bouncesLeft--;
      }
      if (eff.bouncesLeft <= 0 && eff.mods.includes("bouncing")) {
        return;
      }
    }

    if (eff.mods.includes("rebound") && !eff.rebounded) {
      const hitWall = eff.x <= margin || eff.x >= w - margin || eff.y <= margin || eff.y >= h - margin;
      if (hitWall) {
        eff.rebounded = true;
        const target = game.getNearestEnemy(eff.x, eff.y, 500);
        if (target) {
          const tx = target.position.x + target.size / 2;
          const ty = target.position.y + target.size / 2;
          const dx = tx - eff.x;
          const dy = ty - eff.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const speed = 180;
          eff.vx = (dx / dist) * speed;
          eff.vy = (dy / dist) * speed;
        }
      }
    }
  }

  eff.hitIds = eff.hitIds || new Set();
  const hit = game.enemiesInRadius(eff.x, eff.y, eff.radius);
  for (const e of hit) {
    if (!eff.hitIds.has(e.id)) {
      eff.hitIds.add(e.id);
      game.dealDamageToEnemy(
        e,
        game.computeSkillDamage(e, eff.mult, eff.slot, {
          sacrificeMult: eff.sacrificeMult,
          skillId: eff.skillId,
          skillMults: eff.skillMults,
          ringProcDamageMult: eff.ringProcDamageMult
        }),
        {
          isSkill: true,
          skillSlot: eff.slot,
          modList: eff.modList,
          triggeredCast: !!eff.triggeredCast,
          allowTriggeredProcs: eff.allowTriggeredProcs === true
        }
      );
    }
  }
  if (hit.length > 0 && !eff.mods.includes("piercing") && !eff.mods.includes("orbitInfinitePenetration2s")) {
    if (game.hazardSystem) {
      const burnDmg = Math.round(game.currentStats.attack * 0.2);
      game.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
    }
    return;
  }
  const fireballMaxT = eff.mods.includes("orbitInfinitePenetration2s") ? 4 : 2;
  if (eff.t > fireballMaxT && !eff.mods.includes("boomerang")) {
    if (game.hazardSystem) {
      const burnDmg = Math.round(game.currentStats.attack * 0.2);
      game.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
    }
    return;
  }
  if (eff.returning) {
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const d = (eff.x - px) * (eff.x - px) + (eff.y - py) * (eff.y - py);
    if (d < 900) {
      if (game.hazardSystem) {
        const burnDmg = Math.round(game.currentStats.attack * 0.2);
        game.hazardSystem.addTemporaryPatch("burningGround", eff.x, eff.y, 70, 3, burnDmg, true);
      }
      return;
    }
  }
  if (tryInteractProjectileWithOrbs(game, { x: eff.x, y: eff.y, size: (eff.radius || 60), absorbableByOrb: true }, { radius: (eff.radius || 60) / 2, positionIsCenter: true }).consumed) return;
  surviving.push(eff);
}

function updateIceShard(game, eff, dt, surviving) {
  eff.mods = eff.mods || [];
  eff.maxRange = eff.maxRange ?? 600;
  eff.distanceTraveled = eff.distanceTraveled ?? 0;
  const margin = game.world.wallCollisionThickness ?? game.world.wallThickness;
  const w = game.world.width;
  const h = game.world.height;

  if (eff.phase === "orbit") {
    eff.orbitT = (eff.orbitT ?? 0) + dt;
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const orbitRadius = 70;
    const angle = (eff.orbitT * 1.2) % (Math.PI * 2);
    eff.x = px + Math.cos(angle) * orbitRadius;
    eff.y = py + Math.sin(angle) * orbitRadius;
    if (eff.orbitT >= (eff.orbitDuration ?? 3)) {
      eff.phase = "seek";
      const target = game.getNearestEnemy(eff.x, eff.y, 600);
      if (target) {
        const tx = target.position.x + target.size / 2;
        const ty = target.position.y + target.size / 2;
        const dx = tx - eff.x;
        const dy = ty - eff.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 400;
        eff.vx = (dx / dist) * speed;
        eff.vy = (dy / dist) * speed;
      }
    }
  } else {
    if (eff.mods.includes("projectilesStop1s") && eff.t >= 1) {
      eff.vx = 0;
      eff.vy = 0;
    }
    if (eff.mods.includes("projectilesGrow")) {
      eff._iceRadius = (eff._iceRadius ?? 20) + 8 * dt;
    }
    if (eff.returning) {
      const px = game.player.position.x + game.player.size / 2;
      const py = game.player.position.y + game.player.size / 2;
      const dx = px - eff.x;
      const dy = py - eff.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 400;
      eff.vx = (dx / dist) * speed;
      eff.vy = (dy / dist) * speed;
    }
    eff.x += eff.vx * dt;
    eff.y += eff.vy * dt;
    eff.distanceTraveled += Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) * dt;

    if (eff.mods.includes("homing") && eff.distanceTraveled >= 0.2 * eff.maxRange) {
      const excludeHit = (eff.hitIds && eff.hitIds.size > 0) ? eff.hitIds : null;
      const target = game.getNearestEnemy(eff.x, eff.y, 500, excludeHit);
      if (target) {
        const tx = target.position.x + target.size / 2;
        const ty = target.position.y + target.size / 2;
        const dx = tx - eff.x;
        const dy = ty - eff.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 400;
        eff.vx = (dx / dist) * speed * 0.15 + eff.vx * 0.85;
        eff.vy = (dy / dist) * speed * 0.15 + eff.vy * 0.85;
        const vlen = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) || 1;
        eff.vx = (eff.vx / vlen) * speed;
        eff.vy = (eff.vy / vlen) * speed;
      }
    }

    if (eff.mods.includes("boomerang") && !eff.returning && eff.distanceTraveled >= eff.maxRange) {
      eff.returning = true;
      eff.hitIds = eff.hitIds || new Set();
      eff.hitIds.clear();
      eff.vx = -eff.vx;
      eff.vy = -eff.vy;
    }

    if (eff.bouncesLeft != null && eff.bouncesLeft > 0) {
      if (eff.x < margin) {
        eff.x = margin;
        eff.vx = -eff.vx;
        eff.bouncesLeft--;
      }
      if (eff.x > w - margin) {
        eff.x = w - margin;
        eff.vx = -eff.vx;
        eff.bouncesLeft--;
      }
      if (eff.y < margin) {
        eff.y = margin;
        eff.vy = -eff.vy;
        eff.bouncesLeft--;
      }
      if (eff.y > h - margin) {
        eff.y = h - margin;
        eff.vy = -eff.vy;
        eff.bouncesLeft--;
      }
      if (eff.bouncesLeft <= 0 && eff.mods.includes("bouncing")) {
        return;
      }
    }

    if (eff.mods.includes("rebound") && !eff.rebounded) {
      const hitWall = eff.x <= margin || eff.x >= w - margin || eff.y <= margin || eff.y >= h - margin;
      if (hitWall) {
        eff.rebounded = true;
        const target = game.getNearestEnemy(eff.x, eff.y, 500);
        if (target) {
          const tx = target.position.x + target.size / 2;
          const ty = target.position.y + target.size / 2;
          const dx = tx - eff.x;
          const dy = ty - eff.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const speed = 400;
          eff.vx = (dx / dist) * speed;
          eff.vy = (dy / dist) * speed;
        }
      }
    }
  }

  eff.hitIds = eff.hitIds || new Set();
  const iceRadius = Math.max(20, eff._iceRadius ?? 20);
  const hit = game.enemiesInRadius(eff.x, eff.y, iceRadius);
  for (const e of hit) {
    if (!eff.hitIds.has(e.id)) {
      eff.hitIds.add(e.id);
      game.dealDamageToEnemy(
        e,
        game.computeSkillDamage(e, eff.mult, eff.slot, {
          sacrificeMult: eff.sacrificeMult,
          skillId: eff.skillId,
          skillMults: eff.skillMults,
          ringProcDamageMult: eff.ringProcDamageMult
        }),
        {
          isSkill: true,
          skillSlot: eff.slot,
          modList: eff.modList,
          triggeredCast: !!eff.triggeredCast,
          allowTriggeredProcs: eff.allowTriggeredProcs === true
        }
      );
      game.applyStatusToEntity(e.id, 'slow', {
        duration: 2,
        magnitude: 0.7,
        sourceId: 'player',
        sourceType: 'player_skill'
      });
      mirrorAncestorDebuffToPlayer(game, "slow");
      game.iceShardHitsThisRun++;
      if (game.iceShardHitsThisRun >= 5) setSkillUnlock("iceShard5", true);
    }
  }
  const iceShardMaxT = eff.mods.includes("orbitInfinitePenetration2s") ? 3.5 : 1.5;
  if (eff.t > iceShardMaxT && !eff.mods.includes("boomerang") && !eff.returning) return;
  if (eff.returning) {
    const px = game.player.position.x + game.player.size / 2;
    const py = game.player.position.y + game.player.size / 2;
    const d = (eff.x - px) * (eff.x - px) + (eff.y - py) * (eff.y - py);
    if (d < 900) return;
  }
  if (tryInteractProjectileWithOrbs(game, { x: eff.x, y: eff.y, size: iceRadius * 2, absorbableByOrb: true }, { radius: iceRadius, positionIsCenter: true }).consumed) return;
  surviving.push(eff);
}

function updateAssimilativeOrb(game, eff, dt, surviving) {
  const orbRadius = eff.radius ?? 40;
  const playerX = game.player.position.x + game.player.size / 2;
  const playerY = game.player.position.y + game.player.size / 2;
  eff.x += (playerX - eff.x) * Math.min(1, dt * 0.8);
  eff.y += (playerY - eff.y) * Math.min(1, dt * 0.8);
  if (eff.t >= eff.duration) {
    const expRadius = orbRadius + (eff.absorbedCount || 0) * 8;
    const hit = game.enemiesInRadius(eff.x, eff.y, expRadius);
    const mult = 0.5 + (eff.absorbedCount || 0) * 0.15;
    for (const e of hit) {
      game.dealDamageToEnemy(
        e,
        game.computeSkillDamage(e, mult, eff.slot, {
          sacrificeMult: eff.sacrificeMult,
          skillId: eff.skillId,
          skillMults: eff.skillMults
        }),
        {
          isSkill: true,
          skillSlot: eff.slot,
          modList: eff.modList,
          triggeredCast: !!eff.triggeredCast,
          allowTriggeredProcs: eff.allowTriggeredProcs === true
        }
      );
    }
    return;
  }
  const projs = game.enemySystem?.projectiles || [];
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    const interacted = tryInteractProjectileWithOrbs(game, p, { radius: (p.size ?? 12) / 2 });
    if (interacted.consumed) {
      projs.splice(i, 1);
    }
  }
  surviving.push(eff);
}

function updateIceRain(game, eff, dt, surviving) {
  if (eff.t >= eff.duration) return;
  const tickRate = eff.tickRate || 4;
  if (Math.floor(eff.t * tickRate) > Math.floor((eff.t - dt) * tickRate)) {
    const hit = game.enemiesInRadius(eff.x, eff.y, eff.radius);
    for (const e of hit) {
      game.dealDamageToEnemy(
        e,
        game.computeSkillDamage(e, 0.4, eff.slot, {
          sacrificeMult: eff.sacrificeMult,
          skillId: eff.skillId,
          skillMults: eff.skillMults,
          ringProcDamageMult: eff.ringProcDamageMult
        }),
        {
          isSkill: true,
          skillSlot: eff.slot,
          modList: eff.modList,
          triggeredCast: !!eff.triggeredCast,
          allowTriggeredProcs: eff.allowTriggeredProcs === true
        }
      );
      game.applyStatusToEntity(e.id, 'slow', {
        duration: 0.5,
        magnitude: 0.5,
        sourceId: 'player',
        sourceType: 'player_skill'
      });
      mirrorAncestorDebuffToPlayer(game, "slow");
    }
  }
  surviving.push(eff);
}

function updateSpiritBanner(game, eff, dt, surviving) {
  if (eff.t >= eff.duration) return;
  const px = game.player.position.x + game.player.size / 2;
  const py = game.player.position.y + game.player.size / 2;
  const dx = px - eff.x;
  const dy = py - eff.y;
  const distSq = dx * dx + dy * dy;
  const r = eff.radius ?? 120;
  if (distSq <= r * r) {
    game.applyStatusToEntity('player', 'spiritBanner', {
      duration: 0.15,
      magnitude: 1.15,
      sourceId: 'player',
      sourceType: 'player_skill'
    });
  }
  surviving.push(eff);
}

function updateLoyalDragons(game, eff, dt, surviving) {
  if (eff.t >= eff.duration) return;
  const px = game.player.position.x + game.player.size / 2;
  const py = game.player.position.y + game.player.size / 2;
  eff.orbitAngle = (eff.orbitAngle ?? 0) + dt * 2;
  const rad = eff.orbitRadius ?? 70;
  const d1x = px + Math.cos(eff.orbitAngle) * rad;
  const d1y = py + Math.sin(eff.orbitAngle) * rad;
  const d2x = px + Math.cos(eff.orbitAngle + Math.PI) * rad;
  const d2y = py + Math.sin(eff.orbitAngle + Math.PI) * rad;
  eff.dragon1 = { x: d1x, y: d1y };
  eff.dragon2 = { x: d2x, y: d2y };
  const hitRadius = 25;
  for (const pos of [eff.dragon1, eff.dragon2]) {
    const hit = game.enemiesInRadius(pos.x, pos.y, hitRadius);
    for (const e of hit) {
      if (!(eff.dragonHitIds || (eff.dragonHitIds = new Set())).has(e.id)) {
        eff.dragonHitIds.add(e.id);
        game.dealDamageToEnemy(
          e,
          game.computeSkillDamage(e, eff.mult ?? 0.3, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults }),
          { isSkill: true, skillSlot: eff.slot, modList: eff.modList, triggeredCast: true, allowTriggeredProcs: false }
        );
      }
    }
  }
  eff.dragonHitIds = null;
  if (game.time - (eff.lastDragonFireTime ?? 0) >= 1) {
    eff.lastDragonFireTime = game.time;
    const dragonFireRange = 350;
    const dragonFireDamage = 5;
    for (const pos of [eff.dragon1, eff.dragon2]) {
      const nearest = game.getNearestEnemy(pos.x, pos.y, dragonFireRange);
      if (nearest && !nearest.isDead) {
        const tx = nearest.position.x + nearest.size / 2;
        const ty = nearest.position.y + nearest.size / 2;
        const sx = pos.x - PLAYER_PROJECTILE_SIZE / 2;
        const sy = pos.y - PLAYER_PROJECTILE_SIZE / 2;
        const proj = new PlayerProjectile(sx, sy, tx, ty, dragonFireDamage, { forceHoming: true, speedMult: 0.8 });
        proj.attackType = game.attackType;
        game.playerProjectiles.push(proj);
      }
    }
  }
  surviving.push(eff);
}

function updateHunterShotAndHomingSkull(game, eff, dt, surviving) {
  eff.t += dt;
  const speed = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy) || 1;
  const move = speed * dt;
  eff.x += eff.vx * dt;
  eff.y += eff.vy * dt;
  eff.distanceTraveled = (eff.distanceTraveled ?? 0) + move;
  if (eff.homing) {
    const nearest = game.getNearestEnemy(eff.x, eff.y, 300);
    if (nearest && !nearest.isDead) {
      const ex = nearest.position.x + nearest.size / 2;
      const ey = nearest.position.y + nearest.size / 2;
      const dx = ex - eff.x;
      const dy = ey - eff.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      eff.vx = (dx / d) * speed;
      eff.vy = (dy / d) * speed;
    }
  }
  const hit = game.enemiesInRadius(eff.x, eff.y, 20);
  if (hit.length > 0) {
    for (const e of hit) {
      const dmg = game.computeSkillDamage(e, eff.mult ?? 1, eff.slot, { sacrificeMult: eff.sacrificeMult, skillId: eff.skillId, skillMults: eff.skillMults });
      game.dealDamageToEnemy(e, dmg, { isSkill: true, skillSlot: eff.slot, modList: eff.modList });
      if (eff.type === "hunterShot") {
        game.hunterShotStacks = (game.hunterShotStacks ?? 0) + 1;
        game.hunterShotStacksUntil = game.time + 5;
      }
    }
    return;
  }
  if (tryInteractProjectileWithOrbs(game, { x: eff.x, y: eff.y, size: 40, absorbableByOrb: true }, { radius: 20, positionIsCenter: true }).consumed) return;
  if (eff.distanceTraveled >= (eff.maxRange ?? 500)) return;
  surviving.push(eff);
}

function updateAnimatedSpriteImpact(_game, eff, _dt, surviving) {
  const sprite = eff?.animatedSprite || {};
  const duration = Math.max(
    0.05,
    Number(eff?.duration) || (Math.max(1, Number(sprite.frameCount) || 1) / Math.max(1, Number(sprite.fps) || 12))
  );
  eff.duration = duration;
  if (eff.t >= duration) return;
  surviving.push(eff);
}

function updateEnemyBreathVisual(_game, eff, _dt, surviving) {
  const duration = Math.max(0.1, Number(eff?.duration) || 0.9);
  eff.duration = duration;
  if (eff.t >= duration) return;
  surviving.push(eff);
}

function updateElementMageArt(game, eff, dt, surviving) {
  eff.x += (Number(eff.vx) || 0) * dt;
  eff.y += (Number(eff.vy) || 0) * dt;
  eff.hitIds = eff.hitIds || new Set();
  const dirX = Number(eff.dirX) || 1;
  const dirY = Number(eff.dirY) || 0;
  const halfLength = Math.max(1, Number(eff.length) || 150) * 0.5;
  const halfWidth = Math.max(1, Number(eff.width) || 84) * 0.5;
  const targets = [...(game.enemySystem?.enemies || []), ...(game.enemySystem?.boss ? [game.enemySystem.boss] : [])];
  for (const enemy of targets) {
    if (!enemy || enemy.isDead || eff.hitIds.has(enemy.id)) continue;
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const relX = ex - eff.x;
    const relY = ey - eff.y;
    const forward = relX * dirX + relY * dirY;
    const side = relX * (-dirY) + relY * dirX;
    const enemyRadius = Math.max(12, Number(enemy.size) || 24) * 0.35;
    if (forward < -halfLength - enemyRadius || forward > halfLength + enemyRadius) continue;
    if (Math.abs(side) > halfWidth + enemyRadius) continue;
    eff.hitIds.add(enemy.id);
    const damage = game.computeSkillDamage(enemy, eff.mult ?? 0.85, eff.slot, {
      sacrificeMult: eff.sacrificeMult,
      skillId: eff.skillId,
      skillMults: eff.skillMults,
      ringProcDamageMult: eff.ringProcDamageMult
    });
    game.dealDamageToEnemy(enemy, damage, {
      isSkill: true,
      skillSlot: eff.slot,
      modList: eff.modList,
      triggeredCast: !!eff.triggeredCast,
      allowTriggeredProcs: eff.allowTriggeredProcs === true
    });
    if (eff.variant === 'fire') {
      game.applyBurnToEntity?.(enemy, {
        duration: 3,
        magnitude: Math.max(1, Math.round(damage * 0.15)),
        stacks: 1,
        maxStacks: 3,
        sourceId: 'player',
        sourceType: 'player_skill',
        reason: 'element_mage_fire_breath'
      });
    } else if (eff.variant === 'wind') {
      const dist = Math.sqrt(relX * relX + relY * relY) || 1;
      game.moveEntityByWithCollision?.(enemy, (relX / dist) * (eff.knockback ?? 120), (relY / dist) * (eff.knockback ?? 120));
    } else if (eff.variant === 'lightning') {
      game.applyStatusToEntity?.(enemy.id, 'stun', {
        duration: eff.stunDuration ?? 0.5,
        sourceId: 'player',
        sourceType: 'player_skill'
      });
      mirrorAncestorDebuffToPlayer(game, "stun");
    }
  }
  if (eff.t >= (eff.duration ?? 1)) return;
  surviving.push(eff);
}

function updateRetreatVolley(game, eff, dt, surviving) {
  const jumpDuration = Math.max(0.0001, Number(eff.jumpDuration) || Number(eff.duration) || 0.16);
  const jumpDistance = Math.max(0, Number(eff.jumpDistance) || 0);
  const lastT = Math.max(0, Number(eff.t) - dt);
  const prevProgress = Math.max(0, Math.min(1, lastT / jumpDuration));
  const nextProgress = Math.max(0, Math.min(1, Number(eff.t) / jumpDuration));
  const movedDistance = (nextProgress - prevProgress) * jumpDistance;
  if (movedDistance > 0) {
    game.movePlayerByWithCollision?.(-(Number(eff.dirX) || 0) * movedDistance, -(Number(eff.dirY) || 0) * movedDistance);
  }

  if (!eff.released && Number(eff.t) >= (Number(eff.releaseTime) || 0.12)) {
    eff.released = true;
    const arrowCount = Math.max(1, Math.floor(Number(eff.arrowCount) || 5));
    const spreadDeg = Math.max(0, Number(eff.spreadDeg) || 24);
    const origin = game.resolvePlayerAttackOrigin({
      attackType: eff.skillId || "wind_archer_retreat_volley",
      mode: "projectile",
      targetX: (game.lastMouseWorld?.x ?? 0),
      targetY: (game.lastMouseWorld?.y ?? 0)
    });
    const centerX = origin.originX;
    const centerY = origin.originY;
    const baseAngle = Math.atan2(Number(eff.dirY) || 0, Number(eff.dirX) || 1);
    for (let i = 0; i < arrowCount; i++) {
      const offsetDeg = arrowCount > 1 ? ((i / (arrowCount - 1)) - 0.5) * spreadDeg : 0;
      const angle = baseAngle + (offsetDeg * Math.PI / 180);
      const vx = Math.cos(angle) * (Number(eff.projectileSpeed) || 624);
      const vy = Math.sin(angle) * (Number(eff.projectileSpeed) || 624);
      game.skillEffects.push({
        type: "retreatVolleyArrow",
        x: centerX,
        y: centerY,
        vx,
        vy,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        t: 0,
        duration: Math.max(0.25, (Number(eff.projectileRange) || 520) / Math.max(1, Number(eff.projectileSpeed) || 624)),
        maxRange: Number(eff.projectileRange) || 520,
        distanceTraveled: 0,
        radius: 16,
        mult: Number(eff.mult) || 0.55,
        pierceCount: Math.max(0, Math.floor(Number(eff.pierceCount) || 0)),
        hitIds: new Set(),
        slowMult: Number(eff.slowMult) || 0.75,
        slowDuration: Number(eff.slowDuration) || 2,
        explosionRadius: Number(eff.explosionRadius) || 52,
        explosionMult: Number(eff.explosionMult) || 0.35,
        castId: eff.castId,
        explodedTargetIds: eff.explodedTargetIds,
        slot: eff.slot,
        modList: eff.modList,
        sacrificeMult: eff.sacrificeMult,
        skillId: eff.skillId,
        skillMults: eff.skillMults,
        animatedSprite: {
          path: "assets/Projectiles/Wind Effect 01/Wind Effect 01/Wind Breath.png",
          frameWidth: 48,
          frameHeight: 32,
          frameCount: 12,
          fps: 18,
          loop: true,
          drawWidth: 72,
          drawHeight: 48,
          rotateWithVelocity: true
        }
      });
    }
  }

  if (eff.t >= (eff.duration ?? 0.16)) return;
  surviving.push(eff);
}

function updateRetreatVolleyArrow(game, eff, dt, surviving) {
  eff.x += (Number(eff.vx) || 0) * dt;
  eff.y += (Number(eff.vy) || 0) * dt;
  eff.distanceTraveled = (eff.distanceTraveled || 0) + (Math.sqrt((eff.vx || 0) * (eff.vx || 0) + (eff.vy || 0) * (eff.vy || 0)) * dt);
  eff.hitIds = eff.hitIds || new Set();
  const hit = game.enemiesInRadius(eff.x, eff.y, eff.radius || 16);
  for (const e of hit) {
    if (!e || e.isDead || eff.hitIds.has(e.id)) continue;
    eff.hitIds.add(e.id);
    const hadSlowBeforeHit = !!(
      (e.slowUntil || 0) > game.time ||
      (e.frozenUntil || 0) > game.time ||
      (e.rootUntil || 0) > game.time ||
      game.statusManager?.getStatus?.(e.id, "slow")
    );
    const dmg = game.computeSkillDamage(e, eff.mult ?? 0.55, eff.slot, {
      sacrificeMult: eff.sacrificeMult,
      skillId: eff.skillId,
      skillMults: eff.skillMults
    });
    game.dealDamageToEnemy(e, dmg, {
      isSkill: true,
      skillSlot: eff.slot,
      modList: eff.modList,
      skillId: eff.skillId,
      skillInstanceId: eff.castId,
      sourceType: "player_skill",
      attackType: eff.skillId
    });
    game.applyStatusToEntity?.(e.id, "slow", {
      duration: eff.slowDuration ?? 2,
      magnitude: eff.slowMult ?? 0.75,
      sourceId: "player",
      sourceType: "player_skill"
    });
    mirrorAncestorDebuffToPlayer(game, "slow");
    if (hadSlowBeforeHit && eff.explodedTargetIds && !eff.explodedTargetIds.has(e.id)) {
      eff.explodedTargetIds.add(e.id);
      const ex = e.position.x + e.size / 2;
      const ey = e.position.y + e.size / 2;
      const expTargets = game.enemiesInRadius(ex, ey, eff.explosionRadius ?? 52);
      for (const target of expTargets) {
        if (!target || target.isDead) continue;
        const expDmg = game.computeSkillDamage(target, eff.explosionMult ?? 0.35, eff.slot, {
          sacrificeMult: eff.sacrificeMult,
          skillId: eff.skillId,
          skillMults: eff.skillMults
        });
        game.dealDamageToEnemy(target, expDmg, {
          isSkill: true,
          skillSlot: eff.slot,
          modList: eff.modList,
          skillId: eff.skillId,
          skillInstanceId: eff.castId,
          sourceType: "player_skill",
          attackType: eff.skillId,
          reason: "retreat_volley_slow_explosion"
        });
      }
      game.skillEffects.push({
        type: "retreatVolleyExplosion",
        x: ex,
        y: ey,
        radius: eff.explosionRadius ?? 52,
        t: 0,
        duration: 0.18
      });
    }
    eff.pierceCount = Math.max(0, (eff.pierceCount || 0) - 1);
    if (eff.pierceCount <= 0) return;
  }
  if (tryInteractProjectileWithOrbs(game, { x: eff.x, y: eff.y, size: (eff.radius || 16) * 2, absorbableByOrb: true }, { radius: eff.radius || 16, positionIsCenter: true }).consumed) return;
  if ((eff.distanceTraveled || 0) >= (eff.maxRange || 520)) return;
  if (eff.t >= (eff.duration ?? 1)) return;
  surviving.push(eff);
}

function updateRetreatVolleyExplosion(_game, eff, _dt, surviving) {
  if (eff.t >= (eff.duration ?? 0.18)) return;
  surviving.push(eff);
}

export const SKILL_EFFECT_UPDATE_HANDLERS = {
  fireball: updateFireball,
  iceShard: updateIceShard,
  animatedSpriteImpact: updateAnimatedSpriteImpact,
  enemyBreathVisual: updateEnemyBreathVisual,
  elementMageArt: updateElementMageArt,
  retreatVolley: updateRetreatVolley,
  retreatVolleyArrow: updateRetreatVolleyArrow,
  retreatVolleyExplosion: updateRetreatVolleyExplosion,
  assimilativeOrb: updateAssimilativeOrb,
  iceRain: updateIceRain,
  spiritBanner: updateSpiritBanner,
  loyalDragons: updateLoyalDragons,
  hunterShot: updateHunterShotAndHomingSkull,
  homingSkull: updateHunterShotAndHomingSkull
};

