/**
 * HazardSubArea: lifecycle, update, and draw for environmental hazard zones.
 * Hazards activate on first player entry and stay active; effects apply only while player is in the zone.
 */

import { getHazardConfig } from '../data/hazard-subarea-data.js';

export function getHazardZoneAtPlayer(game) {
  const zones = game.world?.hazardZones;
  if (!zones?.length) return null;
  const px = game.player.position.x + game.player.size / 2;
  const py = game.player.position.y + game.player.size / 2;
  for (const zone of zones) {
    const b = zone.bounds;
    if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) {
      return zone;
    }
  }
  return null;
}

function isPlayerInZone(player, bounds) {
  const px = player.position.x + player.size / 2;
  const py = player.position.y + player.size / 2;
  return px >= bounds.x && px < bounds.x + bounds.w && py >= bounds.y && py < bounds.y + bounds.h;
}

export function activateHazardZone(zone, game) {
  game.hazardZoneState = game.hazardZoneState || {};
  const type = zone.hazardType || 'avalanche';
  const cfg = getHazardConfig(type);
  const state = {
    active: true,
    type,
    nextSpawnAt: game.time + (cfg.spawnIntervalMin ?? 2) * 0.5,
    snowOrbs: [],
    eruptionWarnings: [],
    swampPatches: [],
    fallingFireballs: [],
    windGustUntil: 0,
    windDirection: { x: 0, y: 0 },
    swampStacks: 0,
  };
  if (type === 'swamp') {
    const b = zone.bounds;
    const patchCount = cfg.patchCount ?? 5;
    const r = cfg.patchRadius ?? 64;
    for (let i = 0; i < patchCount; i++) {
      state.swampPatches.push({
        x: b.x + r + Math.random() * (b.w - r * 2),
        y: b.y + r + Math.random() * (b.h - r * 2),
        radius: r,
      });
    }
  }
  game.hazardZoneState[zone.id] = state;
}

function updateAvalanche(dt, game, zone, state, cfg) {
  const b = zone.bounds;
  if (game.time >= state.nextSpawnAt) {
    state.nextSpawnAt = game.time + (cfg.spawnIntervalMin ?? 2) + Math.random() * ((cfg.spawnIntervalMax ?? 4) - (cfg.spawnIntervalMin ?? 2));
    const edge = Math.floor(Math.random() * 4);
    const speed = cfg.orbSpeed ?? 180;
    let x, y, vx, vy;
    if (edge === 0) {
      x = b.x;
      y = b.y + Math.random() * b.h;
      vx = speed;
      vy = 0;
    } else if (edge === 1) {
      x = b.x + b.w;
      y = b.y + Math.random() * b.h;
      vx = -speed;
      vy = 0;
    } else if (edge === 2) {
      x = b.x + Math.random() * b.w;
      y = b.y;
      vx = 0;
      vy = speed;
    } else {
      x = b.x + Math.random() * b.w;
      y = b.y + b.h;
      vx = 0;
      vy = -speed;
    }
    state.snowOrbs.push({ x, y, vx, vy, radius: cfg.orbRadius ?? 14 });
  }
  const player = game.player;
  const px = player.position.x + player.size / 2;
  const py = player.position.y + player.size / 2;
  const pr = player.size * 0.4;
  const playerInZone = isPlayerInZone(player, zone.bounds);
  state.snowOrbs = state.snowOrbs.filter((orb) => {
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    if (orb.x + orb.radius < b.x || orb.x - orb.radius > b.x + b.w || orb.y + orb.radius < b.y || orb.y - orb.radius > b.y + b.h) return false;
    if (playerInZone) {
      const dx = px - orb.x;
      const dy = py - orb.y;
      if (dx * dx + dy * dy <= (pr + orb.radius) ** 2) {
        game.stunTimer = Math.max(game.stunTimer || 0, cfg.stunDuration ?? 0.2);
        game.playerSlowUntil = game.time + (cfg.slowDuration ?? 1);
        game.playerSlowMult = cfg.slowMult ?? 0.8;
        return false;
      }
    }
    return true;
  });
}

function updateEarthquake(dt, game, zone, state, cfg) {
  const b = zone.bounds;
  if (game.time >= state.nextSpawnAt) {
    state.nextSpawnAt = game.time + (cfg.spawnIntervalMin ?? 2.5) + Math.random() * ((cfg.spawnIntervalMax ?? 4.5) - (cfg.spawnIntervalMin ?? 2.5));
    state.eruptionWarnings.push({
      x: b.x + cfg.eruptionRadius + Math.random() * (b.w - cfg.eruptionRadius * 2),
      y: b.y + cfg.eruptionRadius + Math.random() * (b.h - cfg.eruptionRadius * 2),
      at: game.time,
      radius: cfg.eruptionRadius ?? 48,
    });
  }
  const player = game.player;
  const px = player.position.x + player.size / 2;
  const py = player.position.y + player.size / 2;
  const pr = player.size * 0.4;
  const warningDuration = cfg.warningDuration ?? 0.7;
  const playerInZone = isPlayerInZone(player, zone.bounds);
  state.eruptionWarnings = state.eruptionWarnings.filter((w) => {
    const elapsed = game.time - w.at;
    if (elapsed < warningDuration) return true;
    if (playerInZone) {
      const dx = px - w.x;
      const dy = py - w.y;
      if (dx * dx + dy * dy <= (pr + w.radius) ** 2) {
        if (game.applyDamage) {
          game.applyDamage({
            targetType: 'player',
            sourceType: 'hazard_earthquake',
            amount: cfg.damage ?? 5,
            reason: 'hazard_earthquake',
            damageClass: 'hazard',
            bypassMitigation: false,
            canKill: true,
          });
        }
        game.playerSlowUntil = game.time + (cfg.slowDuration ?? 1);
        game.playerSlowMult = cfg.slowMult ?? 0.85;
      }
    }
    return false;
  });
}

