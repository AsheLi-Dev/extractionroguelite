/**
 * Blood Altar subarea: 15×15 tile zone with an altar in the center.
 * Enemy deaths in the zone charge the altar; at 10 charges it activates.
 * Types: heal (70%, green), 2 elite groups at 50% HP (20%, blue), 1 miniboss at 50% HP no portal (10%, yellow).
 * Also spawns cosmetic props from Desert Land decorative_props.png inside the altar area.
 */

const CHARGES_TO_ACTIVATE = 10;
const ALTAR_SIZE = 32;

// Decorative props atlas (Desert Land decorative_props.png, 64×64 each)
let decorativePropsImage = null;
let decorativePropsLoaded = false;
const DECOR_ATLAS_SRC = 'assets/Environments/Desert Land/decorative_props.png';
// Source rects (top-left coords) in the atlas (64×64 each)
const DECOR_PROPS = [
  { sx: 320, sy: 256, sw: 64, sh: 64 },
  { sx: 320, sy: 320, sw: 64, sh: 64 },
];

function ensureDecorativePropsImage() {
  if (decorativePropsImage || decorativePropsLoaded) return decorativePropsImage;
  const img = new Image();
  img.onload = () => {
    decorativePropsLoaded = true;
  };
  img.onerror = () => {
    console.warn('Failed to load decorative props atlas:', DECOR_ATLAS_SRC);
    decorativePropsLoaded = false;
  };
  img.src = DECOR_ATLAS_SRC;
  decorativePropsImage = img;
  return img;
}

export function getBloodAltarZoneAt(world, x, y) {
  const zones = world?.bloodAltarZones;
  if (!zones?.length) return null;
  for (const zone of zones) {
    const b = zone.bounds;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return zone;
  }
  return null;
}

function getOrCreateState(zone, game) {
  game.bloodAltarZoneState = game.bloodAltarZoneState || {};
  let state = game.bloodAltarZoneState[zone.id];
  if (!state) {
    state = { charges: 0, activated: false, type: zone.altarType ?? 'heal', decorProps: null };
    game.bloodAltarZoneState[zone.id] = state;
  }
  return state;
}

/**
 * Call when an enemy dies at (x, y). If inside a blood altar zone, adds a charge and may activate.
 */
export function onEnemyDiedInBloodAltar(x, y, game) {
  const zone = getBloodAltarZoneAt(game.world, x, y);
  if (!zone) return;
  const state = getOrCreateState(zone, game);
  if (state.activated) return;
  state.charges = (state.charges || 0) + 1;
  if (state.charges >= CHARGES_TO_ACTIVATE) {
    state.activated = true;
    activateBloodAltar(zone, game);
  }
}

function activateBloodAltar(zone, game) {
  const state = game.bloodAltarZoneState[zone.id];
  if (!state) return;
  const b = zone.bounds;
  const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 };

  if (state.type === 'heal') {
    const maxHp = Math.max(1, game.currentStats?.maxHealth ?? game.player?.maxHealth ?? 1);
    const healAmount = Math.max(1, Math.floor(maxHp * 0.2));
    if (game.currentHealth != null) {
      game.currentHealth = Math.min(maxHp, game.currentHealth + healAmount);
    }
    if (typeof game.updateHealthBar === 'function') game.updateHealthBar();
    return;
  }

  if (state.type === 'elites') {
    const es = game.enemySystem;
    if (!es) return;
    const prevLen = es.enemies.length;
    const savedBounds = game._biomeCellBounds;
    game._biomeCellBounds = b;
    try {
      es.spawnGroup('elite', game);
      es.spawnGroup('elite', game);
      for (const e of es.enemies.slice(prevLen)) {
        e.health = Math.max(1, Math.floor(e.maxHealth * 0.5));
      }
    } finally {
      game._biomeCellBounds = savedBounds;
    }
    return;
  }

  if (state.type === 'miniboss') {
    const es = game.enemySystem;
    if (!es) return;
    const enemy = es.spawnOne('miniBoss', null, center, game, null, true);
    if (enemy) {
      enemy.health = Math.max(1, Math.floor(enemy.maxHealth * 0.5));
      enemy._bloodAltarMiniboss = true;
    }
  }
}

