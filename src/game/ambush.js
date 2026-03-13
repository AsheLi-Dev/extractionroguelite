/**
 * AmbushSubArea: trigger, spawn points, and lifecycle. Used by game.js update loop.
 * Enemies spawn across the zone (edges, corners, scattered) and converge on the player.
 */

import { play as playSfx } from '../audio.js';
import {
  pickAmbushTheme,
  buildAmbushSpawnList,
  AMBUSH_ANTICIPATION_MIN,
  AMBUSH_ANTICIPATION_MAX,
  AMBUSH_SPAWN_WINDOW_MIN,
  AMBUSH_SPAWN_WINDOW_MAX,
  AMBUSH_REWARD_BURST_COUNT_MIN,
  AMBUSH_REWARD_BURST_COUNT_MAX,
  AMBUSH_REWARD_QUALITY,
} from '../data/ambush.js';

/**
 * Check if player center is inside an ambush zone that hasn't been triggered yet.
 * @param {Object} game - Game (world, player, ambushZoneState)
 * @returns {{ zone: Object, state: Object } | null}
 */
export function getAmbushZoneAtPlayer(game) {
  const zones = game.world?.ambushZones;
  if (!zones?.length) return null;
  const state = game.ambushZoneState || {};
  const px = game.player.position.x + game.player.size / 2;
  const py = game.player.position.y + game.player.size / 2;
  for (const zone of zones) {
    const s = state[zone.id];
    if (s?.triggered) continue;
    const b = zone.bounds;
    if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) {
      return { zone, state: s || null };
    }
  }
  return null;
}

/**
 * Build spawn points across the zone: edges, corners, and scattered valid tiles.
 * Avoids walls, obstacles, and player. Returns array of { x, y } in world pixels.
 * @param {Object} zone - { bounds: { x, y, w, h } }
 * @param {Object} game
 * @param {number} count
 * @param {function(): number} rng
 */
export function buildAmbushSpawnPoints(zone, game, count, rng = Math.random) {
  const b = zone.bounds;
  const margin = 24;
  const inner = {
    x: b.x + margin,
    y: b.y + margin,
    w: Math.max(1, b.w - margin * 2),
    h: Math.max(1, b.h - margin * 2),
  };
  const playerPad = 80;
  const px = game.player.position.x + game.player.size / 2;
  const py = game.player.position.y + game.player.size / 2;
  const es = game.enemySystem;
  const tileSize = game.world?.tileSize ?? 32;

  const isValid = (x, y, size = 48) => {
    if (Math.hypot(x + size / 2 - px, y + size / 2 - py) < playerPad) return false;
    if (es?.isOnWall?.(x, y, size)) return false;
    if (es?.isOnBlockingObstacle?.(x, y, size, game)) return false;
    const grid = game.world?.tileGrid;
    if (grid?.length && grid[0]?.length) {
      const gx = Math.floor((x + size / 2) / tileSize);
      const gy = Math.floor((y + size / 2) / tileSize);
      if (gy < 0 || gy >= grid.length || gx < 0 || gx >= grid[0].length) return false;
      if (grid[gy][gx] === 1) return false;
    }
    return true;
  };

  const points = [];
  // Corners
  const corners = [
    { x: b.x + 20, y: b.y + 20 },
    { x: b.x + b.w - 20, y: b.y + 20 },
    { x: b.x + 20, y: b.y + b.h - 20 },
    { x: b.x + b.w - 20, y: b.y + b.h - 20 },
  ];
  for (const c of corners) {
    if (isValid(c.x, c.y)) points.push({ x: c.x, y: c.y });
  }
  // Edges (several along each edge)
  const edgeCount = 3;
  for (let i = 0; i < edgeCount; i++) {
    const t = (i + 1) / (edgeCount + 1);
    const left = { x: b.x + 16, y: b.y + t * b.h - 16 };
    const right = { x: b.x + b.w - 16, y: b.y + t * b.h - 16 };
    const top = { x: b.x + t * b.w - 16, y: b.y + 16 };
    const bottom = { x: b.x + t * b.w - 16, y: b.y + b.h - 16 };
    for (const p of [left, right, top, bottom]) {
      if (isValid(p.x, p.y)) points.push({ x: p.x, y: p.y });
    }
  }
  // Scattered inside
  for (let i = 0; i < count * 2; i++) {
    const x = inner.x + rng() * inner.w - 24;
    const y = inner.y + rng() * inner.h - 24;
    if (isValid(x, y)) points.push({ x, y });
  }

  // Dedupe by cell and shuffle, then take up to count
  const key = (p) => `${Math.floor(p.x / 32)}_${Math.floor(p.y / 32)}`;
  const seen = new Set();
  const unique = [];
  for (const p of points) {
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, Math.max(count, unique.length));
}

/**
 * Start the ambush for a zone: set state, pick theme, build spawn list and schedule spawns over time.
 * @param {Object} zone
 * @param {Object} game
 * @param {function(): number} rng
 */
