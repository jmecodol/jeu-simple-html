/**
 * render.js — all canvas drawing, zero game logic
 *
 * Export: draw()  — called once per frame by game.js
 */

import {
  SHIP_SIZE, BULLET_RADIUS,
  WIN_MILESTONE, LEVELS_TO_WIN, LEVEL_END_DURATION,
  TOP_COLOR, BOTTOM_COLOR,
  COOP_ENEMY_COLOR, COOP_WAVES_TO_WIN, COOP_WAVE_END_DURATION,
  COOP_MAX_PLAYER_DEATHS,
  BONUS_PILL_RADIUS,
  BONUS_COLORS, BONUS_ICONS,
  teamDir,
} from "./constants.js";
import { state } from "./state.js";

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

  if (type === "magnet") {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, Math.PI * 0.2, Math.PI * 1.8);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size * 0.2, y - size * 0.1, size * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
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

export function draw() {
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
    if (b.btype === "magnet_ball") {
      const rr = b.radius || 24;
      ctx.shadowBlur = 34;
      ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y, rr * 0.45, 0, Math.PI * 2); ctx.fillStyle = "#ffffffaa"; ctx.fill();
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
      ctx.shadowBlur = 14;
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
