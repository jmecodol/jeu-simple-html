(function () {
"use strict";

// ---- constants.js ----
// ── Ship & physics ──────────────────────────────────────────────────────────
const SHIP_SIZE = 36;
const BASE_BULLET_SPEED = 520;
const BULLET_RADIUS = 6;
const SHIP_HIT_RADIUS = 34;
const BASE_FIRE_INTERVAL = 190;
const MAX_HEAT = 100;
const SHOT_HEAT = 18;
const COOL_RATE = 34;
const HEAT_RECOVERY_LEVEL = 35;

// ── PvP ──────────────────────────────────────────────────────────────────────
const WIN_MILESTONE = 10;
const LEVELS_TO_WIN = 3;
const LEVEL_END_DURATION = 2800;
const TOP_COLOR = "#7bdff2";
const BOTTOM_COLOR = "#ff9f68";

// ── Coop ─────────────────────────────────────────────────────────────────────
const COOP_ENEMY_COLOR = "#ff4455";
const COOP_WAVES_TO_WIN = 5;
const COOP_WAVE_END_DURATION = 3000;
const COOP_ENEMY_SPAWN_INTERVAL = 900;
const COOP_ENEMY_BASE_MOVE_SPEED = 75;
const COOP_ENEMY_FIRE_RATE_MULTIPLIER = 0.55;
const COOP_ENEMY_BASE_HP = 6;
const COOP_ENEMY_HP_PER_WAVE = 2;
const COOP_MAX_PLAYER_DEATHS = 10;

// ── Bonus pills ───────────────────────────────────────────────────────────────
const BONUS_PILL_RADIUS = 14;
const BONUS_PILL_SPEED = 65;
const BONUS_PILL_LIFE = 9000;
const MAX_BONUS_PILLS = 3;
const BONUS_SPAWN_INTERVAL = 5500;
const BONUS_TYPES = [
  "laser", "ring", "rapid", "triple", "shield", "scatter",
  "sniper", "mega", "homing", "burst", "nova", "quake",
];
const BONUS_COLORS = {
  laser:    "#00eeff",
  ring:     "#cc44ff",
  rapid:    "#ffdd00",
  triple:   "#44ff88",
  shield:   "#4499ff",
  scatter:  "#ff6644",
  sniper:   "#e0e0ff",
  mega:     "#ff22aa",
  homing:   "#ffaa00",
  burst:    "#ff44ff",
  nova:     "#ff8800",
  quake:    "#ff5566",
};
const BONUS_ICONS = {
  laser:    "LZ",
  ring:     "RG",
  rapid:    "2X",
  triple:   "3",
  shield:   "SH",
  scatter:  "5",
  sniper:   "SN",
  mega:     "MG",
  homing:   "HM",
  burst:    "4",
  nova:     "NV",
  quake:    "QK",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the vertical firing direction (+1 down, -1 up) for a team. */
function teamDir(team) {
  if (team === "bottom") return -1;
  return 1; // "top", "player", "enemy"
}

// ---- bonusRegistry.js ----
/**
 * Bonus registry
 *
 * Centralises bonus behavior so adding a new bonus does not require
 * editing the core simulation loop.
 */

function makeFanProjectiles(ship, speed, angle, offsets, speedMultiplier = 1, btype = "normal") {
  return offsets.map((offset) => ({
    x: ship.x,
    y: ship.y,
    vx: Math.cos(angle + offset) * speed * speedMultiplier,
    vy: Math.sin(angle + offset) * speed * speedMultiplier,
    btype,
  }));
}

function makeRadialProjectiles(ship, speed, count, speedMultiplier, btype) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    result.push({
      x: ship.x,
      y: ship.y,
      vx: Math.cos(angle) * speed * speedMultiplier,
      vy: Math.sin(angle) * speed * speedMultiplier,
      btype,
    });
  }
  return result;
}

const bonusRegistry = {
  ring: {
    spawn({ ship, speed }) {
      return makeRadialProjectiles(ship, speed, 8, 0.85, "ring");
    },
  },
  laser: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 1.65, vy: aimVy * 1.65, btype: "laser" }];
    },
  },
  triple: {
    spawn({ ship, speed, aimAngle }) {
      return makeFanProjectiles(ship, speed, aimAngle, [-0.32, 0, 0.32], 1, "triple");
    },
  },
  scatter: {
    spawn({ ship, speed, aimAngle }) {
      return makeFanProjectiles(ship, speed, aimAngle, [-0.55, -0.28, 0, 0.28, 0.55], 0.9, "scatter");
    },
  },
  sniper: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 3.2, vy: aimVy * 3.2, btype: "sniper" }];
    },
  },
  mega: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 0.55, vy: aimVy * 0.55, btype: "mega" }];
    },
  },
  homing: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx, vy: aimVy, btype: "homing" }];
    },
  },
  burst: {
    spawn({ ship, speed, aimAngle }) {
      return makeFanProjectiles(ship, speed, aimAngle, [-0.12, -0.04, 0.04, 0.12], 1.1, "burst");
    },
  },
  nova: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 0.8, vy: aimVy * 0.8, btype: "nova" }];
    },
  },
  quake: {
    spawn({ ship, speed }) {
      return makeRadialProjectiles(ship, speed, 12, 1.05, "quake");
    },
  },
  // normal / rapid
  default: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx, vy: aimVy, btype: "normal" }];
    },
  },
};
function createProjectilesForBonusShot(context) {
  const behavior = bonusRegistry[context.type] || bonusRegistry.default;
  return behavior.spawn(context);
}
function applyCollectedBonus(ship, type) {
  if (type === "shield") {
    ship.shield = true;
    return;
  }

  ship.bonusType = type;
  ship.bonusExpiry = Infinity;
}

// ---- state.js ----
/**
 * Single shared mutable state object.
 * Every module imports this and reads/writes its properties directly.
 */
const state = {
  // Canvas — set by main.js after DOM is ready
  canvas: null,
  ctx: null,
  flashOverlay: null,

  // Live game entities
  ships: new Map(),
  bullets: [],
  activeLasers: [],
  explosions: [],
  bonusPills: [],
  pointerToShip: new Map(),
  shipDecks: {
    top: [],
    bottom: [],
    player: [],
  },

  bonusSpawnTimer: BONUS_SPAWN_INTERVAL,

  // ── Game mode ──────────────────────────────────────────────────────────────
  // null = menu  |  "pvp" = duel  |  "coop" = team vs enemies
  gameMode: null,

  // ── PvP state ──────────────────────────────────────────────────────────────
  teamWins: { top: 0, bottom: 0 },
  levelWins: { top: 0, bottom: 0 },
  currentLevel: 1,
  // "playing" | "levelEnd" | "matchEnd"
  gamePhase: "playing",
  levelEndWinner: null,
  levelEndTimer: 0,

  // ── Coop state ─────────────────────────────────────────────────────────────
  coopWave: 0,
  coopKills: 0,
  coopPlayerDeaths: 0,
  coopVictory: false,
  // "playing" | "waveEnd" | "matchEnd"
  coopWavePhase: "playing",
  coopWaveEndTimer: 0,
  coopEnemySpawnList: [],
  coopEnemySpawnTimer: 0,
  coopEnemyIdCounter: 0,

  // ── Misc ───────────────────────────────────────────────────────────────────
  lastTime: 0,
  audioCtx: null,
  audioUnlocked: false,
  flashTimeout: null,
};

