const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const state = {
  running: false,
  width: 0,
  height: 0,
  cameraX: 0,
  world: {
    width: 3200,
    height: 540,
    gravity: 1800,
    topGroundY: 72,
    bottomGroundY: 490,
    finishXBottom: 3020,
    finishXTop: 2820,
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
  platformsBottom: [],
  platformsTop: [],
  coins: [],
  blocks: [],
  tunnels: [],
  blockBursts: [],
  powerups: [],
  turtles: [],
  turtleBursts: [],
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

const BASE_PLATFORMS = [
  { x: 120, y: 430, w: 160, h: 18 },
  { x: 360, y: 380, w: 180, h: 18 },
  { x: 640, y: 340, w: 140, h: 18 },
  { x: 860, y: 410, w: 180, h: 18 },
  { x: 1140, y: 360, w: 190, h: 18 },
  { x: 1450, y: 315, w: 140, h: 18 },
  { x: 1670, y: 390, w: 180, h: 18 },
  { x: 1970, y: 350, w: 150, h: 18 },
  { x: 2200, y: 410, w: 170, h: 18 },
  { x: 2470, y: 360, w: 160, h: 18 },
  { x: 2730, y: 320, w: 170, h: 18 },
];

const BASE_COINS = [
  { x: 180, y: 390, r: 14 },
  { x: 430, y: 340, r: 14 },
  { x: 710, y: 300, r: 14 },
  { x: 930, y: 370, r: 14 },
  { x: 1210, y: 320, r: 14 },
  { x: 1510, y: 275, r: 14 },
  { x: 1740, y: 350, r: 14 },
  { x: 2040, y: 310, r: 14 },
  { x: 2260, y: 370, r: 14 },
  { x: 2540, y: 320, r: 14 },
  { x: 2790, y: 280, r: 14 },
];

const BASE_BLOCKS = [
  { x: 300, y: 325, bonusType: "mushroom" },
  { x: 332, y: 325, bonusType: null },
  { x: 760, y: 285, bonusType: "fireflower" },
  { x: 792, y: 285, bonusType: null },
  { x: 1180, y: 295, bonusType: "star" },
  { x: 1212, y: 295, bonusType: null },
  { x: 1710, y: 320, bonusType: "life" },
  { x: 1742, y: 320, bonusType: null },
  { x: 2300, y: 300, bonusType: "mushroom" },
  { x: 2332, y: 300, bonusType: null },
  { x: 2660, y: 255, bonusType: "star" },
  { x: 2692, y: 255, bonusType: null },
];

const BASE_TURTLES = [
  { x: 560, y: 0, minX: 460, maxX: 760 },
  { x: 1380, y: 0, minX: 1260, maxX: 1560 },
  { x: 2140, y: 0, minX: 2020, maxX: 2360 },
  { x: 2860, y: 0, minX: 2720, maxX: 3060 },
];

const BASE_TUNNEL_LINKS = [
  // Bottom -> Top and Top -> Bottom links are staggered to allow quick return via another tunnel.
  { id: "b2t-1", fromLane: "bottom", platformIndex: 1, exitXOffset: 180 },
  { id: "t2b-1", fromLane: "top", platformIndex: 2, exitXOffset: -180 },
  { id: "b2t-2", fromLane: "bottom", platformIndex: 4, exitXOffset: 170 },
  { id: "t2b-2", fromLane: "top", platformIndex: 5, exitXOffset: -170 },
  { id: "b2t-3", fromLane: "bottom", platformIndex: 7, exitXOffset: 150 },
  { id: "t2b-3", fromLane: "top", platformIndex: 8, exitXOffset: -150 },
];

const TOUCH_ALIGN_EPSILON = 10;
const DOUBLE_TAP_MS = 560;
const BLOCK_SIZE = 30;
const POWERUP_RADIUS = 14;
const TURTLE_SIZE = 28;
const TUNNEL_RADIUS = 22;

const touchState = {
  p1: {
    pointerId: null,
    active: false,
    x: 0,
    y: 0,
    jumpQueued: false,
    actionQueued: false,
    lastTapAt: 0,
  },
  p2: {
    pointerId: null,
    active: false,
    x: 0,
    y: 0,
    jumpQueued: false,
    actionQueued: false,
    lastTapAt: 0,
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

  // Floors stay near phone edges at all times; the center area grows with viewport height.
  const EDGE_MARGIN = 12;
  state.world.bottomGroundY = Math.max(220, state.height - EDGE_MARGIN);
  state.world.topGroundY = EDGE_MARGIN;

  // Ensure a minimum playable center band on very short screens.
  if (state.world.bottomGroundY - state.world.topGroundY < 180) {
    state.world.topGroundY = Math.max(8, state.world.bottomGroundY - 180);
  }
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
  slot.jumpQueued = false;
  slot.actionQueued = false;
}

function resetTouchControls() {
  resetTouchControlSlot(touchState.p1);
  resetTouchControlSlot(touchState.p2);
}

function playerIndexFromScreenY(y) {
  // Keep each player on a dedicated touch half at all times.
  const splitY = (state.world.topGroundY + state.world.bottomGroundY) * 0.5;
  return y <= splitY ? 1 : 0;
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
  const playerIndex = playerIndexFromScreenY(screenPoint.y);

  const slot = touchSlotForPlayer(playerIndex);
  if (slot.active) return;

  const isDoubleTap = event.timeStamp - slot.lastTapAt <= DOUBLE_TAP_MS;
  slot.lastTapAt = event.timeStamp;

  canvas.setPointerCapture(event.pointerId);
  slot.pointerId = event.pointerId;
  slot.active = true;
  slot.x = screenPoint.x;
  slot.y = screenPoint.y;
  slot.jumpQueued = false;
  slot.actionQueued = isDoubleTap;
});

canvas.addEventListener("pointermove", (event) => {
  const slot = touchSlotByPointerId(event.pointerId);
  if (!slot) return;

  const screenPoint = pointFromEvent(event);
  slot.x = screenPoint.x;
  slot.y = screenPoint.y;
});

function releasePointer(event) {
  const slot = touchSlotByPointerId(event.pointerId);
  if (!slot) return;
  resetTouchControlSlot(slot);
}

canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

function makeLevel() {
  const bottomOffset = state.world.bottomGroundY - BASE_GROUND_Y;

  state.platformsBottom = BASE_PLATFORMS.map((p) => ({
    x: p.x,
    y: p.y + bottomOffset,
    w: p.w,
    h: p.h,
  }));

  state.platformsTop = BASE_PLATFORMS.map((p) => {
    const distFromBaseGround = BASE_GROUND_Y - p.y;
    const extraW = 80;
    return {
      x: Math.max(0, p.x - extraW * 0.5),
      y: state.world.topGroundY + distFromBaseGround,
      w: p.w + extraW,
      h: p.h,
    };
  });

  state.coins = [];
  state.blocks = [];
  state.tunnels = [];
  state.blockBursts = [];
  state.powerups = [];
  state.turtles = [];
  state.turtleBursts = [];

  for (const coin of BASE_COINS) {
    const distFromBaseGround = BASE_GROUND_Y - coin.y;

    state.coins.push({
      x: coin.x,
      y: coin.y + bottomOffset,
      r: coin.r,
      lane: "bottom",
      taken: false,
      phase: Math.random() * Math.PI * 2,
    });

    state.coins.push({
      x: coin.x,
      y: state.world.topGroundY + distFromBaseGround,
      r: coin.r,
      lane: "top",
      taken: false,
      phase: Math.random() * Math.PI * 2,
    });
  }

  for (const block of BASE_BLOCKS) {
    const distFromBaseGround = BASE_GROUND_Y - block.y;

    state.blocks.push({
      x: block.x,
      y: block.y + bottomOffset,
      w: BLOCK_SIZE,
      h: BLOCK_SIZE,
      lane: "bottom",
      broken: false,
      bonusType: block.bonusType,
      hitAnim: 0,
    });

    state.blocks.push({
      x: block.x,
      y: state.world.topGroundY + distFromBaseGround,
      w: BLOCK_SIZE,
      h: BLOCK_SIZE,
      lane: "top",
      broken: false,
      bonusType: block.bonusType,
      hitAnim: 0,
    });
  }

  for (const turtle of BASE_TURTLES) {
    state.turtles.push({
      lane: "bottom",
      x: turtle.x,
      y: state.world.bottomGroundY - TURTLE_SIZE,
      w: TURTLE_SIZE,
      h: TURTLE_SIZE,
      minX: turtle.minX,
      maxX: turtle.maxX,
      vx: 68,
      dir: 1,
      carriedBy: null,
      thrown: false,
      throwTimeLeft: 0,
      pickupCooldown: 0,
      alive: true,
      falling: false,
      sinkDir: 1,
      vy: 0,
      spin: 0,
      spinSpeed: 0,
    });

    state.turtles.push({
      lane: "top",
      x: turtle.x,
      y: state.world.topGroundY,
      w: TURTLE_SIZE,
      h: TURTLE_SIZE,
      minX: turtle.minX,
      maxX: turtle.maxX,
      vx: 68,
      dir: 1,
      carriedBy: null,
      thrown: false,
      throwTimeLeft: 0,
      pickupCooldown: 0,
      alive: true,
      falling: false,
      sinkDir: -1,
      vy: 0,
      spin: 0,
      spinSpeed: 0,
    });
  }

  for (const link of BASE_TUNNEL_LINKS) {
    const fromPlatforms = link.fromLane === "bottom" ? state.platformsBottom : state.platformsTop;
    const fromPlatform = fromPlatforms[link.platformIndex];
    if (!fromPlatform) continue;

    const fromX = fromPlatform.x + fromPlatform.w * 0.5;
    const fromY =
      link.fromLane === "bottom" ? fromPlatform.y - 8 : fromPlatform.y + fromPlatform.h + 8;

    const toLane = link.fromLane === "bottom" ? "top" : "bottom";
    const toX = clamp(fromX + link.exitXOffset, 44, state.world.width - 44);
    const toY = toLane === "bottom" ? state.world.bottomGroundY - 10 : state.world.topGroundY + 10;

    state.tunnels.push({
      id: link.id,
      role: "entry",
      lane: link.fromLane,
      x: fromX,
      y: fromY,
      r: TUNNEL_RADIUS,
      toLane,
      toX,
      toY,
    });

    state.tunnels.push({
      id: `${link.id}-exit`,
      role: "exit",
      lane: toLane,
      x: toX,
      y: toY,
      r: TUNNEL_RADIUS - 2,
      toLane: null,
      toX: 0,
      toY: 0,
    });
  }
}

function makePlayers() {
  state.players = [
    {
      id: "P1",
      color: "#d4413d",
      cap: "#f3c356",
      x: 30,
      y: state.world.bottomGroundY - 48,
      spawnX: 30,
      spawnY: state.world.bottomGroundY - 48,
      w: 30,
      h: 48,
      standingH: 48,
      crouchH: 34,
      isCrouching: false,
      vx: 0,
      vy: 0,
      speed: 290,
      jumpSpeed: 720,
      baseSpeed: 290,
      baseJumpSpeed: 720,
      gravityScale: 1,
      gravityDir: 1,
      lane: "bottom",
      facing: 1,
      onGround: false,
      score: 0,
      reachedGoal: false,
      jumpLatch: false,
      powerups: {
        mushroomUntil: 0,
        fireUntil: 0,
        starUntil: 0,
      },
      carryingTurtle: null,
      actionLatch: false,
      throwQueued: false,
      blockedMoveTime: 0,
      autoCrouchDelay: 0.5,
      crawlSpeedFactor: 0.58,
      tunnelCooldownUntil: 0,
    },
    {
      id: "P2",
      color: "#2c5be2",
      cap: "#89d8f7",
      x: 80,
      y: state.world.topGroundY,
      spawnX: 80,
      spawnY: state.world.topGroundY,
      w: 30,
      h: 48,
      standingH: 48,
      crouchH: 34,
      isCrouching: false,
      vx: 0,
      vy: 0,
      speed: 290,
      jumpSpeed: 790,
      baseSpeed: 290,
      baseJumpSpeed: 790,
      gravityScale: 0.72,
      gravityDir: -1,
      lane: "top",
      facing: 1,
      onGround: false,
      score: 0,
      reachedGoal: false,
      jumpLatch: false,
      powerups: {
        mushroomUntil: 0,
        fireUntil: 0,
        starUntil: 0,
      },
      carryingTurtle: null,
      actionLatch: false,
      throwQueued: false,
      blockedMoveTime: 0,
      autoCrouchDelay: 0.5,
      crawlSpeedFactor: 0.58,
      tunnelCooldownUntil: 0,
    },
  ];
}

function updatePlayerPowerupStats(player, nowMs) {
  let speed = player.baseSpeed;
  let jumpSpeed = player.baseJumpSpeed;

  if (player.powerups.mushroomUntil > nowMs) {
    speed += 28;
    jumpSpeed += 75;
  }
  if (player.powerups.fireUntil > nowMs) {
    speed += 16;
    jumpSpeed += 35;
  }
  if (player.powerups.starUntil > nowMs) {
    speed += 56;
    jumpSpeed += 110;
  }

  player.speed = speed;
  player.jumpSpeed = jumpSpeed;
}

function resetGame() {
  state.cameraX = 0;
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

function isFullscreenActive() {
  return document.fullscreenElement !== null;
}

function updateFullscreenButton() {
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = isFullscreenActive() ? "Fenetre" : "Plein ecran";
}

async function toggleFullscreen() {
  const target = document.documentElement;
  try {
    if (!isFullscreenActive()) {
      await target.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_error) {
    // Ignore fullscreen API failures on unsupported browsers.
  }
}

function setControl(key, pressed) {
  if (Object.hasOwn(state.keys, key)) {
    state.keys[key] = pressed;
  }
}

function activeLaneSolids(player) {
  const lanePlatforms = player.gravityDir === 1 ? state.platformsBottom : state.platformsTop;
  const laneBlocks = state.blocks.filter((b) => !b.broken && b.lane === player.lane);
  return lanePlatforms.concat(laneBlocks);
}
function canPlayerOccupy(player, x, y, h) {
  const test = { x, y, w: player.w, h };

  if (player.gravityDir === 1) {
    if (y + h > state.world.bottomGroundY + 0.001) return false;
  } else if (y < state.world.topGroundY - 0.001) {
    return false;
  }

  const solids = activeLaneSolids(player);
  for (const solid of solids) {
    if (overlaps(test, solid)) return false;
  }
  return true;
}

function setPlayerCrouch(player, shouldCrouch) {
  if (!!player.isCrouching === !!shouldCrouch) return true;

  const targetH = shouldCrouch ? player.crouchH : player.standingH;
  let targetY = player.y;

  if (player.gravityDir === 1) {
    // Keep feet anchored on the lane floor while changing posture.
    targetY = player.y + (player.h - targetH);
  }

  if (!canPlayerOccupy(player, player.x, targetY, targetH)) {
    return false;
  }

  player.y = targetY;
  player.h = targetH;
  player.isCrouching = shouldCrouch;
  return true;
}

function spawnPowerupFromBlock(block) {
  if (!block.bonusType) return;

  state.powerups.push({
    lane: block.lane,
    type: block.bonusType,
    x: block.x + block.w * 0.5,
    y: block.y + block.h * 0.5,
    r: POWERUP_RADIUS,
    bornAt: performance.now(),
    ttl: 15,
    phase: Math.random() * Math.PI * 2,
  });
}

function createBlockBurst(block) {
  const cx = block.x + block.w * 0.5;
  const cy = block.y + block.h * 0.5;
  const colors = ["#ffd58c", "#d88a3d", "#ffefc4", "#99602d"];
  const particles = [];

  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16;
    const speed = 60 + (i % 4) * 28;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + (i % 3),
      color: colors[i % colors.length],
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 10,
    });
  }

  state.blockBursts.push({
    x: cx,
    y: cy,
    lane: block.lane,
    ttl: 0.55,
    total: 0.55,
    particles,
  });
}

function breakBlock(block) {
  if (block.broken) return;
  block.broken = true;
  block.hitAnim = 0.4;
  createBlockBurst(block);
  spawnPowerupFromBlock(block);
}

function updateBlockBursts(dt) {
  for (const burst of state.blockBursts) {
    burst.ttl -= dt;

    for (const p of burst.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.986;
      p.vy += (burst.lane === "bottom" ? 330 : -330) * dt;
      p.size *= 0.985;
      p.rot += p.rotSpeed * dt;
    }
  }

  state.blockBursts = state.blockBursts.filter((b) => b.ttl > 0);
}

function tryBreakBlockFromJump(player, prevY) {
  for (const block of state.blocks) {
    if (block.broken || block.lane !== player.lane) continue;
    if (!overlaps(player, block)) continue;

    if (player.gravityDir === 1) {
      const prevTop = prevY;
      const fromBelow = player.vy < 0 && prevTop >= block.y + block.h - 4;
      if (fromBelow) {
        player.y = block.y + block.h;
        player.vy = 0;
        breakBlock(block);
      }
    } else {
      const prevBottom = prevY + player.h;
      const fromAbove = player.vy > 0 && prevBottom <= block.y + 4;
      if (fromAbove) {
        player.y = block.y - player.h;
        player.vy = 0;
        breakBlock(block);
      }
    }
  }
}

function applyPowerupToPlayer(player, type, nowMs) {
  const durationMs = 12000;
  if (type === "mushroom") {
    player.powerups.mushroomUntil = Math.max(player.powerups.mushroomUntil, nowMs + durationMs);
    player.score += 2;
    return;
  }
  if (type === "fireflower") {
    player.powerups.fireUntil = Math.max(player.powerups.fireUntil, nowMs + durationMs);
    player.score += 3;
    return;
  }
  if (type === "star") {
    player.powerups.starUntil = Math.max(player.powerups.starUntil, nowMs + 9000);
    player.score += 4;
    return;
  }
  if (type === "life") {
    player.score += 6;
  }
}

function updatePowerups(dt, nowMs) {
  for (const powerup of state.powerups) {
    powerup.ttl -= dt;
  }
  state.powerups = state.powerups.filter((p) => p.ttl > 0);

  for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
    const powerup = state.powerups[i];
    const box = {
      x: powerup.x - powerup.r,
      y: powerup.y - powerup.r,
      w: powerup.r * 2,
      h: powerup.r * 2,
    };

    for (const player of state.players) {
      if (player.lane !== powerup.lane) continue;
      if (!overlaps(player, box)) continue;

      applyPowerupToPlayer(player, powerup.type, nowMs);
      state.powerups.splice(i, 1);
      break;
    }
  }
}