export function drawBloodAltars(ctx, game, camera, time) {
  const zones = game.world?.bloodAltarZones;
  if (!zones?.length) return;
  const stateMap = game.bloodAltarZoneState || {};
  const ox = -camera.position.x;
  const oy = -camera.position.y;

  const decorImg = ensureDecorativePropsImage();

  for (const zone of zones) {
    const state = stateMap[zone.id] || getOrCreateState(zone, game);
    const b = zone.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const scx = cx + ox;
    const scy = cy + oy;
    const type = state?.type ?? zone.altarType ?? 'heal';

    let glowColor = 'rgba(80, 80, 80, 0.4)';
    if (type === 'heal') glowColor = 'rgba(34, 197, 94, 0.5)';
    else if (type === 'elites') glowColor = 'rgba(59, 130, 246, 0.5)';
    else if (type === 'miniboss') glowColor = 'rgba(234, 179, 8, 0.5)';

    ctx.save();

    // Always show the effective range outline (zone bounds)
    const rx = b.x + ox;
    const ry = b.y + oy;
    ctx.strokeStyle = type === 'heal' ? 'rgba(34, 197, 94, 0.7)' : type === 'elites' ? 'rgba(59, 130, 246, 0.7)' : 'rgba(234, 179, 8, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(rx, ry, b.w, b.h);
    ctx.setLineDash([]);
    const charges = state?.charges ?? 0;
    const activated = !!state?.activated;
    const pulse = activated ? 1 : 0.5 + 0.3 * Math.sin(time * 2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(scx, scy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = type === 'heal' ? 'rgba(34, 197, 94, 0.9)' : type === 'elites' ? 'rgba(59, 130, 246, 0.9)' : 'rgba(234, 179, 8, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(60, 20, 20, 0.95)';
    ctx.fillRect(scx - ALTAR_SIZE / 2, scy - ALTAR_SIZE / 2, ALTAR_SIZE, ALTAR_SIZE);
    ctx.strokeStyle = 'rgba(120, 40, 40, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(scx - ALTAR_SIZE / 2, scy - ALTAR_SIZE / 2, ALTAR_SIZE, ALTAR_SIZE);

    // Cosmetic props: spawn two instances of each decorative prop inside the altar bounds
    if (!state.decorProps) {
      state.decorProps = [];
      const tileSize = game.world?.tileSize || 32;
      const propSize = 64;
      const padding = tileSize; // keep a bit away from walls
      const inner = {
        x: b.x + padding,
        y: b.y + padding,
        w: Math.max(0, b.w - 2 * padding),
        h: Math.max(0, b.h - 2 * padding),
      };
      const totalInstances = 4; // 2 of each
      for (let i = 0; i < totalInstances; i++) {
        const variantIndex = i < 2 ? 0 : 1;
        const attempts = 10;
        let px = inner.x + Math.random() * Math.max(0, inner.w - propSize);
        let py = inner.y + Math.random() * Math.max(0, inner.h - propSize);
        // simple jitter on retries
        for (let a = 0; a < attempts; a++) {
          // avoid overlapping the central altar too much
          const acx = cx;
          const acy = cy;
          const midx = px + propSize / 2;
          const midy = py + propSize / 2;
          const dx = midx - acx;
          const dy = midy - acy;
          if (dx * dx + dy * dy > (ALTAR_SIZE * 1.8) * (ALTAR_SIZE * 1.8)) break;
          px = inner.x + Math.random() * Math.max(0, inner.w - propSize);
          py = inner.y + Math.random() * Math.max(0, inner.h - propSize);
        }
        state.decorProps.push({ variant: variantIndex, x: px, y: py });
      }
    }

    if (decorImg && decorativePropsLoaded && Array.isArray(state.decorProps)) {
      ctx.imageSmoothingEnabled = false;
      for (const prop of state.decorProps) {
        const def = DECOR_PROPS[prop.variant] || DECOR_PROPS[0];
        const dx = prop.x + ox;
        const dy = prop.y + oy;
        ctx.drawImage(
          decorImg,
          def.sx, def.sy, def.sw, def.sh,
          Math.floor(dx), Math.floor(dy),
          def.sw, def.sh
        );
      }
      ctx.imageSmoothingEnabled = true;
    }

    if (!activated && charges > 0) {
      ctx.fillStyle = 'rgba(200, 60, 60, 0.9)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${charges}/${CHARGES_TO_ACTIVATE}`, scx, scy);
    }
    ctx.restore();
  }
}