// ---- audio.js ----
// ── Public API ────────────────────────────────────────────────────────────────
function unlockAudio() {
  state.audioUnlocked = true;
  if (state.audioCtx && state.audioCtx.state === "suspended") {
    state.audioCtx.resume().catch(() => {});
  }
}
function playBonusPickup() {
  if (!state.audioUnlocked) return;
  try {
    const ac = _ctx();
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.3, now + 0.06);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.95);

    const oscA = ac.createOscillator();
    const oscB = ac.createOscillator();
    oscA.type = "sawtooth";
    oscB.type = "triangle";
    oscB.detune.setValueAtTime(-7, now);

    const melody = [
      [392, 0.0],
      [494, 0.14],
      [466, 0.28],
      [587, 0.44],
      [523, 0.62],
    ];
    for (const [f, t] of melody) {
      oscA.frequency.setValueAtTime(f, now + t);
      oscB.frequency.setValueAtTime(f * 0.5, now + t);
    }

    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(6.5, now);
    lfoGain.gain.setValueAtTime(18, now);
    lfo.connect(lfoGain);
    lfoGain.connect(oscA.frequency);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(master);
    master.connect(ac.destination);

    oscA.start(now);
    oscB.start(now);
    lfo.start(now);
    oscA.stop(now + 0.95);
    oscB.stop(now + 0.95);
    lfo.stop(now + 0.95);
  } catch (_) {}
}
function playExplosion() {
  if (!state.audioUnlocked) return;
  try {
    const ac = _ctx();
    const bufferSize = ac.sampleRate * 0.45;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.15);
    }
    const source = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, ac.currentTime);
    filter.frequency.exponentialRampToValueAtTime(70, ac.currentTime + 0.45);
    gain.gain.setValueAtTime(1.5, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.45);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    source.start();
  } catch (_) {}
}
function playShot(type = "normal") {
  if (!state.audioUnlocked) return;
  try {
    const ac = _ctx();
    const now = ac.currentTime;

    if (type === "laser") {
      const main = ac.createOscillator();
      const body = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();

      main.type = "sawtooth";
      body.type = "triangle";
      main.frequency.setValueAtTime(980, now);
      main.frequency.exponentialRampToValueAtTime(260, now + 0.14);
      body.frequency.setValueAtTime(510, now);
      body.frequency.exponentialRampToValueAtTime(180, now + 0.14);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1450, now);
      filter.Q.setValueAtTime(7.5, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.19, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      main.connect(filter);
      body.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);

      main.start(now);
      body.start(now);
      main.stop(now + 0.14);
      body.stop(now + 0.14);
      return;
    }

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (_) {}
}

// ── Private ───────────────────────────────────────────────────────────────────

function _ctx() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

// ---- render.js ----
/**
 * render.js — all canvas drawing, zero game logic
 *
 * Export: draw()  — called once per frame by game.js
 */


// ── Ship drawing ──────────────────────────────────────────────────────────────

const spritePaths = {
  falcon: "./assets/ships/falcon.svg",
  xwing: "./assets/ships/xwing.svg",
  tie: "./assets/ships/tie.svg",
  cruiser: "./assets/ships/cruiser.svg",
};

const spriteCleanupSettings = {
  falcon: { threshold: 32, minSeedAlpha: 1, edgeSoftDist: 14, edgeSoftAlpha: 0.28, alphaClip: 26, haloAlpha: 90, alphaHardClip: 96 },
  xwing: { threshold: 36, minSeedAlpha: 1, edgeSoftDist: 16, edgeSoftAlpha: 0.22, alphaClip: 28, haloAlpha: 90, alphaHardClip: 96 },
  tie: { threshold: 44, minSeedAlpha: 1, edgeSoftDist: 18, edgeSoftAlpha: 0.2, alphaClip: 30, haloAlpha: 90, alphaHardClip: 96 },
  cruiser: { threshold: 30, minSeedAlpha: 1, edgeSoftDist: 14, edgeSoftAlpha: 0.3, alphaClip: 24, haloAlpha: 90, alphaHardClip: 96 },
  default: { threshold: 36, minSeedAlpha: 1, edgeSoftDist: 16, edgeSoftAlpha: 0.25, alphaClip: 28, haloAlpha: 90, alphaHardClip: 96 },
};

const spriteCache = {};