function playerHitsTunnel(player, tunnel) {
  const cx = player.x + player.w * 0.5;
  const cy = player.y + player.h * 0.5;
  const dx = cx - tunnel.x;
  const dy = cy - tunnel.y;
  const reach = tunnel.r + Math.max(player.w, player.h) * 0.42;
  return dx * dx + dy * dy <= reach * reach;
}

function tryUseTunnel(player, tunnel, nowMs) {
  if (tunnel.role !== "entry") return false;
  if (player.lane !== tunnel.lane) return false;
  if (player.tunnelCooldownUntil > nowMs) return false;

  const targetLane = tunnel.toLane;
  if (!targetLane) return false;

  player.lane = targetLane;
  player.gravityDir = targetLane === "top" ? -1 : 1;
  player.vy = 0;
  player.onGround = true;

  player.x = clamp(tunnel.toX - player.w * 0.5, 0, state.world.width - player.w);
  if (targetLane === "bottom") {
    player.y = state.world.bottomGroundY - player.h;
  } else {
    player.y = state.world.topGroundY;
  }

  if (player.carryingTurtle) {
    player.carryingTurtle.lane = targetLane;
  }

  player.tunnelCooldownUntil = nowMs + 260;
  return true;
}

function updateTunnels(nowMs) {
  for (const player of state.players) {
    for (const tunnel of state.tunnels) {
      if (tunnel.role !== "entry") continue;
      if (!playerHitsTunnel(player, tunnel)) continue;
      if (tryUseTunnel(player, tunnel, nowMs)) break;
    }
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

function updatePlayer(player, controls, dt, nowMs) {
  if (player.reachedGoal) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  updatePlayerPowerupStats(player, nowMs);

  const move = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
  const moveSpeed = player.isCrouching ? player.speed * player.crawlSpeedFactor : player.speed;
  player.vx = move * moveSpeed;
  if (move !== 0) {
    player.facing = move > 0 ? 1 : -1;
  }

  if (controls.jump && player.onGround && !player.jumpLatch) {
    player.vy = -player.jumpSpeed * player.gravityDir;
    if (controls.jumpToward !== 0) {
      player.vx = controls.jumpToward * player.speed;
    }
    player.onGround = false;
    player.jumpLatch = true;
  }

  if (!controls.jump) {
    player.jumpLatch = false;
  }

  if (controls.action && !player.actionLatch) {
    player.throwQueued = true;
    player.actionLatch = true;
  }
  if (!controls.action) {
    player.actionLatch = false;
  }

  const prevX = player.x;
  const prevY = player.y;
  let blockedByObstacle = false;

  player.vy += state.world.gravity * player.gravityDir * player.gravityScale * dt;

  player.x += player.vx * dt;
  player.x = clamp(player.x, 0, state.world.width - player.w);

  player.y += player.vy * dt;
  player.onGround = false;

  tryBreakBlockFromJump(player, prevY);

  if (player.gravityDir === 1) {
    if (player.y + player.h >= state.world.bottomGroundY) {
      player.y = state.world.bottomGroundY - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  } else if (player.y <= state.world.topGroundY) {
    player.y = state.world.topGroundY;
    player.vy = 0;
    player.onGround = true;
  }

  const solids = activeLaneSolids(player);
  for (const platform of solids) {
    const touching = overlaps(player, platform);
    if (!touching) continue;

    if (player.gravityDir === 1) {
      const prevBottom = prevY + player.h;
      const fromAbove = player.vy >= 0 && prevBottom <= platform.y + 8;
      if (fromAbove) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
        continue;
      }
    } else {
      const prevTop = prevY;
      const platformBottom = platform.y + platform.h;
      const fromBelow = player.vy <= 0 && prevTop >= platformBottom - 8;
      if (fromBelow) {
        player.y = platformBottom;
        player.vy = 0;
        player.onGround = true;
        continue;
      }
    }

    if (player.vx > 0 && prevX + player.w <= platform.x + 4) {
      player.x = platform.x - player.w;
      blockedByObstacle = true;
    } else if (player.vx < 0 && prevX >= platform.x + platform.w - 4) {
      player.x = platform.x + platform.w;
      blockedByObstacle = true;
    }
  }

  // If pushing against borders, count this as blocked movement too.
  if (move > 0 && player.x >= state.world.width - player.w - 0.001) blockedByObstacle = true;
  if (move < 0 && player.x <= 0.001) blockedByObstacle = true;

  if (move !== 0 && blockedByObstacle && player.onGround) {
    player.blockedMoveTime += dt;
    if (player.blockedMoveTime >= player.autoCrouchDelay) {
      setPlayerCrouch(player, true);
    }
  } else {
    player.blockedMoveTime = 0;
    if (player.isCrouching) {
      setPlayerCrouch(player, false);
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
    action: touch.action,
    jumpToward: keyboardDir !== 0 ? keyboardDir : touch.jumpToward,
  };
}

function gestureControl(slot, player) {
  if (!slot.active || !player) {
    return { left: false, right: false, jump: false, action: false, jumpToward: 0 };
  }

  const targetX = slot.x + state.cameraX;
  const playerCenterX = player.x + player.w * 0.5;
  const dx = targetX - playerCenterX;

  const left = dx < -TOUCH_ALIGN_EPSILON;
  const right = dx > TOUCH_ALIGN_EPSILON;

  let jump = false;
  let action = false;
  let jumpToward = 0;

  if (slot.jumpQueued) {
    jump = true;
    jumpToward = dx < -TOUCH_ALIGN_EPSILON ? -1 : dx > TOUCH_ALIGN_EPSILON ? 1 : 0;
    slot.jumpQueued = false;
  }

  if (slot.actionQueued) {
    if (player.carryingTurtle) {
      action = true;
    } else {
      jump = true;
      jumpToward = dx < -TOUCH_ALIGN_EPSILON ? -1 : dx > TOUCH_ALIGN_EPSILON ? 1 : 0;
    }
    slot.actionQueued = false;
  }

  return { left, right, jump, action, jumpToward };
}

function turtleBox(turtle) {
  return {
    x: turtle.x,
    y: turtle.y,
    w: turtle.w,
    h: turtle.h,
  };
}

function createTurtleBurst(x, y, lane) {
  const colors = ["#6ef573", "#9dffba", "#ffe082", "#ff7f6e", "#7ce2ff"];
  const particles = [];
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    const speed = 80 + (i % 5) * 22;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + (i % 3),
      color: colors[i % colors.length],
    });
  }

  state.turtleBursts.push({
    x,
    y,
    lane,
    ttl: 0.7,
    total: 0.7,
    particles,
  });
}