function updateSwamp(dt, game, zone, state, cfg) {
  if (!state.swampPatches || state.swampPatches.length === 0) {
    const b = zone.bounds;
    const patchCount = cfg.patchCount ?? 5;
    const r = cfg.patchRadius ?? 64;
    state.swampPatches = [];
    for (let i = 0; i < patchCount; i++) {
      state.swampPatches.push({
        x: b.x + r + Math.random() * (b.w - r * 2),
        y: b.y + r + Math.random() * (b.h - r * 2),
        radius: r,
      });
    }
  }
  const player = game.player;
  const px = player.position.x + player.size / 2;
  const py = player.position.y + player.size / 2;
  let inSwamp = false;
  for (const p of state.swampPatches) {
    const dx = px - p.x;
    const dy = py - p.y;
    if (dx * dx + dy * dy <= p.radius * p.radius) {
      inSwamp = true;
      break;
    }
  }
  const maxStacks = cfg.maxStacks ?? 6;
  const gainRate = (cfg.stackGainPerSecond ?? 2) * dt;
  const decayRate = (cfg.stackDecayPerSecond ?? 3) * dt;
  if (inSwamp) {
    state.swampStacks = Math.min(maxStacks, state.swampStacks + gainRate);
  } else {
    state.swampStacks = Math.max(0, state.swampStacks - decayRate);
  }
  const playerInZone = isPlayerInZone(player, zone.bounds);
  if (state.swampStacks > 0 && playerInZone) {
    const slowPerStack = cfg.slowPerStack ?? 0.05;
    game.playerSlowUntil = game.time + 0.5;
    game.playerSlowMult = 1 - state.swampStacks * slowPerStack;
    const poisonPerStack = (cfg.poisonPerStackPerSecond ?? 0.5) * dt;
    if (game.swampPoisonAccum == null) game.swampPoisonAccum = 0;
    game.swampPoisonAccum += state.swampStacks * poisonPerStack;
    if (game.swampPoisonAccum >= 1) {
      game.swampPoisonAccum -= 1;
      if (game.applyDamage) {
        game.applyDamage({
          targetType: 'player',
          sourceType: 'hazard_swamp',
          amount: 1,
          reason: 'hazard_swamp_poison',
          damageClass: 'hazard',
          bypassMitigation: false,
          canKill: true,
        });
      }
    }
  } else if (state.swampStacks <= 0) {
    game.swampPoisonAccum = 0;
  }
}

function updateVolcano(dt, game, zone, state, cfg) {
  const b = zone.bounds;
  if (game.time >= state.nextSpawnAt) {
    state.nextSpawnAt = game.time + (cfg.spawnIntervalMin ?? 2) + Math.random() * ((cfg.spawnIntervalMax ?? 4) - (cfg.spawnIntervalMin ?? 2));
    const fallDuration = cfg.fallDuration ?? 0.9;
    state.fallingFireballs.push({
      x: b.x + cfg.impactRadius + Math.random() * (b.w - cfg.impactRadius * 2),
      y: b.y + cfg.impactRadius + Math.random() * (b.h - cfg.impactRadius * 2),
      at: game.time,
      impactAt: game.time + fallDuration,
      radius: cfg.impactRadius ?? 40,
    });
  }
  const player = game.player;
  const px = player.position.x + player.size / 2;
  const py = player.position.y + player.size / 2;
  const pr = player.size * 0.4;
  const playerInZone = isPlayerInZone(player, zone.bounds);
  state.fallingFireballs = state.fallingFireballs.filter((fb) => {
    if (game.time < fb.impactAt) return true;
    if (playerInZone) {
      const dx = px - fb.x;
      const dy = py - fb.y;
      if (dx * dx + dy * dy <= (pr + fb.radius) ** 2) {
        if (game.applyDamage) {
          game.applyDamage({
            targetType: 'player',
            sourceType: 'hazard_volcano',
            amount: cfg.damage ?? 5,
            reason: 'hazard_volcano_impact',
            damageClass: 'hazard',
            bypassMitigation: false,
            canKill: true,
          });
        }
        game.playerBurnUntil = game.time + (cfg.burnDuration ?? 5);
        game.playerBurnDmg = (cfg.burnDamagePerSecond ?? 1) * 0.5;
      }
    }
    return false;
  });
}