function getSprite(name) {
  if (!spriteCache[name]) {
    const img = new Image();
    img.src = spritePaths[name];
    spriteCache[name] = {
      name,
      img,
      drawable: null,
      processed: false,
    };
  }
  return spriteCache[name];
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getPixel(data, width, x, y) {
  const i = (y * width + x) * 4;
  return {
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  };
}

function prepareSpriteDrawable(spriteEntry) {
  if (spriteEntry.processed) return;
  spriteEntry.processed = true;

  const img = spriteEntry.img;
  const cleanup = spriteCleanupSettings[spriteEntry.name] || spriteCleanupSettings.default;
  if (!img.complete || img.naturalWidth === 0) return;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.drawImage(img, 0, 0);

  const imageData = octx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const borderPixels = [];
  const transparentBorderPixels = [];
  for (let x = 0; x < w; x++) {
    const pTop = getPixel(data, w, x, 0);
    const pBottom = getPixel(data, w, x, h - 1);
    borderPixels.push(pTop, pBottom);
    if (pTop.a <= cleanup.minSeedAlpha) transparentBorderPixels.push(pTop);
    if (pBottom.a <= cleanup.minSeedAlpha) transparentBorderPixels.push(pBottom);
  }
  for (let y = 1; y < h - 1; y++) {
    const pLeft = getPixel(data, w, 0, y);
    const pRight = getPixel(data, w, w - 1, y);
    borderPixels.push(pLeft, pRight);
    if (pLeft.a <= cleanup.minSeedAlpha) transparentBorderPixels.push(pLeft);
    if (pRight.a <= cleanup.minSeedAlpha) transparentBorderPixels.push(pRight);
  }

  const bgSamples = transparentBorderPixels.length >= 8 ? transparentBorderPixels : borderPixels;

  const avg = bgSamples.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 }
  );
  const bg = {
    r: avg.r / bgSamples.length,
    g: avg.g / bgSamples.length,
    b: avg.b / bgSamples.length,
  };

  const threshold = cleanup.threshold;
  const visited = new Uint8Array(w * h);
  const queue = [];

  function enqueueIfBackground(x, y) {
    const idx = y * w + x;
    if (visited[idx]) return;
    const p = getPixel(data, w, x, y);
    if (p.a <= cleanup.minSeedAlpha) {
      visited[idx] = 1;
      queue.push([x, y]);
      return;
    }
    if (colorDistance(p, bg) <= threshold) {
      visited[idx] = 1;
      queue.push([x, y]);
    }
  }

  for (let x = 0; x < w; x++) {
    enqueueIfBackground(x, 0);
    enqueueIfBackground(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    enqueueIfBackground(0, y);
    enqueueIfBackground(w - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    const pIndex = (y * w + x) * 4;
    data[pIndex + 3] = 0;

    if (x > 0) enqueueIfBackground(x - 1, y);
    if (x < w - 1) enqueueIfBackground(x + 1, y);
    if (y > 0) enqueueIfBackground(x, y - 1);
    if (y < h - 1) enqueueIfBackground(x, y + 1);
  }

  // If the source sprite still carries an opaque matte/background,
  // aggressively key out colors close to the detected border color.
  const matteThreshold = threshold + 12;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const p = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (colorDistance(p, bg) <= matteThreshold) {
      data[i + 3] = 0;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const p = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const dist = colorDistance(p, bg);
    if (dist < cleanup.edgeSoftDist) {
      data[i + 3] = Math.round(data[i + 3] * cleanup.edgeSoftAlpha);
    }
    if (data[i + 3] < cleanup.alphaClip) data[i + 3] = 0;
  }

  // Remove low-alpha haze connected to sprite borders to avoid visible rectangular halos.
  const haloVisited = new Uint8Array(w * h);
  const haloQueue = [];

  function enqueueHalo(x, y) {
    const idx = y * w + x;
    if (haloVisited[idx]) return;
    const alpha = data[idx * 4 + 3];
    if (alpha > cleanup.haloAlpha) return;
    haloVisited[idx] = 1;
    haloQueue.push([x, y]);
  }

  for (let x = 0; x < w; x++) {
    enqueueHalo(x, 0);
    enqueueHalo(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    enqueueHalo(0, y);
    enqueueHalo(w - 1, y);
  }

  while (haloQueue.length) {
    const [x, y] = haloQueue.pop();
    const pIndex = (y * w + x) * 4;
    data[pIndex + 3] = 0;
    if (x > 0) enqueueHalo(x - 1, y);
    if (x < w - 1) enqueueHalo(x + 1, y);
    if (y > 0) enqueueHalo(x, y - 1);
    if (y < h - 1) enqueueHalo(x, y + 1);
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < cleanup.alphaHardClip) data[i + 3] = 0;
  }

  octx.putImageData(imageData, 0, 0);
  spriteEntry.drawable = off;
}

function drawSpriteShip(x, y, spriteName, size, options = {}) {
  const ctx = state.ctx;
  const spriteEntry = getSprite(spriteName);
  const sprite = spriteEntry.img;
  const rotation = options.rotation || 0;
  const tintColor = options.tintColor || null;

  if (!sprite.complete || sprite.naturalWidth === 0) return false;
  prepareSpriteDrawable(spriteEntry);
  const drawable = spriteEntry.drawable || sprite;

  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.drawImage(drawable, -size, -size, size * 2, size * 2);

  void tintColor;

  ctx.restore();
  return true;
}

function drawShip(x, y, color, direction, model = null, size = SHIP_SIZE) {
  const rotation = direction > 0 ? Math.PI : 0;
  const spriteName = model || (direction > 0 ? "falcon" : "xwing");
  if (drawSpriteShip(x, y, spriteName, size, { rotation, tintColor: color })) return;

  const ctx = state.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + direction * size);
  ctx.lineTo(x - size * 0.65, y - direction * size * 0.5);
  ctx.lineTo(x + size * 0.65, y - direction * size * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawEnemyMonsterShip(x, y, direction, size, hpRatio = 1) {
  const usedSprite = drawSpriteShip(x, y, "tie", size * 1.08, {
    rotation: direction < 0 ? Math.PI : 0,
    tintColor: COOP_ENEMY_COLOR,
  });

  const ctx = state.ctx;
  if (!usedSprite) {
    ctx.save();
    ctx.translate(x, y);
    if (direction < 0) ctx.rotate(Math.PI);
    ctx.fillStyle = COOP_ENEMY_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, size * 1.05);
    ctx.lineTo(-size * 0.82, -size * 0.62);
    ctx.lineTo(-size * 0.32, -size * 0.22);
    ctx.lineTo(-size * 0.18, -size * 1.02);
    ctx.lineTo(0, -size * 0.72);
    ctx.lineTo(size * 0.18, -size * 1.02);
    ctx.lineTo(size * 0.32, -size * 0.22);
    ctx.lineTo(size * 0.82, -size * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  void hpRatio;
}

function drawShipHpBar(ship) {
  const ctx = state.ctx;
  if (!ship.maxHp || ship.maxHp <= 1) return;

  const ratio = Math.max(0, Math.min(1, ship.hp / ship.maxHp));
  const direction = teamDir(ship.team);
  const y = ship.y - direction * SHIP_SIZE * 1.55;
  const w = SHIP_SIZE * 1.75;
  const h = 6;
  const x = ship.x - w / 2;

  ctx.save();
  ctx.fillStyle = "#00000099";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ratio > 0.5 ? "#44ff88" : ratio > 0.25 ? "#ffdd00" : "#ff5566";
  ctx.fillRect(x, y, w * ratio, h);
  ctx.strokeStyle = "#ffffff88";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawDeckPreview(team, cfg) {
  const deck = state.shipDecks[team] || [];
  const preview = deck.slice(0, 3);
  const ctx = state.ctx;

  const cardW = 42;
  const cardH = 42;
  const gap = 8;
  const totalH = cardH * 3 + gap * 2;
  const startY = cfg.y - totalH / 2;

  ctx.save();
  ctx.textAlign = cfg.align;
  ctx.font = "bold 12px Arial";
  ctx.fillStyle = "#f7e4d2dd";
  ctx.fillText(`Réserve: ${deck.length}`, cfg.x, startY - 10);
  ctx.restore();

  for (let i = 0; i < 3; i++) {
    const y = startY + i * (cardH + gap);
    const x = cfg.align === "left" ? cfg.x : cfg.x - cardW;

    ctx.save();
    ctx.fillStyle = "#00000055";
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = "#ffffff33";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.restore();

    const model = preview[i];
    if (!model) continue;

    drawSpriteShip(
      x + cardW / 2,
      y + cardH / 2,
      model,
      15,
      {
        rotation: cfg.rotation,
        tintColor: cfg.color,
      }
    );
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function drawWinBar(team, labelY, barY) {
  const ctx = state.ctx;
  const { teamWins, levelWins } = state;
  const color = team === "top" ? TOP_COLOR : BOTTOM_COLOR;
  const barW = 120;
  const barH = 7;
  const x = 18;

  ctx.save();
  for (let m = 0; m < LEVELS_TO_WIN; m++) {
    ctx.beginPath();
    ctx.arc(x + m * 20 + 7, labelY - 10, 6, 0, Math.PI * 2);
    ctx.fillStyle = m < levelWins[team] ? color : "#ffffff22";
    ctx.fill();
  }
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  ctx.fillText(`Équipe ${team === "top" ? "haut" : "bas"} — victoires : ${teamWins[team]}`, x + LEVELS_TO_WIN * 20 + 4, labelY);
  ctx.fillStyle = "#ffffff22";
  ctx.fillRect(x, barY, barW, barH);
  ctx.fillStyle = color;
  ctx.fillRect(x, barY, (teamWins[team] % WIN_MILESTONE / WIN_MILESTONE) * barW, barH);
  ctx.fillStyle = "#000000aa";
  for (let i = 1; i < WIN_MILESTONE; i++) ctx.fillRect(x + (i / WIN_MILESTONE) * barW - 1, barY, 2, barH);
  ctx.restore();
}

function drawHud() {
  const ctx = state.ctx;
  if (state.gameMode === "coop") {
    drawCoopHud();
    return;
  }
  drawWinBar("top", 24, 30);
  drawWinBar("bottom", state.canvas.height - 14, state.canvas.height - 22);

  ctx.save();
  ctx.textAlign = "right";
  ctx.fillStyle = "#f7e4d2cc";
  ctx.font = "bold 14px Arial";
  ctx.fillText(`Niveau ${state.currentLevel}`, state.canvas.width - 18, 24);

  ctx.strokeStyle = "#ffffff22";
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(0, state.canvas.height / 2);
  ctx.lineTo(state.canvas.width, state.canvas.height / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#f7e4d288";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Toucher l'écran pour invoquer des vaisseaux — haut contre bas", state.canvas.width / 2, state.canvas.height / 2 + 18);
  ctx.restore();

  drawDeckPreview("top", {
    x: 14,
    y: state.canvas.height * 0.25,
    align: "left",
    rotation: Math.PI,
    color: TOP_COLOR,
  });

  drawDeckPreview("bottom", {
    x: state.canvas.width - 14,
    y: state.canvas.height * 0.75,
    align: "right",
    rotation: 0,
    color: BOTTOM_COLOR,
  });
}

function drawCoopHud() {
  const ctx = state.ctx;
  const cx = state.canvas.width / 2;
  ctx.save();
  ctx.font = "bold 14px Arial";

  ctx.textAlign = "center";
  ctx.fillStyle = "#f7e4d2cc";
  ctx.fillText(`Vague ${state.coopWave} / ${COOP_WAVES_TO_WIN}`, cx, 22);

  ctx.textAlign = "left";
  ctx.fillStyle = COOP_ENEMY_COLOR;
  ctx.fillText(`☠ ${state.coopKills}`, 18, 22);

  const livesLeft = Math.max(0, COOP_MAX_PLAYER_DEATHS - state.coopPlayerDeaths);
  ctx.textAlign = "right";
  ctx.fillStyle = livesLeft > 3 ? "#44ff88" : livesLeft > 0 ? "#ffdd00" : "#ff4455";
  ctx.fillText(`♥ ${livesLeft}`, state.canvas.width - 18, 22);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f7e4d255";
  ctx.font = "12px Arial";
  ctx.fillText("Toucher l'écran pour placer vos vaisseaux", cx, state.canvas.height - 10);
  ctx.restore();

  drawDeckPreview("player", {
    x: 14,
    y: state.canvas.height * 0.5,
    align: "left",
    rotation: 0,
    color: TOP_COLOR,
  });
}

// ── End-of-phase overlays ─────────────────────────────────────────────────────

function drawLevelEnd() {
  const ctx = state.ctx;
  const { levelEndWinner, levelEndTimer, currentLevel, levelWins } = state;
  const winColor = levelEndWinner === "top" ? TOP_COLOR : BOTTOM_COLOR;
  const winLabel = levelEndWinner === "top" ? "HAUT" : "BAS";
  const progress = Math.max(0, 1 - levelEndTimer / LEVEL_END_DURATION);
  const cx = state.canvas.width / 2;
  const cy = state.canvas.height / 2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 4);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  ctx.textAlign = "center";
  ctx.shadowColor = winColor;
  ctx.shadowBlur = 28;
  ctx.fillStyle = winColor;
  ctx.font = "bold 38px Arial";
  ctx.fillText(`ÉQUIPE ${winLabel} GAGNE !`, cx, cy - 28);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.shadowBlur = 12;
  ctx.fillText(`Niveau ${currentLevel} terminé`, cx, cy + 12);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f7e4d2cc";
  ctx.font = "16px Arial";
  ctx.fillText(`Niveau ${currentLevel + 1} dans…`, cx, cy + 46);
  const bw = 200;
  const bh = 8;
  ctx.fillStyle = "#ffffff22";
  ctx.fillRect(cx - bw / 2, cy + 60, bw, bh);
  ctx.fillStyle = winColor;
  ctx.fillRect(cx - bw / 2, cy + 60, bw * (1 - levelEndTimer / LEVEL_END_DURATION), bh);
  ctx.font = "bold 15px Arial";
  ctx.shadowBlur = 0;
  ctx.fillStyle = TOP_COLOR;
  ctx.fillText(`Haut : ${levelWins.top} niveau(x)`, cx - 80, cy + 95);
  ctx.fillStyle = BOTTOM_COLOR;
  ctx.fillText(`Bas : ${levelWins.bottom} niveau(x)`, cx + 80, cy + 95);
  ctx.restore();
}

function drawMatchEnd() {
  const ctx = state.ctx;
  const { levelEndWinner, levelWins } = state;
  const winColor = levelEndWinner === "top" ? TOP_COLOR : BOTTOM_COLOR;
  const winLabel = levelEndWinner === "top" ? "HAUT" : "BAS";
  const cx = state.canvas.width / 2;
  const cy = state.canvas.height / 2 - 40;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  ctx.textAlign = "center";
  ctx.shadowColor = winColor;
  ctx.shadowBlur = 36;
  ctx.fillStyle = winColor;
  ctx.font = "bold 44px Arial";
  ctx.fillText(`VICTOIRE — ÉQUIPE ${winLabel}`, cx, cy);
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#fff2d6";
  ctx.font = "bold 22px Arial";
  ctx.fillText(`${LEVELS_TO_WIN} niveaux remportés !`, cx, cy + 44);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f7e4d2aa";
  ctx.font = "16px Arial";
  ctx.fillText(`Haut : ${levelWins.top} · Bas : ${levelWins.bottom}`, cx, cy + 78);
  ctx.restore();
}

function drawCoopWaveEnd() {
  const ctx = state.ctx;
  const { coopWave, coopWaveEndTimer } = state;
  const progress = Math.max(0, 1 - coopWaveEndTimer / COOP_WAVE_END_DURATION);
  const cx = state.canvas.width / 2;
  const cy = state.canvas.height / 2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 4);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  ctx.textAlign = "center";
  ctx.shadowColor = "#44ff88";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#44ff88";
  ctx.font = "bold 38px Arial";
  ctx.fillText(`VAGUE ${coopWave} TERMINÉE !`, cx, cy - 28);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.shadowBlur = 12;
  ctx.fillText(`Prochaine vague : ${coopWave + 1}`, cx, cy + 16);
  ctx.shadowBlur = 0;
  const bw = 200;
  const bh = 8;
  ctx.fillStyle = "#ffffff22";
  ctx.fillRect(cx - bw / 2, cy + 36, bw, bh);
  ctx.fillStyle = "#44ff88";
  ctx.fillRect(cx - bw / 2, cy + 36, bw * (1 - coopWaveEndTimer / COOP_WAVE_END_DURATION), bh);
  ctx.restore();
}

function drawCoopMatchEnd() {
  const ctx = state.ctx;
  const { coopVictory, coopWave, coopKills, coopPlayerDeaths } = state;
  const cx = state.canvas.width / 2;
  const cy = state.canvas.height / 2 - 40;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  ctx.textAlign = "center";
  if (coopVictory) {
    ctx.shadowColor = "#44ff88";
    ctx.shadowBlur = 36;
    ctx.fillStyle = "#44ff88";
    ctx.font = "bold 44px Arial";
    ctx.fillText("VICTOIRE !", cx, cy);
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fff2d6";
    ctx.font = "bold 22px Arial";
    ctx.fillText(`${COOP_WAVES_TO_WIN} vagues survécues !`, cx, cy + 44);
  } else {
    ctx.shadowColor = COOP_ENEMY_COLOR;
    ctx.shadowBlur = 36;
    ctx.fillStyle = COOP_ENEMY_COLOR;
    ctx.font = "bold 44px Arial";
    ctx.fillText("DÉFAITE", cx, cy);
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fff2d6";
    ctx.font = "bold 22px Arial";
    ctx.fillText(`Vague ${coopWave} — ${coopKills} ennemi(s) éliminé(s)`, cx, cy + 44);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f7e4d2aa";
  ctx.font = "16px Arial";
  ctx.fillText(`Pertes subies : ${coopPlayerDeaths} / ${COOP_MAX_PLAYER_DEATHS}`, cx, cy + 80);
  ctx.restore();
}

// ── Bonus pills ───────────────────────────────────────────────────────────────

function drawBonusIcon(ctx, type, x, y, size, color) {
  const line = Math.max(1.2, size * 0.14);

  function drawCountRing(count) {
    const ringR = size * 0.58;
    const dotR = Math.max(1.8, size * 0.16);
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffffcc";
    ctx.lineWidth = Math.max(1.2, size * 0.08);
    ctx.stroke();
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * ringR, y + Math.sin(a) * ringR, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }

  function drawForwardFan(count) {
    const fanR = size * 0.58;
    const dotR = Math.max(1.8, size * 0.16);
    const spread = Math.PI * 0.7;
    const start = -Math.PI / 2 - spread / 2;

    ctx.beginPath();
    ctx.arc(x, y, fanR, -Math.PI / 2 - spread / 2, -Math.PI / 2 + spread / 2);
    ctx.strokeStyle = "#ffffffcc";
    ctx.lineWidth = Math.max(1.2, size * 0.08);
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const a = start + t * spread;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * fanR, y + Math.sin(a) * fanR, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }

  if (type === "triple") { drawForwardFan(3); return; }
  if (type === "burst") { drawForwardFan(4); return; }
  if (type === "scatter") { drawForwardFan(5); return; }

  if (type === "rapid") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = line;
    for (const ox of [-size * 0.18, size * 0.12]) {
      ctx.beginPath();
      ctx.moveTo(x + ox - size * 0.22, y - size * 0.2);
      ctx.lineTo(x + ox, y);
      ctx.lineTo(x + ox - size * 0.22, y + size * 0.2);
      ctx.stroke();
    }
    return;
  }

  if (type === "laser") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.45, y);
    ctx.lineTo(x + size * 0.45, y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.4, y);
    ctx.lineTo(x + size * 0.4, y);
    ctx.stroke();
    return;
  }

  if (type === "ring") { drawCountRing(8); return; }

  if (type === "shield") {
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.45);
    ctx.lineTo(x + size * 0.34, y - size * 0.1);
    ctx.lineTo(x + size * 0.24, y + size * 0.36);
    ctx.lineTo(x - size * 0.24, y + size * 0.36);
    ctx.lineTo(x - size * 0.34, y - size * 0.1);
    ctx.closePath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = line;
    ctx.stroke();
    return;
  }

  if (type === "sniper") {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - size * 0.52, y);
    ctx.lineTo(x + size * 0.52, y);
    ctx.moveTo(x, y - size * 0.52);
    ctx.lineTo(x, y + size * 0.52);
    ctx.stroke();
    return;
  }

  if (type === "mega") {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }

  if (type === "homing") {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, -Math.PI * 0.9, Math.PI * 0.45);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = line;
    ctx.stroke();
    return;
  }

  if (type === "nova") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * size * 0.55, y + Math.sin(a) * size * 0.55);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = line * 0.9;
      ctx.stroke();
    }
    return;
  }

  if (type === "quake") { drawCountRing(12); return; }

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(8, Math.round(size * 0.9))}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(BONUS_ICONS[type], x, y);
  ctx.textBaseline = "alphabetic";
}

