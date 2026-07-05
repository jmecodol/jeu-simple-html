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

import {
  SHIP_SIZE, BASE_BULLET_SPEED, BULLET_RADIUS, SHIP_HIT_RADIUS,
  BASE_FIRE_INTERVAL, MAX_HEAT, SHOT_HEAT, COOL_RATE, HEAT_RECOVERY_LEVEL, TOUCH_AHEAD_OFFSET,
  WIN_MILESTONE, LEVELS_TO_WIN, LEVEL_END_DURATION,
  TOP_COLOR, BOTTOM_COLOR,
  COOP_ENEMY_COLOR, COOP_WAVES_TO_WIN, COOP_WAVE_END_DURATION,
  COOP_ENEMY_SPAWN_INTERVAL, COOP_ENEMY_BASE_MOVE_SPEED,
  COOP_ENEMY_FIRE_RATE_MULTIPLIER,
  COOP_MAX_PLAYER_DEATHS,
  BONUS_PILL_RADIUS, BONUS_PILL_SPEED, BONUS_PILL_LIFE,
  MAX_BONUS_PILLS, BONUS_SPAWN_INTERVAL,
  BONUS_TYPES, BONUS_COLORS,
  teamDir,
} from "./constants.js";
import { state } from "./state.js";
import { playExplosion, playShot, playBonusPickup } from "./audio.js";
import { createProjectilesForBonusShot, applyCollectedBonus } from "./bonusRegistry.js";
import { draw } from "./render.js";

const PLAYER_SHIP_STOCK = 50;
const PLAYER_SHIP_MODELS = ["falcon", "xwing", "cruiser"];
const LASER_TICK_INTERVAL = 220;

const BULLET_DAMAGE = {
  normal: 1,
  ring: 2,
  scatter: 2,
  triple: 2,
  burst: 2,
  quake: 2,
  laser: 4,
  nova: 3,
  nova_shard: 2,
  magnet_ball: 10,
};

// ── Geometry helpers ──────────────────────────────────────────────────────────

export function clampX(x) {
  return Math.min(Math.max(x, SHIP_SIZE + 12), state.canvas.width - SHIP_SIZE - 12);
}

export function clampY(y) {
  return Math.min(Math.max(y, SHIP_SIZE + 12), state.canvas.height - SHIP_SIZE - 12);
}

// ── Game-speed helpers (depend on currentLevel) ───────────────────────────────

function getBulletSpeed() {
  return (BASE_BULLET_SPEED + (state.currentLevel - 1) * 40) * 1.3;
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
  // Burst(4) and scatter(5): +100% fire rate.
  if (ship.bonusType === "burst" || ship.bonusType === "scatter") {
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

function fireMagnetBall(ship) {
  const speed = getBulletSpeed() * 0.92;
  const { nearest, aimVx, aimVy } = getNearestEnemy(ship, speed);
  const charge = Math.max(1, ship.magnetCharge || 0);
  const damageScale = Math.min(18, 8 + charge);
  const radiusScale = Math.min(34, 20 + charge * 0.9);

  state.bullets.push({
    x: ship.x,
    y: ship.y,
    vx: nearest ? aimVx : 0,
    vy: nearest ? aimVy : teamDir(ship.team) * speed,
    color: ship.color,
    ownerTeam: ship.team,
    btype: "magnet_ball",
    damage: damageScale,
    radius: radiusScale,
  });
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

export function consumeShipModel(team, preferredModel = null) {
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

export function createShip(id, team, x, y, colorOverride) {
  const color = colorOverride
    ?? (team === "top" ? TOP_COLOR : team === "bottom" ? BOTTOM_COLOR : team === "enemy" ? COOP_ENEMY_COLOR : TOP_COLOR);
  const defaultModel = team === "enemy" ? "tie" : team === "bottom" ? "xwing" : "falcon";
  return {
    id, team, color,
    x: clampX(x), y: clampY(y),
    heat: 0, lastFire: 0, active: true, overheated: false,
    bonusType: null, bonusExpiry: 0,
    magnetCharge: 0,
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
  // Magnet converts incoming damage into a huge counter projectile.
  if (ship.bonusType === "magnet") {
    fireMagnetBall(ship);
    ship.magnetCharge = 0;
    createExplosion(ship.x, ship.y, "#66e0ff");
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
    const pickupDistance = SHIP_HIT_RADIUS + BONUS_PILL_RADIUS;
    for (const ship of state.ships.values()) {
      if (!ship.active) continue;
      const dx = pill.x - ship.x;
      const dy = pill.y - ship.y;
      const shipTouchesPill = Math.sqrt(dx * dx + dy * dy) < pickupDistance;

      let fingerTouchesPill = false;
      if (!shipTouchesPill && ship.id.startsWith("touch_")) {
        const fingerX = ship.x;
        const fingerY = clampY(ship.y - teamDir(ship.team) * TOUCH_AHEAD_OFFSET);
        const tx = pill.x - fingerX;
        const ty = pill.y - fingerY;
        fingerTouchesPill = Math.sqrt(tx * tx + ty * ty) < pickupDistance;
      }

      if (shipTouchesPill || fingerTouchesPill) {
        if (pill.type === "magnet") {
          ship.bonusType = "magnet";
          ship.bonusExpiry = Infinity;
          const absorbed = state.bullets.length;
          ship.magnetCharge = Math.max(1, ship.magnetCharge + absorbed);
          state.bullets.length = 0;
        } else {
          applyCollectedBonus(ship, pill.type);
        }
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

export function resize() {
  const rect = state.canvas.getBoundingClientRect();
  state.canvas.width = rect.width;
  state.canvas.height = rect.height;
  for (const ship of state.ships.values()) {
    ship.x = clampX(ship.x);
    ship.y = clampY(ship.y);
  }
}

// ── Public: game flow ─────────────────────────────────────────────────────────

export function resetGame() {
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

export function showMenu() {
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

export function startGame(mode) {
  state.gameMode = mode;
  document.getElementById("menuScreen").style.display = "none";
  resetGame();
}

// ── Update ────────────────────────────────────────────────────────────────────

export function update(dt) {
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

    if (now - ship.lastFire >= getShipFireInterval(ship)) fireBullet(ship, now);
  }

  // ── Bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * sec;
    b.y += b.vy * sec;

    const W = state.canvas.width;
    const H = state.canvas.height;
    if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50) {
      state.bullets.splice(i, 1);
      continue;
    }

    const bRadius = b.btype === "nova" ? BULLET_RADIUS * 3 : b.btype === "magnet_ball" ? (b.radius || 24) : BULLET_RADIUS;
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
        destroyShip(ship, b.color, b.damage || getBulletDamage(b.btype));
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

export function gameLoop(timestamp) {
  const dt = state.lastTime ? Math.min(timestamp - state.lastTime, 100) : 16;
  state.lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}
