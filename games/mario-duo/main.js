const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const state = {
  running: false,
  width: 0,
  height: 0,
  cameraX: 0,
  world: {
    width: 3200,
    height: 540,
    gravity: 1800,
    groundY: 490,
    finishX: 3020,
  },
  keys: {
    p1Left: false,
    p1Right: false,
    p1Jump: false,
    p2Left: false,
    p2Right: false,
    p2Jump: false,
  },
  players: [],
  platforms: [],
  coins: [],
  countdown: 180,
  startTime: 0,
  message: "",
};

const keyMap = {
  KeyA: "p1Left",
  KeyD: "p1Right",
  KeyW: "p1Jump",
  Space: "p1Jump",
  ArrowLeft: "p2Left",
  ArrowRight: "p2Right",
  ArrowUp: "p2Jump",
};

const BASE_GROUND_Y = 490;

const TOUCH_ALIGN_EPSILON = 10;
const TOUCH_FLICK_MIN_DY = 12;
const TOUCH_FLICK_MIN_SPEED = 900;

const touchState = {
  p1: {
    pointerId: null,
    active: false,
    x: 0,
    y: 0,
    lastY: 0,
    lastTime: 0,
    jumpQueued: false,
  },
  p2: {
    pointerId: null,
    active: false,
    x: 0,
    y: 0,
    lastY: 0,
    lastTime: 0,
    jumpQueued: false,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = rect.width;
  state.height = rect.height;

  // Keep gameplay area visible on short landscape screens.
  state.world.groundY = clamp(state.height - 56, 250, BASE_GROUND_Y);
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function toWorldPoint(screenPoint) {
  return {
    x: screenPoint.x + state.cameraX,
    y: screenPoint.y,
  };
}

function resetTouchControlSlot(slot) {
  slot.pointerId = null;
  slot.active = false;
  slot.x = 0;
  slot.y = 0;
  slot.lastY = 0;
  slot.lastTime = 0;
  slot.jumpQueued = false;
}

function resetTouchControls() {
  resetTouchControlSlot(touchState.p1);
  resetTouchControlSlot(touchState.p2);
}

function findPlayerIndexAtWorldPoint(worldPoint) {
  for (let i = 0; i < state.players.length; i += 1) {
    const player = state.players[i];
    const hitBox = {
      x: player.x - 16,
      y: player.y - 16,
      w: player.w + 32,
      h: player.h + 32,
    };

    if (
      worldPoint.x >= hitBox.x &&
      worldPoint.x <= hitBox.x + hitBox.w &&
      worldPoint.y >= hitBox.y &&
      worldPoint.y <= hitBox.y + hitBox.h
    ) {
      return i;
    }
  }

  return -1;
}

function touchSlotForPlayer(index) {
  return index === 0 ? touchState.p1 : touchState.p2;
}

function touchSlotByPointerId(pointerId) {
  if (touchState.p1.pointerId === pointerId) return touchState.p1;
  if (touchState.p2.pointerId === pointerId) return touchState.p2;
  return null;
}

canvas.addEventListener("pointerdown", (event) => {
  if (!state.running) return;

  const screenPoint = pointFromEvent(event);
  const worldPoint = toWorldPoint(screenPoint);
  const playerIndex = findPlayerIndexAtWorldPoint(worldPoint);
  if (playerIndex < 0) return;

  const slot = touchSlotForPlayer(playerIndex);
  if (slot.active) return;

  canvas.setPointerCapture(event.pointerId);
  slot.pointerId = event.pointerId;
  slot.active = true;
  slot.x = screenPoint.x;
  slot.y = screenPoint.y;
  slot.lastY = screenPoint.y;
  slot.lastTime = event.timeStamp;
  slot.jumpQueued = false;
});

canvas.addEventListener("pointermove", (event) => {
  const slot = touchSlotByPointerId(event.pointerId);
  if (!slot) return;

  const screenPoint = pointFromEvent(event);
  const dtMs = Math.max(1, event.timeStamp - slot.lastTime);
  const dy = screenPoint.y - slot.lastY;
  const upwardSpeed = ((-dy) / dtMs) * 1000;

  if (dy < -TOUCH_FLICK_MIN_DY && upwardSpeed > TOUCH_FLICK_MIN_SPEED) {
    slot.jumpQueued = true;
  }

  slot.x = screenPoint.x;
  slot.y = screenPoint.y;
  slot.lastY = screenPoint.y;
  slot.lastTime = event.timeStamp;
});

function releasePointer(event) {
  const slot = touchSlotByPointerId(event.pointerId);
  if (!slot) return;
  resetTouchControlSlot(slot);
}

canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

function makeLevel() {
  const yOffset = state.world.groundY - BASE_GROUND_Y;
  const y = (value) => value + yOffset;

  state.platforms = [
    { x: 120, y: y(430), w: 160, h: 18 },
    { x: 360, y: y(380), w: 180, h: 18 },
    { x: 640, y: y(340), w: 140, h: 18 },
    { x: 860, y: y(410), w: 180, h: 18 },
    { x: 1140, y: y(360), w: 190, h: 18 },
    { x: 1450, y: y(315), w: 140, h: 18 },
    { x: 1670, y: y(390), w: 180, h: 18 },
    { x: 1970, y: y(350), w: 150, h: 18 },
    { x: 2200, y: y(410), w: 170, h: 18 },
    { x: 2470, y: y(360), w: 160, h: 18 },
    { x: 2730, y: y(320), w: 170, h: 18 },
  ];

  state.coins = [
    { x: 180, y: y(390), r: 10, taken: false },
    { x: 430, y: y(340), r: 10, taken: false },
    { x: 710, y: y(300), r: 10, taken: false },
    { x: 930, y: y(370), r: 10, taken: false },
    { x: 1210, y: y(320), r: 10, taken: false },
    { x: 1510, y: y(275), r: 10, taken: false },
    { x: 1740, y: y(350), r: 10, taken: false },
    { x: 2040, y: y(310), r: 10, taken: false },
    { x: 2260, y: y(370), r: 10, taken: false },
    { x: 2540, y: y(320), r: 10, taken: false },
    { x: 2790, y: y(280), r: 10, taken: false },
  ];
}

function makePlayers() {
  state.players = [
    {
      id: "P1",
      color: "#d4413d",
      cap: "#f3c356",
      x: 30,
      y: state.world.groundY - 48,
      spawnX: 30,
      spawnY: state.world.groundY - 48,
      w: 30,
      h: 48,
      vx: 0,
      vy: 0,
      speed: 290,
      jumpSpeed: 720,
      onGround: false,
      score: 0,
      reachedGoal: false,
      jumpLatch: false,
    },
    {
      id: "P2",
      color: "#2c5be2",
      cap: "#89d8f7",
      x: 80,
      y: state.world.groundY - 48,
      spawnX: 80,
      spawnY: state.world.groundY - 48,
      w: 30,
      h: 48,
      vx: 0,
      vy: 0,
      speed: 290,
      jumpSpeed: 720,
      onGround: false,
      score: 0,
      reachedGoal: false,
      jumpLatch: false,
    },
  ];
}

function resetGame() {
  state.cameraX = 0;
  state.countdown = 180;
  state.startTime = performance.now();
  state.message = "";
  makeLevel();
  makePlayers();
}

function setOverlay(title, text, buttonText) {
  overlay.querySelector("h2").textContent = title;
  overlay.querySelector("p").textContent = text;
  startBtn.textContent = buttonText;
  overlay.classList.add("show");
}

function start() {
  resizeCanvas();
  resetGame();
  resetTouchControls();
  state.running = true;
  overlay.classList.remove("show");
}

function setControl(key, pressed) {
  if (Object.hasOwn(state.keys, key)) {
    state.keys[key] = pressed;
  }
}

window.addEventListener("keydown", (event) => {
  const mapped = keyMap[event.code];
  if (!mapped) return;
  event.preventDefault();
  setControl(mapped, true);
});

window.addEventListener("keyup", (event) => {
  const mapped = keyMap[event.code];
  if (!mapped) return;
  event.preventDefault();
  setControl(mapped, false);
});

function updatePlayer(player, controls, dt) {
  if (player.reachedGoal) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  const move = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
  player.vx = move * player.speed;

  if (controls.jump && player.onGround && !player.jumpLatch) {
    player.vy = -player.jumpSpeed;
    if (controls.jumpToward !== 0) {
      player.vx = controls.jumpToward * player.speed;
    }
    player.onGround = false;
    player.jumpLatch = true;
  }

  if (!controls.jump) {
    player.jumpLatch = false;
  }

  player.vy += state.world.gravity * dt;

  player.x += player.vx * dt;
  player.x = clamp(player.x, 0, state.world.width - player.w);

  player.y += player.vy * dt;
  player.onGround = false;

  if (player.y + player.h >= state.world.groundY) {
    player.y = state.world.groundY - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  for (const platform of state.platforms) {
    const touching = overlaps(player, platform);
    if (!touching) continue;

    const fromAbove = player.vy >= 0 && player.y + player.h - player.vy * dt <= platform.y + 8;
    if (fromAbove) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      continue;
    }

    if (player.vx > 0) {
      player.x = platform.x - player.w;
    } else if (player.vx < 0) {
      player.x = platform.x + platform.w;
    }
  }
}

function playerControls(index, player) {
  const touch = gestureControl(touchSlotForPlayer(index), player);

  const keyboardLeft = index === 0 ? state.keys.p1Left : state.keys.p2Left;
  const keyboardRight = index === 0 ? state.keys.p1Right : state.keys.p2Right;
  const keyboardJump = index === 0 ? state.keys.p1Jump : state.keys.p2Jump;

  const keyboardDir = (keyboardLeft ? -1 : 0) + (keyboardRight ? 1 : 0);
  const touchDir = (touch.left ? -1 : 0) + (touch.right ? 1 : 0);
  const dir = keyboardDir !== 0 ? keyboardDir : touchDir;

  return {
    left: dir < 0,
    right: dir > 0,
    jump: keyboardJump || touch.jump,
    jumpToward: keyboardDir !== 0 ? keyboardDir : touch.jumpToward,
  };
}

function gestureControl(slot, player) {
  if (!slot.active || !player) {
    return { left: false, right: false, jump: false, jumpToward: 0 };
  }

  const targetX = slot.x + state.cameraX;
  const playerCenterX = player.x + player.w * 0.5;
  const dx = targetX - playerCenterX;

  const left = dx < -TOUCH_ALIGN_EPSILON;
  const right = dx > TOUCH_ALIGN_EPSILON;

  let jump = false;
  let jumpToward = 0;

  if (slot.jumpQueued) {
    jump = true;
    jumpToward = dx < -TOUCH_ALIGN_EPSILON ? -1 : dx > TOUCH_ALIGN_EPSILON ? 1 : 0;
    slot.jumpQueued = false;
  }

  return { left, right, jump, jumpToward };
}

function updateCoins() {
  for (const coin of state.coins) {
    if (coin.taken) continue;

    for (const player of state.players) {
      const box = {
        x: coin.x - coin.r,
        y: coin.y - coin.r,
        w: coin.r * 2,
        h: coin.r * 2,
      };
      if (overlaps(player, box)) {
        coin.taken = true;
        player.score += 1;
      }
    }
  }
}

function updateGoal() {
  for (const player of state.players) {
    if (player.reachedGoal) continue;
    if (player.x + player.w >= state.world.finishX) {
      player.reachedGoal = true;
      player.score += 5;
    }
  }

  if (state.players.every((p) => p.reachedGoal)) {
    state.running = false;
    const total = state.players[0].score + state.players[1].score;
    setOverlay(
      "Victoire !",
      `Les deux joueurs ont atteint le drapeau. Score total: ${total}`,
      "Rejouer"
    );
  }
}

function updateTimer(now) {
  const elapsed = (now - state.startTime) / 1000;
  state.countdown = Math.max(0, 180 - elapsed);

  if (state.countdown <= 0) {
    state.running = false;
    setOverlay(
      "Temps ecoule",
      "Le temps est fini avant que les deux joueurs n'atteignent le drapeau.",
      "Reessayer"
    );
  }
}

function updateCamera() {
  const center = (state.players[0].x + state.players[1].x) * 0.5;
  state.cameraX = clamp(center - state.width * 0.45, 0, state.world.width - state.width);
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, state.height);
  sky.addColorStop(0, "#7dd8ff");
  sky.addColorStop(1, "#d9f6ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = "#ffffffcc";
  for (let i = 0; i < 8; i += 1) {
    const baseX = ((i * 240 - state.cameraX * 0.3) % (state.width + 260)) - 120;
    const y = 40 + (i % 3) * 24;
    ctx.beginPath();
    ctx.arc(baseX, y, 24, 0, Math.PI * 2);
    ctx.arc(baseX + 22, y + 3, 18, 0, Math.PI * 2);
    ctx.arc(baseX - 22, y + 6, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround() {
  const groundTop = state.world.groundY;

  ctx.fillStyle = "#7ccf63";
  ctx.fillRect(0, groundTop - 12, state.width, 12);

  ctx.fillStyle = "#8f5b35";
  ctx.fillRect(0, groundTop, state.width, state.height - groundTop);

  ctx.fillStyle = "#7a4928";
  for (let i = 0; i < state.width; i += 26) {
    ctx.fillRect(i + ((Math.floor(i / 26) % 2) * 8), groundTop + 10, 18, 10);
  }
}

function drawWorld() {
  ctx.save();
  ctx.translate(-state.cameraX, 0);

  for (const platform of state.platforms) {
    ctx.fillStyle = "#ca7f39";
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = "#f7cb6f";
    ctx.fillRect(platform.x + 2, platform.y + 2, platform.w - 4, 4);
  }

  for (const coin of state.coins) {
    if (coin.taken) continue;
    ctx.fillStyle = "#f6ca2a";
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fff4bb";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (const player of state.players) {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y + 8, player.w, player.h - 8);
    ctx.fillStyle = player.cap;
    ctx.fillRect(player.x, player.y, player.w, 12);
    ctx.fillStyle = "#fff";
    ctx.fillRect(player.x + 5, player.y + 16, 5, 8);
    ctx.fillRect(player.x + player.w - 10, player.y + 16, 5, 8);

    if (player.reachedGoal) {
      ctx.fillStyle = "#24a34a";
      ctx.fillRect(player.x + 6, player.y - 10, 18, 6);
    }
  }

  ctx.fillStyle = "#4f4f4f";
  ctx.fillRect(state.world.finishX, state.world.groundY - 170, 8, 170);
  ctx.fillStyle = "#3eb75e";
  ctx.fillRect(state.world.finishX + 8, state.world.groundY - 170, 46, 24);
  ctx.fillStyle = "#fff";
  ctx.fillRect(state.world.finishX + 25, state.world.groundY - 160, 6, 6);

  ctx.restore();
}

function drawHud() {
  const hudInset = Math.max(8, Math.floor(state.width * 0.012));
  const hudHeight = state.height < 360 ? 34 : 42;
  const hudY = 8;

  ctx.fillStyle = "#00000059";
  ctx.fillRect(hudInset, hudY, state.width - hudInset * 2, hudHeight);

  ctx.fillStyle = "#fff";
  const fontSize = state.height < 360 ? 13 : 16;
  ctx.font = `700 ${fontSize}px Trebuchet MS`;
  const baseline = hudY + (hudHeight < 40 ? 23 : 27);

  const p1Score = state.players[0]?.score ?? 0;
  const p2Score = state.players[1]?.score ?? 0;
  ctx.fillText(`P1:${p1Score}`, hudInset + 8, baseline);
  ctx.fillText(`P2:${p2Score}`, hudInset + 78, baseline);

  const c = Math.ceil(state.countdown);
  ctx.textAlign = "right";
  ctx.fillText(`Temps:${c}s`, state.width - hudInset - 8, baseline);
  ctx.textAlign = "left";

  const arrived = state.players.filter((p) => p.reachedGoal).length;
  const progressX = Math.min(state.width * 0.5 - 42, hudInset + 170);
  ctx.fillText(`Arrivee:${arrived}/2`, progressX, baseline);
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  drawSky();
  drawGround();

  if (state.running) {
    updatePlayer(state.players[0], playerControls(0, state.players[0]), dt);
    updatePlayer(state.players[1], playerControls(1, state.players[1]), dt);
    updateCoins();
    updateGoal();
    updateTimer(now);
    updateCamera();
  }

  drawWorld();
  drawHud();

  requestAnimationFrame(frame);
}

startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", start);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
requestAnimationFrame(frame);