function drawBonusPills(nowMs) {
  const ctx = state.ctx;
  for (const pill of state.bonusPills) {
    const alpha = pill.life < 2000 ? pill.life / 2000 : 1;
    const r = BONUS_PILL_RADIUS * (1 + 0.18 * Math.sin(pill.pulse));
    const spin = nowMs * 0.0022 + pill.pulse;
    const shimmer = 0.75 + 0.25 * Math.sin(nowMs * 0.008 + pill.pulse * 1.7);

    ctx.save();
    ctx.globalAlpha = alpha * shimmer;
    ctx.shadowColor = pill.color;
    ctx.shadowBlur = 20 + 8 * Math.sin(nowMs * 0.01 + pill.pulse);
    ctx.beginPath();
    ctx.arc(pill.x, pill.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = pill.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Rotating accent arc for a more dynamic pickup read.
    ctx.beginPath();
    ctx.arc(pill.x, pill.y, r + 3, spin, spin + Math.PI * 0.9);
    ctx.strokeStyle = "#ffffffaa";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const grad = ctx.createRadialGradient(pill.x, pill.y, 0, pill.x, pill.y, r * 0.7);
    grad.addColorStop(0, pill.color + "88");
    grad.addColorStop(1, pill.color + "00");
    ctx.beginPath();
    ctx.arc(pill.x, pill.y, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Orbiting spark to make bonus motion feel alive.
    const sx = pill.x + Math.cos(spin) * (r + 4.5);
    const sy = pill.y + Math.sin(spin) * (r + 4.5);
    ctx.beginPath();
    ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffffdd";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.save();
    ctx.translate(pill.x, pill.y);
    ctx.rotate(spin * 0.25);
    drawBonusIcon(ctx, pill.type, 0, 0, r * 0.85, pill.color);
    ctx.restore();
    ctx.restore();
  }
}

// ── Main draw ─────────────────────────────────────────────────────────────────
function draw() {
  const ctx = state.ctx;
  const { canvas, ships, bullets, activeLasers, explosions, gameMode, gamePhase, coopWavePhase } = state;
  const nowMs = performance.now();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#2a1308");
  bg.addColorStop(0.5, "#4b250f");
  bg.addColorStop(1, "#251106");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff08";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  ctx.fillStyle = "#00000010";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

  // Ships
  for (const ship of ships.values()) {
    if (!ship.active) continue;
    ctx.save();
    if (ship.overheated)               ctx.globalAlpha = 0.45;
    drawShipHpBar(ship);
    if (ship.team === "enemy") {
      drawEnemyMonsterShip(ship.x, ship.y, teamDir(ship.team), SHIP_SIZE * 1.08, ship.maxHp > 0 ? ship.hp / ship.maxHp : 1);
    } else {
      drawShip(ship.x, ship.y, ship.color, teamDir(ship.team), ship.model);
    }
    ctx.restore();

    // Shield bubble
    if (ship.shield) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, SHIP_SIZE * 1.45, 0, Math.PI * 2);
      ctx.strokeStyle = "#4499ff";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#4499ff";
      ctx.shadowBlur = 14;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // Permanent bonus badge
    if (ship.bonusType) {
      const iy = ship.team === "top" ? ship.y - SHIP_SIZE * 1.35 : ship.y + SHIP_SIZE * 1.35;
      const pulse = 0.82 + 0.18 * Math.sin(nowMs * 0.012 + ship.x * 0.01 + ship.y * 0.01);
      const ringSpin = nowMs * 0.0035;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(ship.x, iy, 9, 0, Math.PI * 2);
      ctx.strokeStyle = BONUS_COLORS[ship.bonusType];
      ctx.lineWidth = 3;
      ctx.shadowColor = BONUS_COLORS[ship.bonusType];
      ctx.shadowBlur = 8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ship.x, iy, 11, ringSpin, ringSpin + Math.PI * 0.85);
      ctx.strokeStyle = "#ffffffbb";
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 0;
      ctx.stroke();

      drawBonusIcon(ctx, ship.bonusType, ship.x, iy, 9, BONUS_COLORS[ship.bonusType]);
      ctx.restore();
    }
  }

  // Continuous laser beams
  for (const laser of activeLasers) {
    ctx.save();
    ctx.strokeStyle = laser.color;
    ctx.lineWidth = 4.5;
    ctx.shadowColor = laser.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();

    ctx.strokeStyle = "#ffffffcc";
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.restore();
  }

  // Bullets
  for (const b of bullets) {
    ctx.save();
    ctx.shadowColor = b.color;
    if (b.btype === "laser") {
      const a = Math.atan2(b.vy, b.vx);
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(-20, -2.5, 40, 5);
      ctx.fillStyle = b.color;   ctx.fillRect(-18, -1.5, 36, 3);
    } else if (b.btype === "sniper") {
      const a = Math.atan2(b.vy, b.vx);
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(-30, -1.2, 60, 2.4);
      ctx.fillStyle = b.color;   ctx.fillRect(-28, -0.6, 56, 1.2);
    } else if (b.btype === "mega") {
      ctx.shadowBlur = 28;
      ctx.beginPath(); ctx.arc(b.x, b.y, 18, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fillStyle = "#ffffffaa"; ctx.fill();
    } else if (b.btype === "nova") {
      ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(b.x, b.y, BULLET_RADIUS * 1.5, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
    } else if (b.btype === "nova_shard") {
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, BULLET_RADIUS * 0.5, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
    } else {
      const r = b.btype === "ring" ? BULLET_RADIUS * 0.78
              : b.btype === "scatter" ? BULLET_RADIUS * 0.9
              : b.btype === "quake" ? BULLET_RADIUS * 1.05
              : BULLET_RADIUS;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowBlur = b.btype === "homing" ? 18 : 14;
      ctx.fill();
    }
    ctx.restore();
  }

  // Explosions
  for (const exp of explosions) {
    for (const p of exp.particles) {
      if (p.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }
  }

  drawHud();
  drawBonusPills(nowMs);

  if (gameMode === "pvp") {
    if (gamePhase === "levelEnd") drawLevelEnd();
    if (gamePhase === "matchEnd") drawMatchEnd();
  } else if (gameMode === "coop") {
    if (coopWavePhase === "waveEnd") drawCoopWaveEnd();
    if (coopWavePhase === "matchEnd") drawCoopMatchEnd();
  }
}

// ---- game.js ----
/**
 * game.js — all simulation logic
 *
 * Exports:
 *   clampX / clampY       — used by input.js
 *   createShip            — used by input.js
 *   resize                — used by input.js (window resize handler)
 *   showMenu / startGame  — used by input.js (button handlers)
 *   gameLoop              — used by main.js to start rAF
 */





const PLAYER_SHIP_STOCK = 50;
const PLAYER_SHIP_MODELS = ["falcon", "xwing", "cruiser"];
const LASER_TICK_INTERVAL = 120;

const BULLET_DAMAGE = {
  normal: 1,
  ring: 2,
  scatter: 2,
  triple: 2,
  burst: 2,
  quake: 2,
  homing: 2,
  laser: 4,
  mega: 4,
  sniper: 5,
  nova: 3,
  nova_shard: 2,
};

// ── Geometry helpers ──────────────────────────────────────────────────────────
function clampX(x) {
  return Math.min(Math.max(x, SHIP_SIZE + 12), state.canvas.width - SHIP_SIZE - 12);
}
function clampY(y) {
  return Math.min(Math.max(y, SHIP_SIZE + 12), state.canvas.height - SHIP_SIZE - 12);
}

// ── Game-speed helpers (depend on currentLevel) ───────────────────────────────

function getBulletSpeed() {
  return BASE_BULLET_SPEED + (state.currentLevel - 1) * 40;
}

function getFireInterval() {
  const base = Math.max(80, BASE_FIRE_INTERVAL - (state.currentLevel - 1) * 15);
  // Global default cadence: half as many shots per second.
  return base * 2;
}

function getShipFireInterval(ship) {
  const base = getFireInterval();
  if (ship.team === "enemy") return Math.max(60, base * COOP_ENEMY_FIRE_RATE_MULTIPLIER);
  // Rapid now fires 2x faster than the previous rapid behavior.
  if (ship.bonusType === "rapid" || ship.bonusType === "triple") return base * 0.21;
  // Mega, burst(4) and scatter(5): +100% fire rate.
  if (ship.bonusType === "mega" || ship.bonusType === "burst" || ship.bonusType === "scatter") {
    return base * 0.5;
  }
  // Ring and quake are also projectile-spread bonuses.
  if (ship.bonusType === "ring" || ship.bonusType === "quake") {
    return base * (2 / 3);
  }
  return base;
}

function getBulletDamage(btype) {
  return BULLET_DAMAGE[btype] || 1;
}

function getNearestEnemy(ship, speed) {
  let nearest = null;
  let minDist = Infinity;
  let aimVx = 0;
  let aimVy = teamDir(ship.team) * speed;

  for (const other of state.ships.values()) {
    if (other.team === ship.team || !other.active) continue;
    const dx = other.x - ship.x;
    const dy = other.y - ship.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = other;
      const len = dist || 1;
      aimVx = (dx / len) * speed;
      aimVy = (dy / len) * speed;
    }
  }

  return { nearest, aimVx, aimVy };
}

function getRayEnd(x, y, vx, vy) {
  const W = state.canvas.width;
  const H = state.canvas.height;
  const tx = vx > 0 ? (W - x) / vx : (vx < 0 ? (0 - x) / vx : Infinity);
  const ty = vy > 0 ? (H - y) / vy : (vy < 0 ? (0 - y) / vy : Infinity);
  const t = Math.min(
    tx > 0 ? tx : Infinity,
    ty > 0 ? ty : Infinity
  );
  return {
    x: x + vx * (Number.isFinite(t) ? t : 0),
    y: y + vy * (Number.isFinite(t) ? t : 0),
  };
}

function updateLaserBeam(ship, now, sec) {
  const speed = getBulletSpeed();
  const { nearest, aimVx, aimVy } = getNearestEnemy(ship, speed);
  if (!nearest && !aimVx && !aimVy) return;

  const end = nearest
    ? { x: nearest.x, y: nearest.y }
    : getRayEnd(ship.x, ship.y, aimVx, aimVy);

  state.activeLasers.push({
    x1: ship.x,
    y1: ship.y,
    x2: end.x,
    y2: end.y,
    color: ship.color,
  });

  ship.heat = Math.min(MAX_HEAT, ship.heat + SHOT_HEAT * sec * 0.9);
  if (ship.heat >= MAX_HEAT) ship.overheated = true;

  if (nearest && now - ship.lastFire >= LASER_TICK_INTERVAL) {
    destroyShip(nearest, ship.color, getBulletDamage("laser"));
    ship.lastFire = now;
    playShot("laser");
  }
}

function createShipDeck(count) {
  const deck = [];
  for (let i = 0; i < count; i++) {
    deck.push(PLAYER_SHIP_MODELS[Math.floor(Math.random() * PLAYER_SHIP_MODELS.length)]);
  }
  return deck;
}

function initShipDecks() {
  if (state.gameMode === "pvp") {
    state.shipDecks.top = createShipDeck(PLAYER_SHIP_STOCK);
    state.shipDecks.bottom = createShipDeck(PLAYER_SHIP_STOCK);
    state.shipDecks.player = [];
  } else if (state.gameMode === "coop") {
    state.shipDecks.top = [];
    state.shipDecks.bottom = [];
    state.shipDecks.player = createShipDeck(PLAYER_SHIP_STOCK);
  }
}
function consumeShipModel(team, preferredModel = null) {
  const deck = state.shipDecks[team];
  if (!deck || deck.length === 0) return null;

  if (preferredModel) {
    const preferredIndex = deck.findIndex((model, index) => index < 3 && model === preferredModel);
    if (preferredIndex >= 0) {
      return deck.splice(preferredIndex, 1)[0];
    }
  }

  return deck.shift();
}

// ── Flash overlay ─────────────────────────────────────────────────────────────

function blendColors(hex1, hex2) {
  const r = Math.round((parseInt(hex1.slice(1, 3), 16) + parseInt(hex2.slice(1, 3), 16)) / 2);
  const g = Math.round((parseInt(hex1.slice(3, 5), 16) + parseInt(hex2.slice(3, 5), 16)) / 2);
  const b = Math.round((parseInt(hex1.slice(5, 7), 16) + parseInt(hex2.slice(5, 7), 16)) / 2);
  return `rgb(${r},${g},${b})`;
}

function triggerFlash(color1, color2) {
  if (state.flashTimeout) clearTimeout(state.flashTimeout);
  state.flashOverlay.style.backgroundColor = blendColors(color1, color2);
  let count = 0;
  function step() {
    if (count >= 8) { state.flashOverlay.style.opacity = "0"; state.flashTimeout = null; return; }
    state.flashOverlay.style.opacity = count % 2 === 0 ? "0.65" : "0";
    count++;
    state.flashTimeout = setTimeout(step, 10);
  }
  step();
}

// ── Entity creation ───────────────────────────────────────────────────────────
function createShip(id, team, x, y, colorOverride) {
  const color = colorOverride
    ?? (team === "top" ? TOP_COLOR : team === "bottom" ? BOTTOM_COLOR : team === "enemy" ? COOP_ENEMY_COLOR : TOP_COLOR);
  const defaultModel = team === "enemy" ? "tie" : team === "bottom" ? "xwing" : "falcon";
  return {
    id, team, color,
    x: clampX(x), y: clampY(y),
    heat: 0, lastFire: 0, active: true, overheated: false,
    bonusType: null, bonusExpiry: 0,
    shield: false,
    model: defaultModel,
    hp: 10, maxHp: 10,
  };
}

function createExplosion(x, y, color) {
  const particles = [];
  for (let i = 0; i < 26; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 250;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, size: 4 + Math.random() * 8, color });
  }
  state.explosions.push({ particles });
}

