const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const state = {
  running: false,
  width: 0,
  height: 0,
  leftTouch: null,
  rightTouch: null,
  leftGlow: { x: 0, y: 0 },
  rightGlow: { x: 0, y: 0 },
  flowers: [],
  score: 0,
  total: 10,
  timeLeft: 60,
  startedAt: 0,
};

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = rect.width;
  state.height = rect.height;
}

function resetGame() {
  state.flowers = [];
  state.score = 0;
  state.timeLeft = 60;
  state.startedAt = performance.now();
  state.leftTouch = null;
  state.rightTouch = null;
  state.leftGlow = { x: state.width * 0.25, y: state.height * 0.75 };
  state.rightGlow = { x: state.width * 0.75, y: state.height * 0.75 };

  for (let i = 0; i < state.total; i += 1) {
    const duo = i % 3 === 0;
    state.flowers.push({
      x: 40 + Math.random() * (state.width - 80),
      y: 50 + Math.random() * (state.height - 120),
      radius: 18 + Math.random() * 8,
      energy: 0,
      target: duo ? 2.4 : 1.4,
      duo,
      done: false,
    });
  }
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function assignTouch(event) {
  const p = pointFromEvent(event);
  const onLeft = p.x < state.width * 0.5;

  if (onLeft) {
    state.leftTouch = event.pointerId;
    state.leftGlow = p;
  } else {
    state.rightTouch = event.pointerId;
    state.rightGlow = p;
  }
}

canvas.addEventListener("pointerdown", (event) => {
  if (!state.running) return;
  canvas.setPointerCapture(event.pointerId);
  assignTouch(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.running) return;
  const p = pointFromEvent(event);
  if (event.pointerId === state.leftTouch) {
    state.leftGlow = p;
  }
  if (event.pointerId === state.rightTouch) {
    state.rightGlow = p;
  }
});

function releaseTouch(pointerId) {
  if (pointerId === state.leftTouch) {
    state.leftTouch = null;
  }
  if (pointerId === state.rightTouch) {
    state.rightTouch = null;
  }
}

canvas.addEventListener("pointerup", (event) => {
  releaseTouch(event.pointerId);
});

canvas.addEventListener("pointercancel", (event) => {
  releaseTouch(event.pointerId);
});

function drawBackground(now) {
  const t = now * 0.0001;
  const grad = ctx.createLinearGradient(0, 0, state.width, state.height);
  grad.addColorStop(0, "#0a1630");
  grad.addColorStop(0.5, "#112a31");
  grad.addColorStop(1, "#22311e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.width, state.height);

  for (let i = 0; i < 36; i += 1) {
    const x = ((i * 71.23) % state.width) + Math.sin(t + i) * 14;
    const y = ((i * 39.11) % state.height) + Math.cos(t * 1.4 + i) * 8;
    ctx.fillStyle = "#ffffff66";
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDivider() {
  ctx.strokeStyle = "#ffffff44";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(state.width / 2, 0);
  ctx.lineTo(state.width / 2, state.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGlow(glow, color) {
  const aura = ctx.createRadialGradient(glow.x, glow.y, 5, glow.x, glow.y, 60);
  aura.addColorStop(0, color);
  aura.addColorStop(1, "#00000000");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(glow.x, glow.y, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(glow.x, glow.y, 8, 0, Math.PI * 2);
  ctx.fill();
}

function updateFlowers(dt) {
  for (const flower of state.flowers) {
    if (flower.done) continue;
    const d1 = Math.hypot(flower.x - state.leftGlow.x, flower.y - state.leftGlow.y);
    const d2 = Math.hypot(flower.x - state.rightGlow.x, flower.y - state.rightGlow.y);

    const leftIn = d1 < 70;
    const rightIn = d2 < 70;

    let gain = 0;
    if (flower.duo) {
      gain = leftIn && rightIn ? dt : -dt * 0.5;
    } else {
      gain = leftIn || rightIn ? dt : -dt * 0.5;
    }

    flower.energy = Math.max(0, Math.min(flower.target, flower.energy + gain));

    if (flower.energy >= flower.target) {
      flower.done = true;
      state.score += 1;
    }
  }
}

function drawFlowers() {
  for (const flower of state.flowers) {
    const ratio = flower.energy / flower.target;
    const bloom = flower.done ? 1 : ratio;

    ctx.save();
    ctx.translate(flower.x, flower.y);

    for (let p = 0; p < 6; p += 1) {
      const angle = (Math.PI * 2 * p) / 6;
      const px = Math.cos(angle) * (flower.radius * 0.7);
      const py = Math.sin(angle) * (flower.radius * 0.7);
      ctx.fillStyle = flower.duo ? `rgba(255,150,188,${0.35 + bloom * 0.65})` : `rgba(132,244,189,${0.35 + bloom * 0.65})`;
      ctx.beginPath();
      ctx.arc(px, py, flower.radius * (0.35 + bloom * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = flower.done ? "#ffe17d" : "#f7f5d2";
    ctx.beginPath();
    ctx.arc(0, 0, flower.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();

    if (flower.duo && !flower.done) {
      ctx.strokeStyle = "#fff6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, flower.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawHud() {
  ctx.fillStyle = "#00000066";
  ctx.fillRect(10, 10, state.width - 20, 36);

  ctx.fillStyle = "#fff";
  ctx.font = "700 16px Trebuchet MS";
  ctx.fillText(`Fleurs: ${state.score}/${state.total}`, 20, 33);

  ctx.textAlign = "right";
  ctx.fillText(`Temps: ${Math.ceil(state.timeLeft)}s`, state.width - 20, 33);
  ctx.textAlign = "left";
}

function updateTimer(now) {
  const elapsed = (now - state.startedAt) / 1000;
  state.timeLeft = Math.max(0, 60 - elapsed);

  if (state.timeLeft <= 0 || state.score === state.total) {
    state.running = false;
    overlay.classList.add("show");
    const won = state.score === state.total;
    overlay.querySelector("h2").textContent = won ? "Bravo, jardin illuminé !" : "Temps écoulé";
    overlay.querySelector("p").textContent = won
      ? "Vous avez fait éclore toutes les fleurs en équipe."
      : `Vous avez ouvert ${state.score} fleurs sur ${state.total}. Rejouez pour battre votre score.`;
    startBtn.textContent = "Rejouer";
  }
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  drawBackground(now);
  drawDivider();

  if (state.running) {
    updateFlowers(dt);
    updateTimer(now);
  }

  drawFlowers();
  drawGlow(state.leftGlow, "#84f4bdcc");
  drawGlow(state.rightGlow, "#ff96bccc");
  drawHud();

  requestAnimationFrame(frame);
}

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
