// ── Constants ──────────────────────────────────────────────────────────────────

const WIN_SCORE = 7;
const BALL_SPEED_INIT = 0.45;   // fraction of short side per second
const BALL_SPEED_MAX = 0.95;
const BALL_SPEED_BUMP = 0.04;   // speed increase per paddle hit
const PUCK_RADIUS_FRAC = 0.055; // fraction of short side
const BALL_RADIUS_FRAC = 0.028;
const GOAL_WIDTH_FRAC = 0.38;   // fraction of field height for goal width

// ── DOM refs ──────────────────────────────────────────────────────────────────

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  running: false,
  w: 0,
  h: 0,
  puckR: 0,
  ballR: 0,
  goalW: 0,
  scoreLeft: 0,
  scoreRight: 0,
  left: { x: 0, y: 0, vx: 0, vy: 0, pointerId: null },
  right: { x: 0, y: 0, vx: 0, vy: 0, pointerId: null },
  ball: { x: 0, y: 0, vx: 0, vy: 0, speed: 0 },
  flashTimer: 0,       // >0 → scoring flash in progress
  flashSide: null,     // "left" | "right"
  scored: false,
};

// ── Resize ────────────────────────────────────────────────────────────────────

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.w = rect.width;
  state.h = rect.height;

  const short = Math.min(state.w, state.h);
  state.puckR = short * PUCK_RADIUS_FRAC;
  state.ballR = short * BALL_RADIUS_FRAC;
  state.goalW = state.h * GOAL_WIDTH_FRAC;

  // reposition pucks on resize
  state.left.x = state.w * 0.2;
  state.left.y = state.h * 0.5;
  state.right.x = state.w * 0.8;
  state.right.y = state.h * 0.5;
}

// ── Ball launch ───────────────────────────────────────────────────────────────