function explodeTurtlePair(a, b) {
  const cx = (a.x + a.w * 0.5 + b.x + b.w * 0.5) * 0.5;
  const cy = (a.y + a.h * 0.5 + b.y + b.h * 0.5) * 0.5;
  createTurtleBurst(cx, cy, a.lane);

  for (const turtle of [a, b]) {
    turtle.carriedBy = null;
    turtle.thrown = false;
    turtle.throwTimeLeft = 0;
    turtle.pickupCooldown = 999;
    turtle.falling = true;
    turtle.sinkDir = turtle.lane === "bottom" ? 1 : -1;
    turtle.vy = turtle.sinkDir * 240;
    turtle.vx = (turtle.vx >= 0 ? 1 : -1) * 120;
    turtle.spin = 0;
    turtle.spinSpeed = turtle.vx >= 0 ? 16 : -16;
  }
}

function updateTurtleBursts(dt) {
  for (const burst of state.turtleBursts) {
    burst.ttl -= dt;

    for (const p of burst.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy += (burst.lane === "bottom" ? 260 : -260) * dt;
      p.size *= 0.985;
    }
  }

  state.turtleBursts = state.turtleBursts.filter((b) => b.ttl > 0);
}

function updateTurtles(dt) {
  for (const turtle of state.turtles) {
    if (!turtle.alive) continue;
    turtle.pickupCooldown = Math.max(0, turtle.pickupCooldown - dt);
  }

  for (let i = 0; i < state.players.length; i += 1) {
    const player = state.players[i];

    if (!player.carryingTurtle) {
      for (const turtle of state.turtles) {
        if (!turtle.alive || turtle.falling) continue;
        if (turtle.lane !== player.lane) continue;
        if (turtle.carriedBy !== null) continue;
        if (turtle.thrown || turtle.pickupCooldown > 0) continue;

        const near = {
          x: player.x - 16,
          y: player.y - 12,
          w: player.w + 32,
          h: player.h + 24,
        };
        if (!overlaps(near, turtleBox(turtle))) continue;

        turtle.carriedBy = i;
        turtle.thrown = false;
        turtle.throwTimeLeft = 0;
        player.carryingTurtle = turtle;
        break;
      }
    }

    if (player.throwQueued) {
      player.throwQueued = false;
      if (player.carryingTurtle) {
        const turtle = player.carryingTurtle;
        turtle.carriedBy = null;
        turtle.thrown = true;
        turtle.throwTimeLeft = 2.3;
        turtle.pickupCooldown = 0.55;
        turtle.dir = player.facing;
        turtle.vx = player.facing * 520;
        player.carryingTurtle = null;
      }
    }
  }

  for (const turtle of state.turtles) {
    if (!turtle.alive) continue;

    if (turtle.falling) {
      turtle.vy += turtle.sinkDir * 2000 * dt;
      turtle.y += turtle.vy * dt;
      turtle.x += turtle.vx * 0.2 * dt;
      turtle.spin += turtle.spinSpeed * dt;

      const outBottom = turtle.sinkDir > 0 && turtle.y > state.height + 70;
      const outTop = turtle.sinkDir < 0 && turtle.y + turtle.h < -70;
      if (outBottom || outTop) {
        turtle.alive = false;
      }
      continue;
    }

    if (turtle.carriedBy !== null) {
      const player = state.players[turtle.carriedBy];
      const side = player.facing >= 0 ? 1 : -1;
      turtle.x = player.x + (side > 0 ? player.w + 4 : -turtle.w - 4);
      turtle.y = turtle.lane === "bottom" ? player.y + player.h - turtle.h : player.y;
      continue;
    }

    if (turtle.thrown) {
      turtle.x += turtle.vx * dt;
      turtle.throwTimeLeft -= dt;

      if (turtle.x <= 0 || turtle.x + turtle.w >= state.world.width) {
        turtle.x = clamp(turtle.x, 0, state.world.width - turtle.w);
        turtle.vx *= -1;
      }

      for (const block of state.blocks) {
        if (block.broken || block.lane !== turtle.lane) continue;
        if (!overlaps(turtleBox(turtle), block)) continue;
        breakBlock(block);
        turtle.vx *= -1;
      }

      if (turtle.throwTimeLeft <= 0) {
        turtle.thrown = false;
        turtle.vx = turtle.dir * 68;
      }
      continue;
    }

    turtle.x += turtle.vx * dt;
    if (turtle.x <= turtle.minX) {
      turtle.x = turtle.minX;
      turtle.vx = Math.abs(turtle.vx);
      turtle.dir = 1;
    }
    if (turtle.x + turtle.w >= turtle.maxX) {
      turtle.x = turtle.maxX - turtle.w;
      turtle.vx = -Math.abs(turtle.vx);
      turtle.dir = -1;
    }

    turtle.y = turtle.lane === "bottom" ? state.world.bottomGroundY - turtle.h : state.world.topGroundY;
  }

  for (let i = 0; i < state.turtles.length; i += 1) {
    const a = state.turtles[i];
    if (!a.alive || a.falling || a.carriedBy !== null) continue;

    for (let j = i + 1; j < state.turtles.length; j += 1) {
      const b = state.turtles[j];
      if (!b.alive || b.falling || b.carriedBy !== null) continue;
      if (a.lane !== b.lane) continue;

      // At least one turtle must be thrown for a collision knockout.
      if (!a.thrown && !b.thrown) continue;
      if (!overlaps(turtleBox(a), turtleBox(b))) continue;

      explodeTurtlePair(a, b);
      break;
    }
  }
}

