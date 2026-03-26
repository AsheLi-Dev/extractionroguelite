import { Vec2 } from "../src/utils.js";
import { Enemy, ENEMY_TYPES } from "../src/entities/enemy.js";

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @returns {number} */
function nowSeconds() {
  return performance.now() / 1000;
}

/** @param {number} v */
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

const canvas = /** @type {HTMLCanvasElement} */ ($("c"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

function resize() {
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

const typeDef = ENEMY_TYPES.find((t) => t.id === "m_ud_brute");
if (!typeDef) {
  throw new Error("Could not find m_ud_brute in ENEMY_TYPES.");
}

const camera = { position: new Vec2(0, 0) };
const player = { position: new Vec2(520, 220), size: 64 };

/** Minimal `game` object for Enemy.update() calls. */
const game = {
  world: { tileWallRects: [] },
  obstacles: [],
  player,
  time: 0,
};

const bruteSpawn = { x: 240, y: 160 };
let brute = new Enemy(bruteSpawn.x, bruteSpawn.y, typeDef);
brute.activated = true;
brute.alerted = true;

let moveEnabled = false;

function resetBrute() {
  brute = new Enemy(bruteSpawn.x, bruteSpawn.y, typeDef);
  brute.activated = true;
  brute.alerted = true;
  brute.facingRight = true;
  moveEnabled = false;
}

/** @param {'rolling'|'slide'} kind */
function startBurst(kind) {
  brute.attackCtrl = null;
  const dur = Number(/** @type {HTMLInputElement} */ ($("burstDur")).value) || 1.0;
  const dir = { x: 1, y: 0 };
  brute._bruteBurstMove = {
    kind,
    dirX: dir.x,
    dirY: dir.y,
    elapsed: 0,
    duration: dur,
  };
  brute._bruteBurstNextIn = 9999;
}

/**
 * Minimal controller just to drive sprite FSM decisions.
 * @param {string} id
 * @param {string} kind
 */
function forceAttack(id, kind) {
  brute._bruteBurstMove = null;
  brute._bruteBurstNextIn = 9999;
  brute.attackCtrl = {
    state: "active",
    timer: 0.6,
    currentAttack: { id, kind, execute: { animFps: 14, totalFrames: 15 } },
    recoveringAttackId: null,
    availableAttacks: [{ id, kind, execute: { animFps: 14, totalFrames: 15 } }],
  };
}

function stopAttack() {
  brute.attackCtrl = null;
}

// ---- UI wiring ----
const dtScale = /** @type {HTMLInputElement} */ ($("dtScale"));
const dtScaleVal = $("dtScaleVal");
dtScale.addEventListener("input", () => {
  dtScaleVal.textContent = Number(dtScale.value).toFixed(2);
});

const burstDur = /** @type {HTMLInputElement} */ ($("burstDur"));
const burstDurVal = $("burstDurVal");
burstDur.addEventListener("input", () => {
  burstDurVal.textContent = `${Number(burstDur.value).toFixed(2)}s`;
});
burstDurVal.textContent = `${Number(burstDur.value).toFixed(2)}s`;

$("btnIdle").addEventListener("click", () => {
  brute._bruteBurstMove = null;
  brute._bruteBurstNextIn = 9999;
  brute.attackCtrl = null;
  brute.spriteAnimState.state = "idle";
  brute.spriteAnimState.timer = 0;
  brute.spriteAnimState.frameIndex = 0;
});

$("btnMove").addEventListener("click", () => {
  moveEnabled = !moveEnabled;
});

$("btnRolling").addEventListener("click", () => startBurst("rolling"));
$("btnSlide").addEventListener("click", () => startBurst("slide"));

$("btnHit").addEventListener("click", () => {
  brute.hitFlashTimer = 0.12;
});

$("btnAtkDown").addEventListener("click", () => forceAttack("ud_brute_downslash", "cone"));
$("btnAtkUp").addEventListener("click", () => forceAttack("ud_brute_upslash", "cone"));
$("btnCyclone").addEventListener("click", () => forceAttack("ud_brute_cyclone_slash", "frame_synced_circle"));
$("btnGroundSlam").addEventListener("click", () => forceAttack("ud_brute_groundslam", "cone"));

$("btnStopAttack").addEventListener("click", stopAttack);
$("btnReset").addEventListener("click", resetBrute);

// ---- Render loop ----
let lastT = nowSeconds();
let gameTime = 0;

function drawBackdrop() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  // simple ground
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function updateStatus(dt) {
  const s = brute.spriteAnimState;
  const burst = brute._bruteBurstMove;
  const attack = brute.attackCtrl;
  const moved = Math.sqrt((brute.position.x - brute.lastPosition.x) ** 2 + (brute.position.y - brute.lastPosition.y) ** 2);
  const burstInfo = burst
    ? `burst: kind=${burst.kind} elapsed=${(burst.elapsed || 0).toFixed(3)} dur=${(burst.duration || 0).toFixed(3)} progress=${clamp01((burst.elapsed || 0) / Math.max(0.0001, burst.duration || 0)).toFixed(3)}`
    : `burst: none`;
  const atkInfo = attack
    ? `attackCtrl: state=${attack.state} id=${attack.currentAttack?.id || "?"} kind=${attack.currentAttack?.kind || "?"}`
    : "attackCtrl: none";

  $("status").textContent = [
    `enemyTypeId=${brute.enemyTypeId} baseSpeed=${brute.speed}`,
    `activated=${!!brute.activated} alerted=${!!brute.alerted} moveEnabled=${!!moveEnabled}`,
    `spriteState=${s?.state} frame=${s?.frameIndex} timer=${(s?.timer || 0).toFixed(3)} moved(px/frame)=${moved.toFixed(3)}`,
    burstInfo,
    atkInfo,
    `hitFlashTimer=${(brute.hitFlashTimer || 0).toFixed(3)}`,
    `dt=${dt.toFixed(4)} gameTime=${gameTime.toFixed(3)}`,
  ].join("\n");
}

function tick() {
  resize();
  const t = nowSeconds();
  const rawDt = Math.min(0.05, Math.max(0, t - lastT));
  lastT = t;
  const dt = rawDt * (Number(dtScale.value) || 1);
  gameTime += dt;
  game.time = gameTime;

  if (moveEnabled) {
    // Slowly orbit the player position so direction changes.
    const r = 140;
    const a = gameTime * 0.6;
    player.position.x = bruteSpawn.x + 260 + Math.cos(a) * r;
    player.position.y = bruteSpawn.y + 40 + Math.sin(a) * r;
  } else {
    player.position.x = bruteSpawn.x + 260;
    player.position.y = bruteSpawn.y + 40;
  }

  brute.update(dt, player, gameTime, 1, 9999, game);

  drawBackdrop();
  // Draw a simple "player" marker
  ctx.save();
  ctx.fillStyle = "rgba(96,165,250,0.9)";
  ctx.beginPath();
  ctx.arc(player.position.x, player.position.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  brute.draw(ctx, camera, gameTime);

  updateStatus(dt);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