// ── Combat ────────────────────────────────────────────────────────────────────

function destroyShip(ship, bulletColor, damage = 1) {
  // Shield absorbs one hit
  if (ship.shield) {
    ship.shield = false;
    ship.bonusType = null;
    createExplosion(ship.x, ship.y, "#4499ff");
    return;
  }
  // Every ship dies after losing 10 HP (hp reaches 0)
  if (ship.hp > damage) {
    ship.hp -= damage;
    createExplosion(ship.x, ship.y, ship.team === "enemy" ? "#ff6677" : ship.color);
    triggerFlash(bulletColor, ship.color);
    return;
  }

  createExplosion(ship.x, ship.y, ship.color);
  playExplosion();
  triggerFlash(bulletColor, ship.color);

  state.ships.delete(ship.id);
  for (const [ptId, shipId] of state.pointerToShip.entries()) {
    if (shipId === ship.id) { state.pointerToShip.delete(ptId); break; }
  }

  if (state.gameMode === "coop") {
    if (ship.team === "enemy") {
      state.coopKills++;
    } else if (ship.team === "player") {
      state.coopPlayerDeaths++;
      if (state.coopPlayerDeaths >= COOP_MAX_PLAYER_DEATHS && state.coopWavePhase === "playing") {
        state.coopWavePhase = "matchEnd";
        state.coopVictory = false;
        document.getElementById("replayButton").style.display = "block";
      }
    }
    return;
  }

  // PvP
  const winningTeam = ship.team === "top" ? "bottom" : "top";
  state.teamWins[winningTeam] += 1;
  if (state.teamWins[winningTeam] >= WIN_MILESTONE && state.gamePhase === "playing") {
    state.levelWins[winningTeam] += 1;
    state.levelEndWinner = winningTeam;
    if (state.levelWins[winningTeam] >= LEVELS_TO_WIN) {
      state.gamePhase = "matchEnd";
      document.getElementById("replayButton").style.display = "block";
    } else {
      state.gamePhase = "levelEnd";
      state.levelEndTimer = LEVEL_END_DURATION;
    }
  }
}