function updateCoins() {
  for (const coin of state.coins) {
    if (coin.taken) continue;

    for (const player of state.players) {
      if (player.lane !== coin.lane) continue;

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

    const playerFinishX = player.lane === "top" ? state.world.finishXTop : state.world.finishXBottom;
    if (player.x + player.w >= playerFinishX) {
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
  const groundTop = state.world.bottomGroundY;
  const topGroundBottom = state.world.topGroundY;

  ctx.fillStyle = "#8f5b35";
  ctx.fillRect(0, 0, state.width, topGroundBottom);

  ctx.fillStyle = "#7ccf63";
  ctx.fillRect(0, topGroundBottom, state.width, 12);

  ctx.fillStyle = "#7a4928";
  for (let i = 0; i < state.width; i += 26) {
    ctx.fillRect(i + ((Math.floor(i / 26) % 2) * 8), topGroundBottom - 10, 18, 10);
  }

  ctx.fillStyle = "#7ccf63";
  ctx.fillRect(0, groundTop - 12, state.width, 12);

  ctx.fillStyle = "#8f5b35";
  ctx.fillRect(0, groundTop, state.width, state.height - groundTop);

  ctx.fillStyle = "#7a4928";
  for (let i = 0; i < state.width; i += 26) {
    ctx.fillRect(i + ((Math.floor(i / 26) % 2) * 8), groundTop + 10, 18, 10);
  }
}

function adjustHexColor(hex, amount) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const r = clamp((value >> 16) + amount, 0, 255);
  const g = clamp(((value >> 8) & 0xff) + amount, 0, 255);
  const b = clamp((value & 0xff) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function fillRoundRect(x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

function drawModernVoxelPlayer(player, now) {
  const w = player.w;
  const h = player.h;
  const sx = -w * 0.5;
  const sy = -h * 0.5;

  const speedRatio = Math.min(1, Math.abs(player.vx) / Math.max(1, player.speed));
  const walking = player.onGround && speedRatio > 0.05;
  const walkPhase = now * (8 + speedRatio * 6);
  const walkSwing = walking ? Math.sin(walkPhase) * (3 + speedRatio * 2.5) : 0;
  const bodyBob = walking ? Math.abs(Math.sin(walkPhase * 2)) * 1.2 : 0;
  const jumping = !player.onGround;
  const jumpDirVelocity = player.vy * player.gravityDir;
  const jumpPhase = !jumping ? "ground" : jumpDirVelocity < -20 ? "rise" : "fall";

  const dir = player.gravityDir === -1 ? -player.facing : player.facing;
  const legLiftA = walking ? Math.max(0, Math.sin(walkPhase)) * 3.6 : 0;
  const legLiftB = walking ? Math.max(0, -Math.sin(walkPhase)) * 3.6 : 0;
  const armSwing = walking ? Math.sin(walkPhase) * 2.5 : 0;

  const jumpStretchX = jumpPhase === "rise" ? 0.9 : jumpPhase === "fall" ? 1.08 : 1;
  const jumpStretchY = jumpPhase === "rise" ? 1.1 : jumpPhase === "fall" ? 0.9 : 1;
  const jumpOffsetY = jumpPhase === "rise" ? -3 : jumpPhase === "fall" ? 1 : 0;
  const crouchScaleY = player.isCrouching ? 0.78 : 1;

  const suitMain = player.color;
  const suitDark = adjustHexColor(player.color, -35);
  const suitLight = adjustHexColor(player.color, 32);
  const capMain = player.cap;
  const capDark = adjustHexColor(player.cap, -28);
  const capLight = adjustHexColor(player.cap, 30);

  const skin = "#f2cfb1";
  const hair = "#433227";
  const shoe = "#2f2832";

  // Soft shadow anchors the character to the lane.
  ctx.fillStyle = "#00000033";
  const shadowW = jumpPhase === "rise" ? w - 10 : jumpPhase === "fall" ? w - 4 : w - 6;
  const shadowX = sx + (w - shadowW) * 0.5 + walkSwing * 0.2;
  fillRoundRect(shadowX, sy + h - 2, shadowW, 4, 2);

  ctx.save();
  ctx.scale(dir, 1);
  ctx.translate(0, jumpOffsetY);
  ctx.scale(jumpStretchX, jumpStretchY * crouchScaleY);

  const torsoY = sy + 20 + (jumping ? -2 : bodyBob) + (player.isCrouching ? 4 : 0);
  const headY = sy + 6 + (jumping ? -3 : bodyBob);

  // Legs with modern rounded shape.
  const legsY = torsoY + 17;
  const leftLegX = sx + 7 + walkSwing * 0.6;
  const rightLegX = sx + w - 13 - walkSwing * 0.6;
  const leftLegH =
    jumpPhase === "ground" ? (player.isCrouching ? 5 : 9 - legLiftA) : jumpPhase === "rise" ? 5 : 7;
  const rightLegH =
    jumpPhase === "ground" ? (player.isCrouching ? 5 : 9 - legLiftB) : jumpPhase === "rise" ? 9 : 5;

  ctx.fillStyle = suitDark;
  fillRoundRect(leftLegX, legsY, 6, Math.max(4, leftLegH), 2.5);
  fillRoundRect(rightLegX, legsY, 6, Math.max(4, rightLegH), 2.5);

  ctx.fillStyle = shoe;
  fillRoundRect(leftLegX - 1, sy + h - 4, 8, 4, 1.6);
  fillRoundRect(rightLegX - 1, sy + h - 4, 8, 4, 1.6);

  // Torso shell.
  const bodyGrad = ctx.createLinearGradient(sx + 6, torsoY, sx + w - 6, torsoY);
  bodyGrad.addColorStop(0, suitLight);
  bodyGrad.addColorStop(0.55, suitMain);
  bodyGrad.addColorStop(1, suitDark);
  ctx.fillStyle = bodyGrad;
  fillRoundRect(sx + 6, torsoY, w - 12, 16, 5.5);

  ctx.fillStyle = "#ffffff2c";
  fillRoundRect(sx + 10, torsoY + 2, 4, 10, 2);

  // Arms with rounded capsules.
  const armLift = jumpPhase === "rise" ? -4 : jumpPhase === "fall" ? -2 : 0;
  const crouchArmDrop = player.isCrouching ? 2 : 0;
  ctx.fillStyle = suitMain;
  fillRoundRect(sx + 2, torsoY + 2 + armSwing * 0.3 + armLift + crouchArmDrop, 4, 11, 2);
  fillRoundRect(sx + w - 6, torsoY + 2 - armSwing * 0.3 + armLift + crouchArmDrop, 4, 11, 2);

  // Rounded head + cap.
  const capY = headY - 4;
  ctx.fillStyle = skin;
  fillRoundRect(sx + 7, headY, w - 14, 12, 5);
  ctx.fillStyle = hair;
  fillRoundRect(sx + 7, headY + 8, w - 14, 4, 2);

  ctx.fillStyle = capMain;
  fillRoundRect(sx + 4.5, capY, w - 9, 8, 4);
  ctx.fillStyle = capLight;
  fillRoundRect(sx + 5.5, capY + 1, w - 11, 2, 1.5);
  ctx.fillStyle = capDark;
  fillRoundRect(sx + 6, capY + 6, w - 10, 2, 1.5);

  // Profile eye + cheek.
  ctx.fillStyle = "#ffffff";
  fillRoundRect(sx + w - 12, headY + 3, 3, 3, 1.2);
  ctx.fillStyle = "#26324b";
  fillRoundRect(sx + w - 11, headY + 4, 2, 2, 1);
  ctx.fillStyle = "#d0a98c";
  fillRoundRect(sx + w - 7, headY + 7, 3, 2, 1);

  // Thin outline to keep readability on bright backgrounds.
  ctx.strokeStyle = "#1b1b1b44";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 2, sy + 2, w - 4, h - 4);
  ctx.restore();
}

function drawWorld(now) {
  ctx.save();
  ctx.translate(-state.cameraX, 0);

  for (const platform of state.platformsBottom) {
    ctx.fillStyle = "#ca7f39";
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = "#f7cb6f";
    ctx.fillRect(platform.x + 2, platform.y + 2, platform.w - 4, 4);
  }

  for (const platform of state.platformsTop) {
    ctx.fillStyle = "#ca7f39";
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = "#f7cb6f";
    ctx.fillRect(platform.x + 2, platform.y + platform.h - 6, platform.w - 4, 4);
  }

  for (const coin of state.coins) {
    if (coin.taken) continue;

    const bob = Math.sin(now * 5 + coin.phase) * 2;
    const pulse = 0.88 + 0.16 * (0.5 + 0.5 * Math.sin(now * 7 + coin.phase));
    const rr = coin.r * pulse;

    ctx.fillStyle = "#f6ca2a";
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + bob, rr, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fff4bb";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff8d4";
    ctx.fillRect(coin.x - 1, coin.y + bob - rr * 0.45, 2, rr * 0.9);
  }

  for (const block of state.blocks) {
    if (block.broken) continue;

    const shimmer = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(now * 6 + block.x * 0.02));
    const blockY = block.y + Math.sin(now * 18 + block.x * 0.01) * block.hitAnim;
    ctx.fillStyle = `rgba(214,151,61,${shimmer})`;
    ctx.fillRect(block.x, blockY, block.w, block.h);
    ctx.fillStyle = "#ffde8e";
    ctx.fillRect(block.x + 2, blockY + 2, block.w - 4, 4);
    ctx.fillStyle = "#7f4f1f";
    ctx.fillRect(block.x + 2, blockY + block.h - 6, block.w - 4, 4);
    if (block.bonusType) {
      ctx.fillStyle = "#fff3cf";
      ctx.font = "700 16px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("?", block.x + block.w * 0.5, blockY + block.h * 0.66);
      ctx.textAlign = "left";
    }
  }

  for (const tunnel of state.tunnels) {
    const pulse = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(now * 4.5 + tunnel.x * 0.01));
    const rr = tunnel.r * pulse;
    const grad = ctx.createRadialGradient(tunnel.x, tunnel.y, 4, tunnel.x, tunnel.y, rr + 6);
    const isEntry = tunnel.role === "entry";

    if (isEntry && tunnel.lane === "bottom") {
      grad.addColorStop(0, "#7ef5ff");
      grad.addColorStop(1, "#11758f");
    } else if (isEntry && tunnel.lane === "top") {
      grad.addColorStop(0, "#a9ffb5");
      grad.addColorStop(1, "#257a38");
    } else if (tunnel.lane === "bottom") {
      grad.addColorStop(0, "#d8f6ff");
      grad.addColorStop(1, "#6d8f9d");
    } else {
      grad.addColorStop(0, "#ddffe3");
      grad.addColorStop(1, "#6e8f73");
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tunnel.x, tunnel.y, rr, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isEntry ? "#ffffffdd" : "#ffffff88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tunnel.x, tunnel.y, rr - 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isEntry ? "#ffffffd9" : "#ffffff9c";
    ctx.beginPath();
    if (tunnel.lane === "bottom") {
      // Bottom lane entry/exit marker points upward, top points downward.
      ctx.moveTo(tunnel.x, tunnel.y - 7);
      ctx.lineTo(tunnel.x - 5, tunnel.y + 2);
      ctx.lineTo(tunnel.x + 5, tunnel.y + 2);
    } else {
      ctx.moveTo(tunnel.x, tunnel.y + 7);
      ctx.lineTo(tunnel.x - 5, tunnel.y - 2);
      ctx.lineTo(tunnel.x + 5, tunnel.y - 2);
    }
    ctx.closePath();
    ctx.fill();
  }

  for (const powerup of state.powerups) {
    const bob = Math.sin(now * 6 + powerup.phase) * 2;
    const y = powerup.y + bob;

    if (powerup.type === "mushroom") {
      ctx.fillStyle = "#d44d3f";
      ctx.beginPath();
      ctx.arc(powerup.x, y - 2, powerup.r, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(powerup.x - 3, y, 6, 7);
      continue;
    }

    if (powerup.type === "fireflower") {
      ctx.fillStyle = "#f5d045";
      ctx.beginPath();
      ctx.arc(powerup.x, y - 2, powerup.r - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ea7840";
      ctx.fillRect(powerup.x - 2, y + 4, 4, 6);
      continue;
    }

    if (powerup.type === "star") {
      ctx.fillStyle = "#ffe15e";
      for (let p = 0; p < 5; p += 1) {
        const a = (Math.PI * 2 * p) / 5 - Math.PI / 2;
        const px = powerup.x + Math.cos(a) * powerup.r;
        const py = y + Math.sin(a) * powerup.r;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
      continue;
    }

    ctx.fillStyle = "#7be573";
    ctx.beginPath();
    ctx.arc(powerup.x, y, powerup.r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(powerup.x - 3, y - 2, 6, 2);
    ctx.fillRect(powerup.x - 1, y - 4, 2, 6);
  }

  for (const turtle of state.turtles) {
    if (!turtle.alive) continue;

    const y = turtle.y;
    const shellColor = turtle.thrown ? "#5bbd57" : "#4faa4a";
    ctx.save();
    ctx.translate(turtle.x + turtle.w * 0.5, y + turtle.h * 0.5);
    if (turtle.falling) {
      ctx.rotate(turtle.spin);
      ctx.globalAlpha = 0.94;
    }

    const tx = -turtle.w * 0.5;
    const ty = -turtle.h * 0.5;

    const shellGrad = ctx.createLinearGradient(tx + 2, ty + 3, tx + turtle.w - 2, ty + turtle.h - 3);
    shellGrad.addColorStop(0, adjustHexColor(shellColor, 36));
    shellGrad.addColorStop(0.6, shellColor);
    shellGrad.addColorStop(1, adjustHexColor(shellColor, -24));
    ctx.fillStyle = shellGrad;
    fillRoundRect(tx + 1.5, ty + 4, turtle.w - 3, turtle.h - 8, 8);

    ctx.fillStyle = "#9cf0a0";
    fillRoundRect(tx + 5, ty + 7, turtle.w - 10, 4, 2);

    const headX = turtle.dir >= 0 ? tx + turtle.w - 10 : tx + 3;
    ctx.fillStyle = "#dfcfb2";
    fillRoundRect(headX, ty + 10, 7, 7, 3);
    ctx.fillStyle = "#24341f";
    fillRoundRect(headX + (turtle.dir >= 0 ? 4 : 1), ty + 12, 2, 2, 1);

    ctx.fillStyle = "#2f6f37";
    fillRoundRect(tx + 3, ty + turtle.h - 4.5, 6.5, 4.5, 2);
    fillRoundRect(tx + turtle.w - 9.5, ty + turtle.h - 4.5, 6.5, 4.5, 2);
    ctx.restore();
  }

  for (const burst of state.blockBursts) {
    const life = burst.ttl / burst.total;
    const ring = (1 - life) * 28;

    ctx.strokeStyle = `rgba(255, 226, 170, ${0.15 + life * 0.55})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, ring, 0, Math.PI * 2);
    ctx.stroke();

    for (const p of burst.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
      ctx.restore();
    }
  }

  for (const burst of state.turtleBursts) {
    const life = burst.ttl / burst.total;
    const ring = (1 - life) * 34;

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + life * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, ring, 0, Math.PI * 2);
    ctx.stroke();

    for (const p of burst.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
  }

  for (const player of state.players) {
    const drawX = player.x + player.w * 0.5;
    const drawY = player.y + player.h * 0.5;

    ctx.save();
    ctx.translate(drawX, drawY);
    if (player.gravityDir === -1) {
      ctx.rotate(Math.PI);
    }

    drawModernVoxelPlayer(player, now);
    ctx.restore();

    if (player.reachedGoal) {
      ctx.fillStyle = "#24a34a";
      ctx.fillRect(player.x + 6, player.y - 10, 18, 6);
    }
  }

  ctx.fillStyle = "#4f4f4f";
  ctx.fillRect(state.world.finishXBottom, state.world.bottomGroundY - 170, 8, 170);
  ctx.fillStyle = "#3eb75e";
  ctx.fillRect(state.world.finishXBottom + 8, state.world.bottomGroundY - 170, 46, 24);
  ctx.fillStyle = "#fff";
  ctx.fillRect(state.world.finishXBottom + 25, state.world.bottomGroundY - 160, 6, 6);

  ctx.fillStyle = "#4f4f4f";
  ctx.fillRect(state.world.finishXTop, state.world.topGroundY, 8, 170);
  ctx.fillStyle = "#3eb75e";
  ctx.fillRect(state.world.finishXTop + 8, state.world.topGroundY + 146, 46, 24);
  ctx.fillStyle = "#fff";
  ctx.fillRect(state.world.finishXTop + 25, state.world.topGroundY + 156, 6, 6);

  ctx.restore();
}

function drawHud() {}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  drawSky();
  drawGround();

  if (state.running) {
    updatePlayer(state.players[0], playerControls(0, state.players[0]), dt, now);
    updatePlayer(state.players[1], playerControls(1, state.players[1]), dt, now);
    updateTunnels(now);

    for (const block of state.blocks) {
      block.hitAnim = Math.max(0, block.hitAnim - dt * 2.5);
    }

    updateBlockBursts(dt);
    updateTurtles(dt);
    updateTurtleBursts(dt);
    updateCoins();
    updatePowerups(dt, now);
    updateGoal();
    updateCamera();
  }

  drawWorld(now * 0.001);
  drawHud();

  requestAnimationFrame(frame);
}

startBtn.addEventListener("click", start);
restartBtn.addEventListener("click", start);
if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", toggleFullscreen);
}
document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  resizeCanvas();
});
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateFullscreenButton();
start();
requestAnimationFrame(frame);
