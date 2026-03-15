/**
 * Simple SFX playback. Paths relative to project root (index.html).
 * Uses Web Audio API so playbackRate (pitch) is actually applied.
 */
const SOUNDS = {
  fireball: "assets/Audio/Fireball.wav",
  iceHard: "assets/Audio/ice_hard.wav",
  attack1: "assets/Audio/attack1.wav",
  attack2: "assets/Audio/attack2.wav",
  attack3: "assets/Audio/attack3.wav",
  damaged1: "assets/Audio/damaged1.wav",
  damaged2: "assets/Audio/damaged2.wav",
  damaged3: "assets/Audio/damaged3.wav",
  jump1: "assets/Audio/jump1.wav",
  jump2: "assets/Audio/jump2.wav",
  jump3: "assets/Audio/jump3.wav",
  inventoryOpen: "assets/Audio/LargeBagHandling2.wav",
  inventoryClose: "assets/Audio/LargeBagZip2.wav",
  popLow1: "assets/Audio/Pop Low 1.mp3",
  popLow2: "assets/Audio/Pop Low 2.mp3",
  playerDash: "assets/Audio/player_dash.wav",
  projectileShot: "assets/Audio/projectile_shot.wav",
  fanStrike: "assets/Audio/fan-strike.wav",
  pulseShot: "assets/Audio/pulse-shot.wav",
  enemyHurt: "assets/Audio/enemy_hurt.wav",
  chestOpen: "assets/Audio/01_chest_open_4.wav",
  collectGold: "assets/Audio/collect_gold.wav",
  portcullisGate: "assets/Audio/Portcullis Gate.wav"
};

const ATTACK_SOUNDS = new Set(["projectileShot", "fanStrike", "pulseShot", "fireball", "iceHard"]);
const BGM_PATH = "assets/Audio/05-Battle-1.wav";
const BGM_MUTED_STORAGE_KEY = "extractDaPandaBgmMuted";

let enabled = true;
let ctx = null;
const bufferCache = {};
const loadPromises = {};
let bgmAudio = null;
let bgmVolume = 0.15;

function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

/** Stronger pitch for attack SFX (0.721.28); milder for others (0.821.18) */
function randomPitch(soundId) {
  if (soundId === "attack1" || soundId === "attack2" || soundId === "attack3") {
    return 0.985 + Math.random() * 0.03; // Tiny variation
  }
  if (soundId === "damaged1" || soundId === "damaged2" || soundId === "damaged3") {
    return 0.99 + Math.random() * 0.02; // Tiny variation
  }
  if (soundId === "jump1" || soundId === "jump2" || soundId === "jump3") {
    return 0.99 + Math.random() * 0.02; // Tiny variation
  }
  if (soundId === "popLow1" || soundId === "popLow2") {
    return 0.72 + Math.random() * 0.66; // Very noticeable variation
  }
  if (soundId === "collectGold") {
    return 0.975 + Math.random() * 0.05; // 5% pitch variation
  }
  const isAttack = ATTACK_SOUNDS.has(soundId);
  if (isAttack) return 0.72 + Math.random() * 0.56;
  return 0.82 + Math.random() * 0.36;
}

function loadBuffer(soundId) {
  const path = SOUNDS[soundId];
  if (!path || bufferCache[soundId]) return loadPromises[soundId] || Promise.resolve(bufferCache[soundId]);
  if (!loadPromises[soundId]) {
    const c = getContext();
    const url = path.includes(" ") ? path.replace(/ /g, "%20") : path;
    loadPromises[soundId] = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`SFX ${soundId}: ${r.status}`); return r.arrayBuffer(); })
      .then((ab) => c.decodeAudioData(ab))
      .then((buf) => { bufferCache[soundId] = buf; return buf; })
      .catch((err) => {
        console.warn("Audio load failed:", soundId, url, err?.message || err);
        return null;
      });
  }
  return loadPromises[soundId];
}

function playWithBuffer(buf, soundId) {
  const c = getContext();
  if (c.state === "suspended") c.resume();
  const rate = randomPitch(soundId);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const gain = c.createGain();
  gain.gain.value = 0.5;
  src.connect(gain);
  gain.connect(c.destination);
  src.start(0);
}

export function play(soundId) {
  if (!enabled) return;
  let resolvedSoundId = soundId;
  if (soundId === "playerAttack") {
    const variants = ["attack1", "attack2", "attack3"];
    resolvedSoundId = variants[Math.floor(Math.random() * variants.length)];
  } else if (soundId === "playerDamaged") {
    const variants = ["damaged1", "damaged2", "damaged3"];
    resolvedSoundId = variants[Math.floor(Math.random() * variants.length)];
  } else if (soundId === "playerDash") {
    const variants = ["jump1", "jump2", "jump3"];
    resolvedSoundId = variants[Math.floor(Math.random() * variants.length)];
  } else if (soundId === "enemyDie") {
    const variants = ["popLow1", "popLow2"];
    resolvedSoundId = variants[Math.floor(Math.random() * variants.length)];
  }
  if (!SOUNDS[resolvedSoundId]) return;
  const buf = bufferCache[resolvedSoundId];
  if (buf) {
    playWithBuffer(buf, resolvedSoundId);
    return;
  }
  loadBuffer(resolvedSoundId).then((b) => { if (b) playWithBuffer(b, resolvedSoundId); }).catch((e) => { console.warn("SFX load/play failed:", resolvedSoundId, e); });
}

/** Start loading a sound so it is ready when play() is called. Swallows load errors (e.g. server down). */
export function preloadSound(soundId) {
  if (SOUNDS[soundId]) loadBuffer(soundId).catch(() => {});
}

export function setEnabled(on) {
  enabled = !!on;
}

export function isEnabled() {
  return enabled;
}

function getBgmAudio() {
  if (!bgmAudio) {
    bgmAudio = new Audio(BGM_PATH);
    bgmAudio.loop = true;
    bgmAudio.volume = bgmVolume;
    bgmAudio.preload = "auto";
  }
  return bgmAudio;
}

export function setBgmVolume(volume01) {
  bgmVolume = Math.max(0, Math.min(1, Number(volume01) || 0));
  if (bgmAudio) bgmAudio.volume = bgmVolume;
}

export function getBgmMuted() {
  try {
    return localStorage.getItem(BGM_MUTED_STORAGE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function setBgmMuted(muted) {
  try {
    localStorage.setItem(BGM_MUTED_STORAGE_KEY, muted ? "1" : "0");
  } catch (_) {}
  if (muted) stopBgm();
}

export function startBgm() {
  if (getBgmMuted()) return;
  const a = getBgmAudio();
  a.loop = true;
  a.volume = bgmVolume;
  const p = a.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

export function stopBgm() {
  if (!bgmAudio) return;
  bgmAudio.pause();
  try {
    bgmAudio.currentTime = 0;
  } catch (_) {}
}