function fireBullet(ship, now) {
  ship.lastFire = now;
  const speed = getBulletSpeed();
  const type = ship.bonusType;

  // Default aim: toward nearest enemy, fallback to straight ahead
  const { aimVx, aimVy } = getNearestEnemy(ship, speed);

  const aimAngle = Math.atan2(aimVy, aimVx);
  const projectiles = createProjectilesForBonusShot({
    type,
    ship,
    speed,
    aimVx,
    aimVy,
    aimAngle,
  });
  for (const projectile of projectiles) {
    state.bullets.push({ ...projectile, color: ship.color, ownerTeam: ship.team });
  }

  ship.heat = Math.min(MAX_HEAT, ship.heat + SHOT_HEAT);
  if (ship.heat >= MAX_HEAT) ship.overheated = true;
  playShot(type || "normal");
}

// ── Bonus pills ───────────────────────────────────────────────────────────────

function spawnBonusPill() {
  if (state.bonusPills.length >= MAX_BONUS_PILLS) return;
  const type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
  const margin = BONUS_PILL_RADIUS + 24;
  const x = margin + Math.random() * (state.canvas.width - margin * 2);
  const y = margin + Math.random() * (state.canvas.height - margin * 2);
  const angle = Math.random() * Math.PI * 2;
  state.bonusPills.push({
    x, y,
    vx: Math.cos(angle) * BONUS_PILL_SPEED,
    vy: Math.sin(angle) * BONUS_PILL_SPEED,
    type, color: BONUS_COLORS[type],
    life: BONUS_PILL_LIFE,
    pulse: Math.random() * Math.PI * 2,
  });
}