function updateHurricane(dt, game, zone, state, cfg) {
  if (game.time >= state.nextSpawnAt) {
    state.nextSpawnAt = game.time + (cfg.gustIntervalMin ?? 2) + Math.random() * ((cfg.gustIntervalMax ?? 4) - (cfg.gustIntervalMin ?? 2));
    const angle = Math.random() * Math.PI * 2;
    const speed = cfg.pushSpeed ?? 320;
    state.windGustUntil = game.time + (cfg.gustDurationMin ?? 0.2) + Math.random() * ((cfg.gustDurationMax ?? 0.4) - (cfg.gustDurationMin ?? 0.2));
    state.windDirection = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }
  if (game.time < state.windGustUntil && game.player && !game.dashActive && isPlayerInZone(game.player, zone.bounds)) {
    const margin = game.world.wallThickness ?? 32;
    game.player.position.x = Math.max(margin, Math.min(game.player.position.x + state.windDirection.x * dt, game.world.width - margin - game.player.size));
    game.player.position.y = Math.max(margin, Math.min(game.player.position.y + state.windDirection.y * dt, game.world.height - margin - game.player.size));
  }
}

export function updateHazardSubareas(dt, game) {
  const zones = game.world?.hazardZones;
  if (!zones?.length) return;
  game.hazardZoneState = game.hazardZoneState || {};
  const playerZone = getHazardZoneAtPlayer(game);
  for (const zone of zones) {
    const state = game.hazardZoneState[zone.id];
    if (!state) {
      if (playerZone && playerZone.id === zone.id) activateHazardZone(zone, game);
      continue;
    }
    // Keep hazard running and drawing; effects only apply when player is in zone
    const cfg = getHazardConfig(state.type);
    if (state.type === 'avalanche') updateAvalanche(dt, game, zone, state, cfg);
    else if (state.type === 'earthquake') updateEarthquake(dt, game, zone, state, cfg);
    else if (state.type === 'swamp') updateSwamp(dt, game, zone, state, cfg);
    else if (state.type === 'volcano') updateVolcano(dt, game, zone, state, cfg);
    else if (state.type === 'hurricane') updateHurricane(dt, game, zone, state, cfg);
  }
}

export function drawHazardSubareas(ctx, game, camera, time) {
  const zones = game.world?.hazardZones;
  if (!zones?.length) return;
  const state = game.hazardZoneState || {};
  const ox = -camera.position.x;
  const oy = -camera.position.y;
  for (const zone of zones) {
    const s = state[zone.id];
    if (!s?.active) continue;
    const b = zone.bounds;
    if (s.type === 'avalanche') {
      for (const orb of s.snowOrbs || []) {
        const sx = orb.x + ox;
        const sy = orb.y + oy;
        ctx.fillStyle = 'rgba(224, 242, 255, 0.95)';
        ctx.beginPath();
        ctx.arc(sx, sy, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(191, 219, 254, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (s.type === 'earthquake') {
      for (const w of s.eruptionWarnings || []) {
        const sx = w.x + ox;
        const sy = w.y + oy;
        const elapsed = time - w.at;
        const cfg = getHazardConfig('earthquake');
        const warningDuration = cfg.warningDuration ?? 0.7;
        if (elapsed < warningDuration) {
          const alpha = 0.3 + 0.4 * (elapsed / warningDuration);
          ctx.strokeStyle = `rgba(180, 83, 9, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(sx, sy, w.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = 'rgba(120, 53, 15, 0.4)';
          ctx.beginPath();
          ctx.arc(sx, sy, w.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(180, 83, 9, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    } else if (s.type === 'swamp') {
      for (const p of s.swampPatches || []) {
        const sx = p.x + ox;
        const sy = p.y + oy;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.radius);
        grad.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
        grad.addColorStop(0.6, 'rgba(22, 163, 74, 0.35)');
        grad.addColorStop(1, 'rgba(22, 101, 52, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (s.type === 'volcano') {
      for (const fb of s.fallingFireballs || []) {
        const sx = fb.x + ox;
        const sy = fb.y + oy;
        const progress = (time - fb.at) / (fb.impactAt - fb.at);
        if (progress < 1) {
          ctx.strokeStyle = `rgba(251, 146, 60, ${0.5 + 0.3 * Math.sin(time * 10)})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(sx, sy, fb.radius * (0.5 + 0.5 * progress), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = 'rgba(251, 146, 60, 0.5)';
          ctx.beginPath();
          ctx.arc(sx, sy, fb.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (s.type === 'hurricane' && time < s.windGustUntil) {
      const cx = b.x + b.w / 2 + ox;
      const cy = b.y + b.h / 2 + oy;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + time * 3;
        const dist = 30 + Math.sin(time * 5 + i) * 15;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        ctx.fillStyle = `rgba(226, 232, 240, ${0.4 + 0.2 * Math.sin(time * 8 + i)})`;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