export function startAmbushForZone(zone, game, rng = Math.random) {
  game.ambushZoneState = game.ambushZoneState || {};
  const theme = pickAmbushTheme(rng);
  const spawnList = buildAmbushSpawnList(theme, rng);
  const count = spawnList.length;
  const spawnPoints = buildAmbushSpawnPoints(zone, game, count, rng);
  const anticipation = AMBUSH_ANTICIPATION_MIN + rng() * (AMBUSH_ANTICIPATION_MAX - AMBUSH_ANTICIPATION_MIN);
  const windowDur = AMBUSH_SPAWN_WINDOW_MIN + rng() * (AMBUSH_SPAWN_WINDOW_MAX - AMBUSH_SPAWN_WINDOW_MIN);

  const spawnSchedule = [];
  for (let i = 0; i < spawnList.length; i++) {
    const t = (i + 1) / (spawnList.length + 1);
    spawnSchedule.push({
      at: anticipation + t * windowDur,
      typeId: spawnList[i].typeId,
      pointIndex: i % Math.max(1, spawnPoints.length),
    });
  }

  game.ambushZoneState[zone.id] = {
    triggered: true,
    anticipationUntil: game.time + anticipation,
    spawnSchedule,
    spawnPoints,
    themeId: theme.id,
    themeName: theme.name,
    spawnedEnemyIds: new Set(),
    complete: false,
    rewardSpawned: false,
  };

  if (game.devMode && typeof console !== 'undefined') {
    console.log(
      `[Dev][Ambush] Triggered zone ${zone.id}: ${theme.name} | ` +
      `${spawnList.length} enemies | anticipation ${anticipation.toFixed(2)}s | spawnWindow ${windowDur.toFixed(2)}s`
    );
  }
}

/**
 * Update ambush: run anticipation, then spawn enemies at scheduled times. Call from game update.
 * @param {number} dt
 * @param {Object} game
 * @param {function(): number} rng
 */
export function updateAmbush(dt, game, rng = Math.random) {
  const state = game.ambushZoneState;
  if (!state) return;

  const zones = game.world?.ambushZones;
  if (!zones?.length) return;

  const now = game.time;

  for (const zone of zones) {
    const s = state[zone.id];
    if (!s || s.complete) continue;

    // Anticipation phase: wait until anticipationUntil before scheduling spawns
    if (now < s.anticipationUntil) continue;

    // If we just crossed anticipation, optional: play sound here
    if (s.spawnSchedule.length > 0 && !s._spawnStarted) {
      s._spawnStarted = true;
      try { playSfx('popLow1'); } catch (_) {}
    }

    const toRemove = [];
    for (let i = 0; i < s.spawnSchedule.length; i++) {
      const entry = s.spawnSchedule[i];
      if (now < entry.at) continue;
      toRemove.push(i);
      const pt = s.spawnPoints[entry.pointIndex];
      if (!pt) continue;
      const enemy = game.enemySystem.spawnAtPosition(pt.x, pt.y, entry.typeId, game, { ambushZoneId: zone.id });
      if (enemy) {
        const eid = enemy.id != null ? enemy.id : `ambush_${zone.id}_${Date.now()}_${i}`;
        if (enemy.id == null) enemy.id = eid;
        s.spawnedEnemyIds.add(eid);
        if (game.transientVFX?.addRing) {
          const cx = pt.x + (enemy.size || 48) / 2;
          const cy = pt.y + (enemy.size || 48) / 2;
          game.transientVFX.addRing(cx, cy, 24, 0.12, 'rgba(200,220,255,0.6)');
        }
      }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      s.spawnSchedule.splice(toRemove[i], 1);
    }
  }
}

/**
 * Notify that an enemy died; if it was an ambush enemy, remove from zone and check completion.
 * @param {Object} enemy - Enemy with optional ambushZoneId and id
 * @param {Object} game
 */
export function onAmbushEnemyDied(enemy, game) {
  const zid = enemy.ambushZoneId;
  if (zid == null) return;
  const state = game.ambushZoneState?.[zid];
  if (!state || state.complete) return;
  if (enemy.id != null) state.spawnedEnemyIds.delete(enemy.id);
  const allSpawned = state.spawnSchedule.length === 0;
  const anyAlive = game.enemySystem.enemies.some(e => e.ambushZoneId === zid && !e.isDead);
  if (allSpawned && !anyAlive && !state.rewardSpawned) {
    state.rewardSpawned = true;
    state.complete = true;
    spawnAmbushReward(zid, game);
  }
}

/**
 * Spawn modest reward at zone center (~0.3–0.5 miniboss value).
 */
function spawnAmbushReward(zoneId, game) {
  const zones = game.world?.ambushZones;
  const zone = zones?.find(z => z.id === zoneId);
  if (!zone || !game.lootSystem) return;
  const cx = zone.bounds.x + zone.bounds.w / 2;
  const cy = zone.bounds.y + zone.bounds.h / 2;
  const count = AMBUSH_REWARD_BURST_COUNT_MIN + Math.floor(Math.random() * (AMBUSH_REWARD_BURST_COUNT_MAX - AMBUSH_REWARD_BURST_COUNT_MIN + 1));
  game.lootSystem.spawnBurstAt(cx, cy, count, AMBUSH_REWARD_QUALITY);
}