function updateBonusPills(dt, sec, now) {
  state.bonusSpawnTimer -= dt;
  if (state.bonusSpawnTimer <= 0) {
    spawnBonusPill();
    state.bonusSpawnTimer = BONUS_SPAWN_INTERVAL;
  }

  for (let i = state.bonusPills.length - 1; i >= 0; i--) {
    const pill = state.bonusPills[i];
    pill.life -= dt;
    pill.pulse += dt * 0.0045;
    pill.x += pill.vx * sec;
    pill.y += pill.vy * sec;
    const W = state.canvas.width;
    const H = state.canvas.height;
    if (pill.x < BONUS_PILL_RADIUS)  { pill.x = BONUS_PILL_RADIUS;  pill.vx =  Math.abs(pill.vx); }
    if (pill.x > W - BONUS_PILL_RADIUS) { pill.x = W - BONUS_PILL_RADIUS; pill.vx = -Math.abs(pill.vx); }
    if (pill.y < BONUS_PILL_RADIUS)  { pill.y = BONUS_PILL_RADIUS;  pill.vy =  Math.abs(pill.vy); }
    if (pill.y > H - BONUS_PILL_RADIUS) { pill.y = H - BONUS_PILL_RADIUS; pill.vy = -Math.abs(pill.vy); }
    if (pill.life <= 0) { state.bonusPills.splice(i, 1); continue; }

    let collected = false;
    for (const ship of state.ships.values()) {
      if (!ship.active) continue;
      const dx = pill.x - ship.x;
      const dy = pill.y - ship.y;
      if (Math.sqrt(dx * dx + dy * dy) < SHIP_HIT_RADIUS + BONUS_PILL_RADIUS) {
        applyCollectedBonus(ship, pill.type);
        state.bonusPills.splice(i, 1);
        playBonusPickup();
        collected = true;
        break;
      }
    }
    if (collected) continue;
  }
}

// ── Level / wave management ───────────────────────────────────────────────────

function _resetEntities() {
  state.bullets.length = 0;
  state.explosions.length = 0;
  state.bonusPills.length = 0;
  state.bonusSpawnTimer = BONUS_SPAWN_INTERVAL;
  state.ships.clear();
  state.pointerToShip.clear();
  state.lastTime = 0;
}

function startNextLevel() {
  state.currentLevel += 1;
  state.teamWins = { top: 0, bottom: 0 };
  _resetEntities();
  state.gamePhase = "playing";
  state.levelEndWinner = null;
}

function startCoopWave(wave) {
  state.coopWave = wave;
  state.currentLevel = wave; // reuse speed/fire-rate scaling
  state.coopWavePhase = "playing";
  state.coopWaveEndTimer = 0;
  // Remove remaining enemies
  for (const [id, ship] of state.ships.entries()) {
    if (ship.team === "enemy") state.ships.delete(id);
  }
  state.bullets.length = 0;
  state.bonusPills.length = 0;
  state.bonusSpawnTimer = BONUS_SPAWN_INTERVAL;
  // Queue enemies: 3 on wave 1, +1 per wave
  const margin = 70;
  state.coopEnemySpawnList = Array.from({ length: 2 + wave }, () => ({
    x: margin + Math.random() * (state.canvas.width - margin * 2),
    y: state.canvas.height * 0.25 + Math.random() * state.canvas.height * 0.5,
  }));
  state.coopEnemySpawnTimer = 600;
}

function startNextCoopWave() {
  startCoopWave(state.coopWave + 1);
}

// ── Public: canvas resize ─────────────────────────────────────────────────────
function resize() {
  const rect = state.canvas.getBoundingClientRect();
  state.canvas.width = rect.width;
  state.canvas.height = rect.height;
  for (const ship of state.ships.values()) {
    ship.x = clampX(ship.x);
    ship.y = clampY(ship.y);
  }
}