function launchBall(towardLeft = null) {
  const s = state;
  s.ball.x = s.w / 2;
  s.ball.y = s.h / 2;
  s.ball.speed = s.w * BALL_SPEED_INIT;

  // launch toward the player who conceded (or random if null)
  const dir = towardLeft === null ? (Math.random() < 0.5 ? -1 : 1) : (towardLeft ? -1 : 1);
  const angle = (Math.random() * 0.5 - 0.25) * Math.PI; // ±45°
  s.ball.vx = dir * Math.cos(angle) * s.ball.speed;
  s.ball.vy = Math.sin(angle) * s.ball.speed;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetGame() {
  const s = state;
  s.scoreLeft = 0;
  s.scoreRight = 0;
  s.scored = false;
  s.flashTimer = 0;
  s.flashSide = null;

  s.left.x = s.w * 0.2;
  s.left.y = s.h * 0.5;
  s.left.vx = 0;
  s.left.vy = 0;
  s.left.pointerId = null;

  s.right.x = s.w * 0.8;
  s.right.y = s.h * 0.5;
  s.right.vx = 0;
  s.right.vy = 0;
  s.right.pointerId = null;

  launchBall(null);
}

// ── Input ─────────────────────────────────────────────────────────────────────

function pointFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

canvas.addEventListener("pointerdown", (evt) => {
  if (!state.running) return;
  canvas.setPointerCapture(evt.pointerId);
  const p = pointFromEvent(evt);
  const s = state;

  if (p.x < s.w * 0.5 && s.left.pointerId === null) {
    s.left.pointerId = evt.pointerId;
    s.left.vx = 0;
    s.left.vy = 0;
  } else if (p.x >= s.w * 0.5 && s.right.pointerId === null) {
    s.right.pointerId = evt.pointerId;
    s.right.vx = 0;
    s.right.vy = 0;
  }
});

canvas.addEventListener("pointermove", (evt) => {
  if (!state.running) return;
  const p = pointFromEvent(evt);
  const s = state;

  if (evt.pointerId === s.left.pointerId) {
    s.left.vx = p.x - s.left.x;
    s.left.vy = p.y - s.left.y;
    s.left.x = p.x;
    s.left.y = p.y;
  } else if (evt.pointerId === s.right.pointerId) {
    s.right.vx = p.x - s.right.x;
    s.right.vy = p.y - s.right.y;
    s.right.x = p.x;
    s.right.y = p.y;
  }
});

function releasePointer(pointerId) {
  const s = state;
  if (pointerId === s.left.pointerId) {
    s.left.pointerId = null;
    s.left.vx = 0;
    s.left.vy = 0;
  }
  if (pointerId === s.right.pointerId) {
    s.right.pointerId = null;
    s.right.vx = 0;
    s.right.vy = 0;
  }
}

canvas.addEventListener("pointerup", (evt) => releasePointer(evt.pointerId));
canvas.addEventListener("pointercancel", (evt) => releasePointer(evt.pointerId));

// ── Physics helpers ───────────────────────────────────────────────────────────

function clampPuck(puck) {
  const s = state;
  const r = s.puckR;
  const half = s.w / 2;

  if (puck === s.left) {
    puck.x = Math.max(r, Math.min(half - r, puck.x));
  } else {
    puck.x = Math.max(half + r, Math.min(s.w - r, puck.x));
  }
  puck.y = Math.max(r, Math.min(s.h - r, puck.y));
}

function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

function resolvePuckBallCollision(puck, ball) {
  const s = state;
  const dx = ball.x - puck.x;
  const dy = ball.y - puck.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = s.puckR + s.ballR;

  if (dist >= minDist || dist === 0) return false;

  // Normal direction
  const nx = dx / dist;
  const ny = dy / dist;

  // Push ball out of puck
  ball.x = puck.x + nx * minDist;
  ball.y = puck.y + ny * minDist;

  // Relative velocity
  const relVx = ball.vx - puck.vx;
  const relVy = ball.vy - puck.vy;
  const dot = relVx * nx + relVy * ny;

  if (dot >= 0) return false; // already separating

  // Reflect ball
  ball.vx -= 2 * dot * nx;
  ball.vy -= 2 * dot * ny;

  // Add puck velocity contribution
  ball.vx += puck.vx * 0.5;
  ball.vy += puck.vy * 0.5;

  // Speed up ball after each hit, capped at max
  const curSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const newSpeed = Math.min(curSpeed + s.w * BALL_SPEED_BUMP, s.w * BALL_SPEED_MAX);
  const scale = newSpeed / (curSpeed || 1);
  ball.vx *= scale;
  ball.vy *= scale;
  ball.speed = newSpeed;

  return true;
}

// ── Goal detection ────────────────────────────────────────────────────────────

function checkGoal() {
  const s = state;
  const ball = s.ball;
  const goalTop = (s.h - s.goalW) / 2;
  const goalBot = goalTop + s.goalW;

  let scorer = null;

  if (ball.x - s.ballR <= 0) {
    if (ball.y >= goalTop && ball.y <= goalBot) {
      scorer = "right"; // right player scored (ball entered left goal)
    } else {
      // missed goal — bounce off wall
      ball.x = s.ballR;
      ball.vx = Math.abs(ball.vx);
    }
  } else if (ball.x + s.ballR >= s.w) {
    if (ball.y >= goalTop && ball.y <= goalBot) {
      scorer = "left"; // left player scored
    } else {
      ball.x = s.w - s.ballR;
      ball.vx = -Math.abs(ball.vx);
    }
  }

  if (scorer) {
    if (scorer === "left") {
      s.scoreLeft += 1;
    } else {
      s.scoreRight += 1;
    }
    s.flashSide = scorer;
    s.flashTimer = 0.9;
    s.scored = true;

    if (s.scoreLeft >= WIN_SCORE || s.scoreRight >= WIN_SCORE) {
      // game over — handled in update after flash
    }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

function update(dt) {
  const s = state;

  if (s.flashTimer > 0) {
    s.flashTimer = Math.max(0, s.flashTimer - dt);
    if (s.flashTimer === 0) {
      if (s.scoreLeft >= WIN_SCORE || s.scoreRight >= WIN_SCORE) {
        endGame();
        return;
      }
      // relaunch toward the player who conceded (opposite of scorer)
      s.scored = false;
      launchBall(s.flashSide !== "left");
    }
    return;
  }

  const ball = s.ball;

  // Move ball
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Top / bottom walls
  if (ball.y - s.ballR <= 0) {
    ball.y = s.ballR;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y + s.ballR >= s.h) {
    ball.y = s.h - s.ballR;
    ball.vy = -Math.abs(ball.vy);
  }

  // Clamp pucks
  clampPuck(s.left);
  clampPuck(s.right);

  // Puck–ball collisions
  resolvePuckBallCollision(s.left, ball);
  resolvePuckBallCollision(s.right, ball);

  // Goal check
  checkGoal();
}

// ── End game ──────────────────────────────────────────────────────────────────

function endGame() {
  state.running = false;
  overlay.classList.add("show");
  const won = state.scoreLeft >= WIN_SCORE ? "Joueur 1 (Bleu)" : "Joueur 2 (Rouge)";
  overlay.querySelector("h2").textContent = `🏆 ${won} gagne !`;
  overlay.querySelector("p").textContent =
    `Score final : ${state.scoreLeft} – ${state.scoreRight}. Beau match !`;
  startBtn.textContent = "Rejouer";
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

function drawBackground() {
  const s = state;
  ctx.fillStyle = "#0d0b1a";
  ctx.fillRect(0, 0, s.w, s.h);
}

function drawField() {
  const s = state;

  // Playing surface
  const grad = ctx.createLinearGradient(0, 0, s.w, 0);
  grad.addColorStop(0, "#0d1a3a");
  grad.addColorStop(0.5, "#14103a");
  grad.addColorStop(1, "#3a0d1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s.w, s.h);

  // Centre line
  ctx.strokeStyle = "#ffffff44";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(s.w / 2, 0);
  ctx.lineTo(s.w / 2, s.h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Centre circle
  ctx.strokeStyle = "#ffffff22";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.w / 2, s.h / 2, Math.min(s.w, s.h) * 0.12, 0, Math.PI * 2);
  ctx.stroke();

  // Goals
  const goalTop = (s.h - s.goalW) / 2;
  const goalBot = goalTop + s.goalW;
  const goalDepth = s.w * 0.03;

  // Left goal (blue)
  ctx.fillStyle = "#4fc3f733";
  ctx.fillRect(0, goalTop, goalDepth, s.goalW);
  ctx.strokeStyle = "#4fc3f7aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, goalTop);
  ctx.lineTo(goalDepth, goalTop);
  ctx.lineTo(goalDepth, goalBot);
  ctx.lineTo(0, goalBot);
  ctx.stroke();

  // Right goal (red)
  ctx.fillStyle = "#ef535033";
  ctx.fillRect(s.w - goalDepth, goalTop, goalDepth, s.goalW);
  ctx.strokeStyle = "#ef5350aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s.w, goalTop);
  ctx.lineTo(s.w - goalDepth, goalTop);
  ctx.lineTo(s.w - goalDepth, goalBot);
  ctx.lineTo(s.w, goalBot);
  ctx.stroke();
}

function drawPuck(puck, color, glowColor) {
  const r = state.puckR;

  // Glow
  const grd = ctx.createRadialGradient(puck.x, puck.y, r * 0.3, puck.x, puck.y, r * 2.2);
  grd.addColorStop(0, glowColor + "88");
  grd.addColorStop(1, "#00000000");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyGrd = ctx.createRadialGradient(puck.x - r * 0.3, puck.y - r * 0.3, r * 0.1, puck.x, puck.y, r);
  bodyGrd.addColorStop(0, "#ffffffcc");
  bodyGrd.addColorStop(0.3, color);
  bodyGrd.addColorStop(1, glowColor + "88");
  ctx.fillStyle = bodyGrd;
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Rim
  ctx.strokeStyle = "#ffffffaa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBall() {
  const s = state;
  const b = s.ball;
  const r = s.ballR;

  // Glow trail
  const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 5);
  grd.addColorStop(0, "#ffd74066");
  grd.addColorStop(1, "#00000000");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 5, 0, Math.PI * 2);
  ctx.fill();

  // Ball body
  const ballGrd = ctx.createRadialGradient(b.x - r * 0.4, b.y - r * 0.4, r * 0.1, b.x, b.y, r);
  ballGrd.addColorStop(0, "#fff");
  ballGrd.addColorStop(0.5, "#ffd740");
  ballGrd.addColorStop(1, "#e65100");
  ctx.fillStyle = ballGrd;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud() {
  const s = state;

  // Score panel
  ctx.fillStyle = "#00000066";
  ctx.fillRect(s.w / 2 - 70, 8, 140, 38);

  ctx.fillStyle = "#4fc3f7";
  ctx.font = "bold 22px 'Trebuchet MS'";
  ctx.textAlign = "right";
  ctx.fillText(String(s.scoreLeft), s.w / 2 - 14, 34);

  ctx.fillStyle = "#ffffff88";
  ctx.font = "bold 18px 'Trebuchet MS'";
  ctx.textAlign = "center";
  ctx.fillText("–", s.w / 2, 34);

  ctx.fillStyle = "#ef5350";
  ctx.font = "bold 22px 'Trebuchet MS'";
  ctx.textAlign = "left";
  ctx.fillText(String(s.scoreRight), s.w / 2 + 14, 34);

  ctx.textAlign = "left";

  // Player labels
  ctx.fillStyle = "#4fc3f799";
  ctx.font = "bold 13px 'Trebuchet MS'";
  ctx.fillText("J1", 10, s.h - 10);

  ctx.fillStyle = "#ef535099";
  ctx.textAlign = "right";
  ctx.fillText("J2", s.w - 10, s.h - 10);
  ctx.textAlign = "left";
}

function drawScoringFlash() {
  const s = state;
  if (s.flashTimer <= 0) return;

  const alpha = Math.min(1, s.flashTimer) * 0.38;
  if (s.flashSide === "left") {
    // left player scored → flash left side
    const grd = ctx.createLinearGradient(0, 0, s.w / 2, 0);
    grd.addColorStop(0, `rgba(79,195,247,${alpha})`);
    grd.addColorStop(1, "rgba(79,195,247,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s.w / 2, s.h);
  } else {
    // right player scored → flash right side
    const grd = ctx.createLinearGradient(s.w / 2, 0, s.w, 0);
    grd.addColorStop(0, "rgba(239,83,80,0)");
    grd.addColorStop(1, `rgba(239,83,80,${alpha})`);
    ctx.fillStyle = grd;
    ctx.fillRect(s.w / 2, 0, s.w / 2, s.h);
  }

  // "GOAL!" text
  const goalAlpha = Math.min(1, s.flashTimer * 3);
  const color = s.flashSide === "left" ? "#4fc3f7" : "#ef5350";
  ctx.globalAlpha = goalAlpha;
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(s.h * 0.09)}px 'Trebuchet MS'`;
  ctx.textAlign = "center";
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText("GOAL!", s.w / 2, s.h / 2 + 10);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  drawBackground();
  drawField();

  if (state.running) {
    update(dt);
  }

  drawBall();
  drawPuck(state.left, "#1565c0", "#4fc3f7");
  drawPuck(state.right, "#b71c1c", "#ef5350");
  drawHud();
  drawScoringFlash();

  requestAnimationFrame(frame);
}

// ── Start / restart ───────────────────────────────────────────────────────────

function start() {
  resizeCanvas();
  resetGame();
  state.running = true;
  overlay.classList.remove("show");
}

startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", start);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
requestAnimationFrame(frame);