// ── Public: game flow ─────────────────────────────────────────────────────────
function resetGame() {
  _resetEntities();
  initShipDecks();
  document.getElementById("replayButton").style.display = "none";
  resize();

  if (state.gameMode === "pvp") {
    state.teamWins = { top: 0, bottom: 0 };
    state.levelWins = { top: 0, bottom: 0 };
    state.currentLevel = 1;
    state.gamePhase = "playing";
    state.levelEndWinner = null;
    state.levelEndTimer = 0;
  } else if (state.gameMode === "coop") {
    state.coopKills = 0;
    state.coopPlayerDeaths = 0;
    state.coopVictory = false;
    state.coopEnemySpawnList = [];
    state.coopEnemySpawnTimer = 0;
    state.coopEnemyIdCounter = 0;
    startCoopWave(1);
  }
}
function showMenu() {
  state.gameMode = null;
  state.ships.clear();
  state.pointerToShip.clear();
  state.bullets.length = 0;
  state.explosions.length = 0;
  state.bonusPills.length = 0;
  document.getElementById("menuScreen").style.display = "flex";
  document.getElementById("replayButton").style.display = "none";
  resize();
}
function startGame(mode) {
  state.gameMode = mode;
  document.getElementById("menuScreen").style.display = "none";
  resetGame();
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state.gameMode === null) return;

  // Phase-transition gates
  if (state.gameMode === "pvp") {
    if (state.gamePhase === "levelEnd") {
      state.levelEndTimer -= dt;
      if (state.levelEndTimer <= 0) startNextLevel();
      return;
    }
    if (state.gamePhase === "matchEnd") return;
  } else if (state.gameMode === "coop") {
    if (state.coopWavePhase === "waveEnd") {
      state.coopWaveEndTimer -= dt;
      if (state.coopWaveEndTimer <= 0) startNextCoopWave();
      return;
    }
    if (state.coopWavePhase === "matchEnd") return;
  }

  const now = performance.now();
  const sec = dt / 1000;
  state.activeLasers.length = 0;

  // ── Coop: spawn queued enemies
  if (state.gameMode === "coop" && state.coopEnemySpawnList.length > 0) {
    state.coopEnemySpawnTimer -= dt;
    if (state.coopEnemySpawnTimer <= 0) {
      const pos = state.coopEnemySpawnList.shift();
      const id = `enemy_${state.coopEnemyIdCounter++}`;
      const ship = createShip(id, "enemy", pos.x, pos.y);
      ship.lastFire = performance.now() + 800 + Math.random() * 600;
      state.ships.set(id, ship);
      state.coopEnemySpawnTimer = COOP_ENEMY_SPAWN_INTERVAL;
    }
  }

  // ── Coop: enemy AI
  if (state.gameMode === "coop") {
    for (const ship of state.ships.values()) {
      if (ship.team !== "enemy") continue;
      let targetX = ship.x;
      let targetY = state.canvas.height * 0.8;
      let minDist = Infinity;
      let targetShip = null;
      for (const other of state.ships.values()) {
        if (other.team !== "player") continue;
        const dx = other.x - ship.x;
        const dy = other.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) { minDist = dist; targetX = other.x; targetY = other.y; targetShip = other; }
      }
      const dx = targetX - ship.x;
      const dy = targetY - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = COOP_ENEMY_BASE_MOVE_SPEED * (1 + Math.min(1.2, (state.coopWave - 1) * 0.15));
      if (dist > 56) {
        ship.x = clampX(ship.x + (dx / dist) * speed * sec);
        ship.y = clampY(ship.y + (dy / dist) * speed * sec);
      }
      if (targetShip && minDist <= SHIP_HIT_RADIUS * 0.95 && targetShip.active) {
        destroyShip(targetShip, ship.color, 2);
      }
    }

    // Wave completion check
    if (state.coopWavePhase === "playing" && state.coopEnemySpawnList.length === 0) {
      const enemiesAlive = [...state.ships.values()].filter(s => s.team === "enemy").length;
      if (enemiesAlive === 0 && state.coopEnemyIdCounter > 0) {
        if (state.coopWave >= COOP_WAVES_TO_WIN) {
          state.coopWavePhase = "matchEnd";
          state.coopVictory = true;
          document.getElementById("replayButton").style.display = "block";
        } else {
          state.coopWavePhase = "waveEnd";
          state.coopWaveEndTimer = COOP_WAVE_END_DURATION;
        }
      }
    }
  }

  // ── Heat + auto-fire
  for (const ship of state.ships.values()) {
    ship.heat = Math.max(0, ship.heat - COOL_RATE * sec);
    if (ship.overheated && ship.heat <= HEAT_RECOVERY_LEVEL) ship.overheated = false;
    if (!ship.active) continue;

    if (ship.bonusType === "laser") {
      updateLaserBeam(ship, now, sec);
      continue;
    }

    if (now - ship.lastFire >= getShipFireInterval(ship)) fireBullet(ship, now);
  }

  // ── Bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * sec;
    b.y += b.vy * sec;

    // Homing steering
    if (b.btype === "homing") {
      let nearest = null;
      let minD = Infinity;
      for (const s of state.ships.values()) {
        if (s.team === b.ownerTeam || !s.active) continue;
        const dx = s.x - b.x;
        const dy = s.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) { minD = d; nearest = s; }
      }
      if (nearest) {
        const dx = nearest.x - b.x;
        const dy = nearest.y - b.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const turnRate = 3.2 * sec;
        const cur = Math.atan2(b.vy, b.vx);
        let dA = Math.atan2(dy / len, dx / len) - cur;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        const newA = cur + Math.sign(dA) * Math.min(Math.abs(dA), turnRate);
        const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(newA) * spd;
        b.vy = Math.sin(newA) * spd;
      }
    }

    const W = state.canvas.width;
    const H = state.canvas.height;
    if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50) {
      state.bullets.splice(i, 1);
      continue;
    }

    const bRadius = b.btype === "mega" ? 18 : b.btype === "nova" ? BULLET_RADIUS * 3 : BULLET_RADIUS;
    let hit = false;
    for (const ship of state.ships.values()) {
      if (ship.team === b.ownerTeam || !ship.active) continue;
      if (b.hitShips && b.hitShips.has(ship.id)) continue;
      const dx = b.x - ship.x;
      const dy = b.y - ship.y;
      if (Math.sqrt(dx * dx + dy * dy) < SHIP_HIT_RADIUS + bRadius) {
        if (b.btype === "nova") {
          const novaSpeed = getBulletSpeed();
          for (let n = 0; n < 6; n++) {
            const na = (n / 6) * Math.PI * 2;
            state.bullets.push({ x: b.x, y: b.y, vx: Math.cos(na) * novaSpeed * 0.65, vy: Math.sin(na) * novaSpeed * 0.65, color: b.color, ownerTeam: b.ownerTeam, btype: "nova_shard" });
          }
        }
        destroyShip(ship, b.color, getBulletDamage(b.btype));
        state.bullets.splice(i, 1);
        hit = true;
        break;
      }
    }
    if (hit) continue;
  }

  // ── Explosions
  for (let e = state.explosions.length - 1; e >= 0; e--) {
    let alive = false;
    for (const p of state.explosions[e].particles) {
      p.x += p.vx * sec;
      p.y += p.vy * sec;
      p.vy += 180 * sec;
      p.life -= sec * 1.8;
      if (p.life > 0) alive = true;
    }
    if (!alive) state.explosions.splice(e, 1);
  }

  updateBonusPills(dt, sec, now);
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function gameLoop(timestamp) {
  const dt = state.lastTime ? Math.min(timestamp - state.lastTime, 100) : 16;
  state.lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// ---- input.js ----
const TOUCH_AHEAD_OFFSET = 78;
const DECK_CARD_W = 42;
const DECK_CARD_H = 42;
const DECK_CARD_GAP = 8;

function getForwardTouchY(y, team) {
  const dir = team === "bottom" ? -1 : 1;
  return clampY(y + dir * TOUCH_AHEAD_OFFSET);
}

function getDeckPreviewConfig(team, canvas) {
  if (team === "top") {
    return { x: 14, y: canvas.height * 0.25, align: "left" };
  }
  if (team === "bottom") {
    return { x: canvas.width - 14, y: canvas.height * 0.75, align: "right" };
  }
  return { x: 14, y: canvas.height * 0.5, align: "left" };
}

function getPreferredShipModelAtPoint(x, y, team, canvas) {
  const deck = state.shipDecks[team] || [];
  const previewCount = Math.min(3, deck.length);
  if (previewCount === 0) return null;

  const cfg = getDeckPreviewConfig(team, canvas);
  const totalH = DECK_CARD_H * 3 + DECK_CARD_GAP * 2;
  const startY = cfg.y - totalH / 2;

  for (let i = 0; i < previewCount; i++) {
    const cardY = startY + i * (DECK_CARD_H + DECK_CARD_GAP);
    const cardX = cfg.align === "left" ? cfg.x : cfg.x - DECK_CARD_W;
    const isInside =
      x >= cardX &&
      x <= cardX + DECK_CARD_W &&
      y >= cardY &&
      y <= cardY + DECK_CARD_H;

    if (isInside) return deck[i];
  }

  return null;
}
function setupInput() {
  const canvas = state.canvas;

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    unlockAudio();
    const isPlaying = state.gameMode === "pvp"
      ? state.gamePhase === "playing"
      : state.coopWavePhase === "playing";
    if (state.gameMode === null || !isPlaying) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const team = state.gameMode === "coop"
      ? "player"
      : (y < canvas.height / 2 ? "top" : "bottom");

    const shipId = `touch_${e.pointerId}`;
    if (state.ships.has(shipId)) return;

    const preferredModel = getPreferredShipModelAtPoint(x, y, team, canvas);
    const model = consumeShipModel(team, preferredModel);
    if (!model) return;

    const ship = createShip(shipId, team, x, getForwardTouchY(y, team));
    ship.model = model;
    ship.lastFire = performance.now();
    state.ships.set(shipId, ship);
    state.pointerToShip.set(e.pointerId, shipId);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    e.preventDefault();
    const shipId = state.pointerToShip.get(e.pointerId);
    if (!shipId) return;
    const ship = state.ships.get(shipId);
    if (!ship) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ship.x = clampX((e.clientX - rect.left) * scaleX);
    ship.y = getForwardTouchY((e.clientY - rect.top) * scaleY, ship.team);
  });

  function releasePointer(e) {
    const shipId = state.pointerToShip.get(e.pointerId);
    if (shipId) {
      state.ships.delete(shipId);
      state.pointerToShip.delete(e.pointerId);
    }
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  window.addEventListener("resize", resize);

  document.getElementById("btnPvp").addEventListener("click", () => startGame("pvp"));
  document.getElementById("btnCoop").addEventListener("click", () => startGame("coop"));
  document.getElementById("replayButton").addEventListener("click", showMenu);
}

// ---- main.js ----
/**
 * main.js — entry point
 *
 * Initialises the canvas + flash overlay in the shared state,
 * wires up input, and starts the game loop.
 *
 * ES modules are deferred by default, so the DOM is ready when this runs.
 */



// ── Bootstrap ─────────────────────────────────────────────────────────────────

state.canvas = document.getElementById("gameCanvas");
state.ctx = state.canvas.getContext("2d");

state.flashOverlay = document.createElement("div");
state.flashOverlay.style.cssText =
  "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;z-index:10;";
document.body.appendChild(state.flashOverlay);

setupInput();
showMenu();
requestAnimationFrame(gameLoop);

})();
