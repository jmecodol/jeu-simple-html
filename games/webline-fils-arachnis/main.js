const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const state = {
  running: false,
  gameOver: false,
  victory: false,
  width: 0,
  height: 0,
  dpr: 1,
  world: {
    width: 6400,
    floorY: 0,
    ceilingY: 86,
    gravity: 1950,
  },
  cameraX: 0,
  time: 0,
  dt: 0,
  score: 0,
  currentCheckpoint: 120,
  checkpoints: [120, 2100, 3900],
  player: null,
  enemies: [],
  projectiles: [],
  webBolts: [],
  hitSparks: [],
  msg: "",
  pointer: {
    x: 0,
    y: 0,
    worldX: 0,
    worldY: 0,
  },
  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    dodge: false,
    melee: false,
  },
  surfaces: {
    blocks: [],
    walls: [],
    anchors: [],
  },
  boss: null,
};

const MOBILE = {
  active: false,
  movePointerId: null,
  actionPointerId: null,
  stickX: 0,
  stickY: 0,
  moveCenterX: 0,
  moveCenterY: 0,
  moveLastX: 0,
  moveLastY: 0,
  moveStartY: 0,
  moveJumpTriggered: false,
  actionBtnEl: null,
  actionStartY: 0,
  actionLastY: 0,
  actionJumpTriggered: false,
  shootQueued: false,
  jumpQueued: false,
};

const INFINITE_LIVES = true;
const JUMP_VELOCITY = -930;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.dpr = dpr;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = rect.width;
  state.height = rect.height;
  state.world.floorY = state.height - 36;
}

function buildLevel() {
  const floor = () => ({ x: 0, y: state.world.floorY, w: state.world.width, h: 60 });
  const blocks = [
    floor(),
    { x: 300, y: state.world.floorY - 90, w: 220, h: 20 },
    { x: 680, y: state.world.floorY - 170, w: 180, h: 18 },
    { x: 970, y: state.world.floorY - 240, w: 160, h: 18 },
    { x: 1300, y: state.world.floorY - 120, w: 260, h: 20 },
    { x: 1680, y: state.world.floorY - 210, w: 200, h: 18 },
    { x: 1980, y: state.world.floorY - 300, w: 160, h: 18 },
    { x: 2280, y: state.world.floorY - 200, w: 180, h: 18 },
    { x: 2630, y: state.world.floorY - 120, w: 250, h: 20 },
    { x: 3010, y: state.world.floorY - 260, w: 150, h: 18 },
    { x: 3240, y: state.world.floorY - 340, w: 170, h: 18 },
    { x: 3560, y: state.world.floorY - 210, w: 190, h: 18 },
    { x: 3900, y: state.world.floorY - 100, w: 220, h: 20 },
    { x: 4260, y: state.world.floorY - 190, w: 160, h: 18 },
    { x: 4540, y: state.world.floorY - 280, w: 200, h: 18 },
    { x: 4900, y: state.world.floorY - 180, w: 200, h: 18 },
    { x: 5400, y: state.world.floorY - 90, w: 420, h: 20 },
  ];

  const walls = [
    { x: 520, y: state.world.floorY - 310, w: 24, h: 220 },
    { x: 1150, y: state.world.floorY - 420, w: 24, h: 320 },
    { x: 1760, y: state.world.floorY - 430, w: 24, h: 320 },
    { x: 2470, y: state.world.floorY - 400, w: 24, h: 280 },
    { x: 3330, y: state.world.floorY - 500, w: 24, h: 360 },
    { x: 4700, y: state.world.floorY - 430, w: 24, h: 280 },
  ];

  const anchors = [
    { x: 420, y: 150 },
    { x: 720, y: 118 },
    { x: 1040, y: 104 },
    { x: 1440, y: 122 },
    { x: 1870, y: 96 },
    { x: 2200, y: 112 },
    { x: 2550, y: 90 },
    { x: 3020, y: 100 },
    { x: 3420, y: 94 },
    { x: 3860, y: 112 },
    { x: 4300, y: 96 },
    { x: 4680, y: 100 },
    { x: 5200, y: 110 },
    { x: 5700, y: 88 },
  ];

  state.surfaces.blocks = blocks;
  state.surfaces.walls = walls;
  state.surfaces.anchors = anchors;
}

function spawnPlayer(x = 120) {
  state.player = {
    x,
    y: state.world.floorY - 78,
    w: 36,
    h: 54,
    vx: 0,
    vy: 0,
    facing: 1,
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    focus: 0,
    onGround: false,
    jumpGrace: 0,
    jumpBuffer: 0,
    jumpsLeft: 2,
    wallContact: 0,
    wallDir: 0,
    clingCeiling: 0,
    dodgeTime: 0,
    attackTime: 0,
    attackCd: 0,
    trapCd: 0,
    webCd: 0,
    invuln: 0,
    webAnchor: null,
    webLen: 0,
    webAttached: false,
    trail: [],
  };
}

function spawnEnemies() {
  state.enemies = [
    makeEnemy("melee", 760, state.world.floorY - 56),
    makeEnemy("rifle", 1180, state.world.floorY - 56),
    makeEnemy("melee", 1680, state.world.floorY - 56),
    makeEnemy("rifle", 2140, state.world.floorY - 56),
    makeEnemy("rifle", 2760, state.world.floorY - 56),
    makeEnemy("melee", 3360, state.world.floorY - 56),
    makeEnemy("rifle", 4080, state.world.floorY - 56),
    makeEnemy("melee", 4720, state.world.floorY - 56),
  ];

  state.boss = {
    type: "boss",
    x: 5720,
    y: state.world.floorY - 88,
    w: 58,
    h: 86,
    vx: 0,
    vy: 0,
    dir: -1,
    hp: 260,
    maxHp: 260,
    shootTimer: 2.4,
    summonTimer: 5,
    telegraph: 0,
    webStacks: 0,
    stuckTime: 0,
    grounded: false,
  };
}

function makeEnemy(type, x, y) {
  if (type === "rifle") {
    return {
      type,
      x,
      y,
      w: 34,
      h: 56,
      vx: 0,
      vy: 0,
      dir: -1,
      hp: 72,
      maxHp: 72,
      patrolA: x - 110,
      patrolB: x + 110,
      aggro: 0,
      shootTimer: 1.4 + Math.random() * 1.2,
      telegraph: 0,
      webStacks: 0,
      stuckTime: 0,
      grounded: false,
    };
  }

  return {
    type,
    x,
    y,
    w: 36,
    h: 56,
    vx: 0,
    vy: 0,
    dir: -1,
    hp: 84,
    maxHp: 84,
    patrolA: x - 90,
    patrolB: x + 90,
    aggro: 0,
    attackTimer: 0,
    webStacks: 0,
    stuckTime: 0,
    grounded: false,
  };
}

function resetGame(startX = 120) {
  state.gameOver = false;
  state.victory = false;
  state.score = 0;
  state.msg = "";
  state.projectiles = [];
  state.webBolts = [];
  state.hitSparks = [];
  buildLevel();
  spawnPlayer(startX);
  spawnEnemies();
  state.currentCheckpoint = startX;
  state.cameraX = clamp(startX - state.width * 0.35, 0, state.world.width - state.width);
}

function setMessage(text) {
  state.msg = text;
}

function pointerEventToWorld(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  state.pointer.x = x;
  state.pointer.y = y;
  state.pointer.worldX = x + state.cameraX;
  state.pointer.worldY = y;
}

function setKey(code, pressed) {
  if (code === "KeyA" || code === "ArrowLeft") state.keys.left = pressed;
  if (code === "KeyD" || code === "ArrowRight") state.keys.right = pressed;
  if (code === "KeyW" || code === "ArrowUp") state.keys.up = pressed;
  if (code === "KeyS" || code === "ArrowDown") state.keys.down = pressed;
  if (code === "Space") state.keys.jump = pressed;
  if (code === "ShiftLeft" || code === "ShiftRight") state.keys.dodge = pressed;
  if (code === "KeyE") state.keys.melee = pressed;
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "KeyR") {
    resetGame(state.currentCheckpoint);
    state.running = true;
    overlay.classList.remove("show");
    return;
  }
  if (event.code === "KeyQ" && state.player) {
    state.player.webAttached = false;
    state.player.webAnchor = null;
  }
  setKey(event.code, true);
});

window.addEventListener("keyup", (event) => {
  setKey(event.code, false);
});

canvas.addEventListener("mousemove", (event) => {
  pointerEventToWorld(event);
});

canvas.addEventListener("mousedown", (event) => {
  pointerEventToWorld(event);
  if (!state.running || !state.player) return;

  if (event.button === 0) {
    launchMobilityWeb(state.pointer.worldX, state.pointer.worldY);
  }
  if (event.button === 2) {
    shootCaptureWeb(state.pointer.worldX, state.pointer.worldY);
  }
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

canvas.addEventListener("mouseup", (event) => {
  if (event.button === 0 && state.player) {
    state.player.webAttached = false;
    state.player.webAnchor = null;
  }
});

function ensureMobileHud() {
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  MOBILE.active = isTouch;
  if (!isTouch) return;

  if (document.querySelector(".mobileHud")) return;

  const hud = document.createElement("div");
  hud.className = "mobileHud";
  hud.innerHTML = `
    <div class="mobileCluster left" id="moveZone">
      <div class="stick" id="stick">
        <div class="stickKnob" id="stickKnob"></div>
      </div>
    </div>
    <div class="mobileCluster right" id="actionZone">
      <div class="actionRing">
        <button class="actionBtn" id="actionBtn" type="button">TIR</button>
      </div>
    </div>
  `;

  document.querySelector(".stageWrap").appendChild(hud);

  const moveZone = document.getElementById("moveZone");
  const actionZone = document.getElementById("actionZone");
  const actionBtn = document.getElementById("actionBtn");
  const stick = document.getElementById("stick");
  const stickKnob = document.getElementById("stickKnob");
  MOBILE.actionBtnEl = actionBtn;

  const getStickAnchor = () => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + 22 + 68,
      y: rect.top + rect.height - 18 - 68,
    };
  };

  const updateStickFromPoint = (clientX, clientY, reset = false) => {
    let dx = 0;
    let dy = 0;

    if (!reset) {
      dx = clientX - MOBILE.moveCenterX;
      dy = clientY - MOBILE.moveCenterY;
      const mag = Math.hypot(dx, dy);
      const lim = 46;
      if (mag > lim) {
        dx = (dx / mag) * lim;
        dy = (dy / mag) * lim;
      }
    }

    MOBILE.stickX = dx / 46;
    MOBILE.stickY = dy / 46;
    stickKnob.style.left = `${40 + dx}px`;
    stickKnob.style.top = `${40 + dy}px`;
  };

  moveZone.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (MOBILE.movePointerId !== null) return;
    MOBILE.movePointerId = event.pointerId;
    const anchor = getStickAnchor();
    MOBILE.moveCenterX = anchor.x;
    MOBILE.moveCenterY = anchor.y;
    MOBILE.moveLastX = event.clientX;
    MOBILE.moveLastY = event.clientY;
    MOBILE.moveStartY = event.clientY;
    MOBILE.moveJumpTriggered = false;
    updateStickFromPoint(event.clientX, event.clientY);
    const rect = canvas.getBoundingClientRect();
    const localX = anchor.x - rect.left;
    const localY = anchor.y - rect.top;
    stick.style.left = `${localX - 68}px`;
    stick.style.top = `${localY - 68}px`;
    stick.style.right = "auto";
    stick.style.bottom = "auto";
    moveZone.setPointerCapture(event.pointerId);
  });

  moveZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== MOBILE.movePointerId) return;
    event.preventDefault();
    MOBILE.moveLastX = event.clientX;
    MOBILE.moveLastY = event.clientY;
    if (!MOBILE.moveJumpTriggered && event.clientY - MOBILE.moveStartY < -22) {
      MOBILE.jumpQueued = true;
      MOBILE.moveJumpTriggered = true;
    }
    updateStickFromPoint(event.clientX, event.clientY);
  });

  const resetMove = (event) => {
    if (event.pointerId !== MOBILE.movePointerId) return;
    MOBILE.movePointerId = null;
    MOBILE.moveJumpTriggered = false;
    updateStickFromPoint(MOBILE.moveLastX, MOBILE.moveLastY, true);
    stick.style.left = "auto";
    stick.style.top = "auto";
    stick.style.right = "auto";
    stick.style.left = `calc(22px + env(safe-area-inset-left))`;
    stick.style.bottom = `calc(18px + env(safe-area-inset-bottom))`;
  };

  moveZone.addEventListener("pointerup", resetMove);
  moveZone.addEventListener("pointercancel", resetMove);
  moveZone.addEventListener("pointerleave", (event) => {
    if (event.pointerId === MOBILE.movePointerId) {
      resetMove(event);
    }
  });

  actionZone.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (MOBILE.actionPointerId !== null) return;
    MOBILE.actionPointerId = event.pointerId;
    MOBILE.actionStartY = event.clientY;
    MOBILE.actionLastY = event.clientY;
    MOBILE.actionJumpTriggered = false;
    actionZone.setPointerCapture(event.pointerId);
  });

  actionZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== MOBILE.actionPointerId) return;
    event.preventDefault();
    MOBILE.actionLastY = event.clientY;
    if (!MOBILE.actionJumpTriggered && event.clientY - MOBILE.actionStartY < -18) {
      MOBILE.jumpQueued = true;
      MOBILE.actionJumpTriggered = true;
    }
  });

  const releaseActionPad = (event) => {
    if (event.pointerId !== MOBILE.actionPointerId) return;
    const dy = MOBILE.actionLastY - MOBILE.actionStartY;
    if (!MOBILE.actionJumpTriggered && dy > -14) {
      MOBILE.shootQueued = true;
    }
    MOBILE.actionJumpTriggered = false;
    MOBILE.actionPointerId = null;
  };

  actionZone.addEventListener("pointerup", releaseActionPad);
  actionZone.addEventListener("pointercancel", releaseActionPad);
  actionBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("pointerdown", (event) => {
    pointerEventToWorld(event);
  });
}

function launchMobilityWeb(targetX, targetY) {
  const p = state.player;
  if (!p || p.webCd > 0 || p.stamina < 12) return;

  let chosen = null;
  let best = 999999;

  for (const anchor of state.surfaces.anchors) {
    const d = dist(targetX, targetY, anchor.x, anchor.y);
    if (d < 120 && d < best) {
      chosen = anchor;
      best = d;
    }
  }

  for (const wall of state.surfaces.walls) {
    const cx = clamp(targetX, wall.x, wall.x + wall.w);
    const cy = clamp(targetY, wall.y, wall.y + wall.h);
    const d = dist(targetX, targetY, cx, cy);
    if (d < 70 && d < best) {
      chosen = { x: cx, y: cy };
      best = d;
    }
  }

  if (targetY < state.world.ceilingY + 40 && !chosen) {
    chosen = { x: clamp(targetX, 0, state.world.width), y: state.world.ceilingY };
  }

  if (!chosen) return;

  const px = p.x + p.w * 0.5;
  const py = p.y + p.h * 0.35;
  const ropeLen = dist(px, py, chosen.x, chosen.y);
  if (ropeLen > 420) return;

  p.webAttached = true;
  p.webAnchor = chosen;
  p.webLen = clamp(ropeLen * 0.88, 60, 360);
  p.webCd = 0.18;
  p.stamina = Math.max(0, p.stamina - 12);
}

function shootCaptureWeb(targetX, targetY) {
  const p = state.player;
  if (!p || p.trapCd > 0 || p.stamina < 8) return;

  const px = p.x + p.w * 0.5;
  const py = p.y + p.h * 0.42;
  const dx = targetX - px;
  const dy = targetY - py;
  const mag = Math.hypot(dx, dy) || 1;

  state.webBolts.push({
    x: px,
    y: py,
    vx: (dx / mag) * 900,
    vy: (dy / mag) * 900,
    life: 0.45,
  });

  p.trapCd = 0.08;
  p.stamina = Math.max(0, p.stamina - 8);
}

function triggerMelee() {
  const p = state.player;
  if (!p || p.attackCd > 0) return;
  p.attackTime = 0.18;
  p.attackCd = 0.32;
}

function triggerDodge() {
  const p = state.player;
  if (!p || p.dodgeTime > 0 || p.stamina < 8) return;
  p.dodgeTime = 0.2;
  p.invuln = Math.max(p.invuln, 0.2);
  p.stamina = Math.max(0, p.stamina - 8);
  p.vx = p.facing * 460;
}

function getNearestEnemy(maxRange) {
  const p = state.player;
  if (!p) return null;

  const px = p.x + p.w * 0.5;
  const py = p.y + p.h * 0.45;
  let best = null;
  let bestDist = maxRange;

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const ex = enemy.x + enemy.w * 0.5;
    const ey = enemy.y + enemy.h * 0.4;
    const d = dist(px, py, ex, ey);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }

  if (state.boss && state.boss.hp > 0) {
    const ex = state.boss.x + state.boss.w * 0.5;
    const ey = state.boss.y + state.boss.h * 0.4;
    const d = dist(px, py, ex, ey);
    if (d < bestDist) {
      best = state.boss;
    }
  }

  return best;
}

function fireMobileShot() {
  const p = state.player;
  if (!p) return;

  const target = getNearestEnemy(640);
  if (target) {
    shootCaptureWeb(target.x + target.w * 0.5, target.y + target.h * 0.45);
    return;
  }

  shootCaptureWeb(p.x + p.facing * 320, p.y + p.h * 0.45);
}

function updateInput(dt) {
  if (!state.player) return;

  if (MOBILE.active) {
    state.keys.left = MOBILE.stickX < -0.4;
    state.keys.right = MOBILE.stickX > 0.4;
    state.keys.up = false;

    if (MOBILE.jumpQueued) {
      state.keys.jump = true;
      MOBILE.jumpQueued = false;
    }
    if (MOBILE.shootQueued) {
      fireMobileShot();
      MOBILE.shootQueued = false;
    }
  }

  if (state.keys.melee) {
    triggerMelee();
  }
  if (state.keys.dodge) {
    triggerDodge();
  }

  const p = state.player;
  p.jumpBuffer -= dt;
  if (state.keys.jump) {
    p.jumpBuffer = 0.16;
  }
  state.keys.jump = false;
}

function resolveSolid(body) {
  body.grounded = false;
  for (const block of state.surfaces.blocks) {
    if (!overlaps(body, block)) continue;

    const overlapX1 = block.x + block.w - body.x;
    const overlapX2 = body.x + body.w - block.x;
    const overlapY1 = block.y + block.h - body.y;
    const overlapY2 = body.y + body.h - block.y;

    const minX = Math.min(overlapX1, overlapX2);
    const minY = Math.min(overlapY1, overlapY2);

    if (minX < minY) {
      if (overlapX1 < overlapX2) {
        body.x = block.x + block.w;
      } else {
        body.x = block.x - body.w;
      }
      body.vx *= -0.08;
    } else {
      if (overlapY1 < overlapY2) {
        body.y = block.y + block.h;
        if (body.vy < 0) body.vy = 0;
      } else {
        body.y = block.y - body.h;
        if (body.vy > 0) body.vy = 0;
        body.grounded = true;
      }
    }
  }

  for (const wall of state.surfaces.walls) {
    if (!overlaps(body, wall)) continue;

    const overlapX1 = wall.x + wall.w - body.x;
    const overlapX2 = body.x + body.w - wall.x;
    const overlapY1 = wall.y + wall.h - body.y;
    const overlapY2 = body.y + body.h - wall.y;

    const minX = Math.min(overlapX1, overlapX2);
    const minY = Math.min(overlapY1, overlapY2);

    if (minX <= minY) {
      if (overlapX1 < overlapX2) {
        body.x = wall.x + wall.w;
      } else {
        body.x = wall.x - body.w;
      }
      body.vx *= -0.1;
      if (body === state.player) {
        state.player.wallContact = 0.14;
        state.player.wallDir = overlapX1 < overlapX2 ? -1 : 1;
      }
    } else if (overlapY1 < overlapY2) {
      body.y = wall.y + wall.h;
      if (body.vy < 0) body.vy = 0;
    } else {
      body.y = wall.y - body.h;
      if (body.vy > 0) body.vy = 0;
      body.grounded = true;
    }
  }
}

function applyWebSwing(p, dt) {
  if (!p.webAttached || !p.webAnchor) return;

  const px = p.x + p.w * 0.5;
  const py = p.y + p.h * 0.42;
  const dx = px - p.webAnchor.x;
  const dy = py - p.webAnchor.y;
  const currentLen = Math.hypot(dx, dy) || 1;

  if (currentLen > p.webLen) {
    const diff = currentLen - p.webLen;
    const nx = dx / currentLen;
    const ny = dy / currentLen;
    const pull = diff * 34;

    p.vx -= nx * pull * dt;
    p.vy -= ny * pull * dt;

    // Remove radial speed to keep rope tension stable.
    const radialSpeed = p.vx * nx + p.vy * ny;
    if (radialSpeed > 0) {
      p.vx -= radialSpeed * nx;
      p.vy -= radialSpeed * ny;
    }
  }

  p.stamina = Math.max(0, p.stamina - dt * 8.5);
  if (p.stamina <= 0) {
    p.webAttached = false;
    p.webAnchor = null;
  }
}

function updatePlayer(dt) {
  const p = state.player;
  if (!p) return;

  p.webCd = Math.max(0, p.webCd - dt);
  p.trapCd = Math.max(0, p.trapCd - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.attackTime = Math.max(0, p.attackTime - dt);
  p.dodgeTime = Math.max(0, p.dodgeTime - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.wallContact = Math.max(0, p.wallContact - dt);
  p.jumpGrace = p.onGround ? 0.11 : Math.max(0, p.jumpGrace - dt);

  if (!p.webAttached && p.stamina < p.maxStamina) {
    p.stamina = Math.min(p.maxStamina, p.stamina + dt * 11);
  }

  const accel = p.dodgeTime > 0 ? 900 : 1900;
  const maxSpeed = p.dodgeTime > 0 ? 440 : 280;
  const move = (state.keys.left ? -1 : 0) + (state.keys.right ? 1 : 0);

  if (move !== 0) {
    p.facing = move;
    p.vx += move * accel * dt;
  } else {
    p.vx = lerp(p.vx, 0, clamp(dt * 8, 0, 1));
  }

  p.vx = clamp(p.vx, -maxSpeed, maxSpeed);

  const wantsCeiling = state.keys.up && p.stamina > 4 && p.y < state.world.ceilingY + 90;
  if (wantsCeiling) {
    p.clingCeiling = 0.18;
  } else {
    p.clingCeiling = Math.max(0, p.clingCeiling - dt);
  }

  if (p.clingCeiling > 0 && p.y <= state.world.ceilingY + 12) {
    p.vy = 0;
    p.y = state.world.ceilingY + 10;
    p.stamina = Math.max(0, p.stamina - dt * 10);
  } else {
    const wallSliding = p.wallContact > 0 && !p.onGround && move === p.wallDir;
    const gravityMul = wallSliding ? 0.45 : 1;
    p.vy += state.world.gravity * gravityMul * dt;
    if (wallSliding) {
      p.vy = Math.min(p.vy, 260);
      p.stamina = Math.max(0, p.stamina - dt * 4);
    }
  }

  if (p.jumpBuffer > 0) {
    const canGroundJump = p.onGround || p.jumpGrace > 0;
    const canWallJump = p.wallContact > 0;
    if (canGroundJump || canWallJump || p.jumpsLeft > 0) {
      p.jumpBuffer = 0;
      p.webAttached = false;
      p.webAnchor = null;

      if (canWallJump) {
        p.vx = -p.wallDir * 250;
      }

        p.vy = JUMP_VELOCITY;
      if (!canGroundJump) {
        p.jumpsLeft = Math.max(0, p.jumpsLeft - 1);
      }
      p.onGround = false;
    }
  }

  applyWebSwing(p, dt);

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  resolveSolid(p);

  p.onGround = p.grounded;
  if (p.onGround) {
    p.jumpsLeft = 1;
  }

  p.x = clamp(p.x, 0, state.world.width - p.w);
  if (p.y > state.height + 180) {
    applyPlayerDamage(18, "Chute dangereuse");
    respawnPlayer();
  }

  if (p.y < state.world.ceilingY - 12) {
    p.y = state.world.ceilingY - 12;
    if (p.vy < 0) p.vy = 0;
  }

  p.focus = clamp(p.focus + dt * 2.5, 0, 100);

  p.trail.push({ x: p.x + p.w * 0.5, y: p.y + p.h * 0.45, life: 0.25 });
  if (p.trail.length > 16) p.trail.shift();

  for (const t of p.trail) t.life -= dt;
  p.trail = p.trail.filter((t) => t.life > 0);

  for (const cp of state.checkpoints) {
    if (p.x >= cp) state.currentCheckpoint = cp;
  }
}

function respawnPlayer() {
  const p = state.player;
  p.x = state.currentCheckpoint;
  p.y = state.world.floorY - p.h - 2;
  p.vx = 0;
  p.vy = 0;
  p.webAttached = false;
  p.webAnchor = null;
  p.stamina = Math.min(p.maxStamina, p.stamina + 35);
  p.invuln = 1.2;
}

function applyPlayerDamage(amount, source) {
  const p = state.player;
  if (!p || p.invuln > 0 || state.victory || state.gameOver) return;

  if (INFINITE_LIVES) {
    p.invuln = 0.2;
    if (source) {
      setMessage(`${source} ignore (vies infinies)`);
    }
    return;
  }

  p.health = Math.max(0, p.health - amount);
  p.invuln = 0.55;
  p.webAttached = false;
  p.webAnchor = null;

  if (source) setMessage(`${source} - vie: ${Math.ceil(p.health)}`);

  if (p.health <= 0) {
    state.gameOver = true;
    state.running = false;
    overlay.classList.add("show");
    overlay.querySelector("h2").textContent = "Defaite";
    overlay.querySelector("p").textContent =
      "Le fils d'Arachnis est tombe. Rejoue depuis le dernier checkpoint.";
    startBtn.textContent = "Relancer";
  }
}

function hitEnemy(enemy, damage, pushDir = 0) {
  if (enemy.type !== "boss") {
    enemy.hp = 0;
    enemy.vx += pushDir * 140;
    state.hitSparks.push({ x: enemy.x + enemy.w * 0.5, y: enemy.y + enemy.h * 0.3, life: 0.2 });
    state.score += 260;
    return;
  }

  enemy.hp -= damage;
  enemy.vx += pushDir * 140;
  state.hitSparks.push({ x: enemy.x + enemy.w * 0.5, y: enemy.y + enemy.h * 0.3, life: 0.2 });
  if (enemy.hp <= 0) {
    state.score += enemy.type === "boss" ? 1800 : 260;
  }
}

function updateMeleeHits() {
  const p = state.player;
  if (!p || p.attackTime <= 0) return;

  const hitbox = {
    x: p.facing > 0 ? p.x + p.w - 4 : p.x - 48,
    y: p.y + 10,
    w: 52,
    h: 40,
  };

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.stuckTime > 0) continue;
    if (overlaps(hitbox, enemy)) {
      hitEnemy(enemy, 26, p.facing);
      enemy.stuckTime = Math.max(enemy.stuckTime, 0.12);
    }
  }

  if (state.boss && state.boss.hp > 0 && overlaps(hitbox, state.boss)) {
    const bonus = state.boss.webStacks >= 2 ? 44 : 30;
    hitEnemy(state.boss, bonus, p.facing);
  }
}

function updateWebBolts(dt) {
  for (const bolt of state.webBolts) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      if (bolt.x >= enemy.x && bolt.x <= enemy.x + enemy.w && bolt.y >= enemy.y && bolt.y <= enemy.y + enemy.h) {
        bolt.life = 0;
        enemy.webStacks = clamp(enemy.webStacks + 1, 0, 3);
        enemy.stuckTime = Math.max(enemy.stuckTime, 0.45 + enemy.webStacks * 0.3);
        enemy.vx *= 0.4;
        if (enemy.webStacks >= 3) {
          enemy.stuckTime = Math.max(enemy.stuckTime, 2.2);
        }
        state.hitSparks.push({ x: bolt.x, y: bolt.y, life: 0.24 });
      }
    }

    const b = state.boss;
    if (b && b.hp > 0 && bolt.x >= b.x && bolt.x <= b.x + b.w && bolt.y >= b.y && bolt.y <= b.y + b.h) {
      bolt.life = 0;
      b.webStacks = clamp(b.webStacks + 1, 0, 3);
      b.stuckTime = Math.max(b.stuckTime, 0.7 + b.webStacks * 0.25);
      if (b.webStacks >= 3) b.stuckTime = Math.max(b.stuckTime, 1.8);
      state.hitSparks.push({ x: bolt.x, y: bolt.y, life: 0.24 });
    }
  }

  state.webBolts = state.webBolts.filter((b) => b.life > 0);
}

function updateProjectiles(dt) {
  const p = state.player;

  for (const shot of state.projectiles) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;

    if (shot.y >= state.world.floorY || shot.y <= state.world.ceilingY - 10) {
      shot.life = 0;
    }

    for (const wall of state.surfaces.walls) {
      if (
        shot.x >= wall.x &&
        shot.x <= wall.x + wall.w &&
        shot.y >= wall.y &&
        shot.y <= wall.y + wall.h
      ) {
        shot.life = 0;
      }
    }

    if (
      p &&
      shot.life > 0 &&
      shot.x >= p.x &&
      shot.x <= p.x + p.w &&
      shot.y >= p.y &&
      shot.y <= p.y + p.h
    ) {
      shot.life = 0;
      applyPlayerDamage(shot.damage, "Tir ennemi");
      p.vx += shot.vx * 0.08;
    }
  }

  state.projectiles = state.projectiles.filter((s) => s.life > 0);
}

function updateEnemyAI(enemy, dt) {
  if (enemy.hp <= 0) return;

  const p = state.player;
  const ex = enemy.x + enemy.w * 0.5;
  const px = p.x + p.w * 0.5;
  const range = Math.abs(px - ex);

  enemy.stuckTime = Math.max(0, enemy.stuckTime - dt);
  if (enemy.webStacks > 0 && enemy.stuckTime <= 0) {
    enemy.webStacks = Math.max(0, enemy.webStacks - dt * 0.5);
  }

  if (enemy.stuckTime > 0) {
    enemy.vx = lerp(enemy.vx, 0, clamp(dt * 12, 0, 1));
  } else {
    if (range < 520) enemy.aggro = 3.5;
    enemy.aggro = Math.max(0, enemy.aggro - dt);

    if (enemy.type === "melee") {
      if (enemy.aggro > 0) {
        enemy.dir = px < ex ? -1 : 1;
        enemy.vx += enemy.dir * 860 * dt;
      } else {
        if (enemy.x <= enemy.patrolA) enemy.dir = 1;
        if (enemy.x >= enemy.patrolB) enemy.dir = -1;
        enemy.vx += enemy.dir * 520 * dt;
      }
      enemy.vx = clamp(enemy.vx, -160, 160);

      enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
      if (range < 56 && Math.abs((p.y + p.h * 0.5) - (enemy.y + enemy.h * 0.5)) < 46 && enemy.attackTimer <= 0) {
        enemy.attackTimer = 1.1;
        applyPlayerDamage(14, "Coup ennemi");
        p.vx += enemy.dir * 110;
      }
    }

    if (enemy.type === "rifle") {
      enemy.vx = lerp(enemy.vx, 0, clamp(dt * 4.6, 0, 1));
      enemy.dir = px < ex ? -1 : 1;
      enemy.shootTimer -= dt;

      if (range < 540 && enemy.shootTimer <= 0) {
        enemy.telegraph = 0.35;
        enemy.shootTimer = 1.9 + Math.random() * 1.1;
      }

      if (enemy.telegraph > 0) {
        enemy.telegraph -= dt;
        if (enemy.telegraph <= 0) {
          const sx = enemy.x + enemy.w * 0.5 + enemy.dir * 16;
          const sy = enemy.y + 22;
          const dx = (p.x + p.w * 0.5) - sx;
          const dy = (p.y + p.h * 0.4) - sy;
          const mag = Math.hypot(dx, dy) || 1;
          state.projectiles.push({
            x: sx,
            y: sy,
            vx: (dx / mag) * 540,
            vy: (dy / mag) * 540,
            life: 2.2,
            damage: 12,
          });
        }
      }
    }
  }

  enemy.vy += state.world.gravity * dt;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;

  resolveSolid(enemy);
  enemy.grounded = enemy.grounded;

  if (enemy.grounded) {
    enemy.vy = Math.max(0, enemy.vy);
  }
}

function updateBoss(dt) {
  const b = state.boss;
  if (!b || b.hp <= 0) return;
  const p = state.player;

  b.stuckTime = Math.max(0, b.stuckTime - dt);
  if (b.webStacks > 0 && b.stuckTime <= 0) {
    b.webStacks = Math.max(0, b.webStacks - dt * 0.35);
  }

  b.shootTimer -= dt;
  b.summonTimer -= dt;

  const px = p.x + p.w * 0.5;
  const bx = b.x + b.w * 0.5;

  if (b.stuckTime <= 0) {
    b.dir = px < bx ? -1 : 1;
    b.vx += b.dir * 750 * dt;
    b.vx = clamp(b.vx, -140, 140);
  } else {
    b.vx = lerp(b.vx, 0, clamp(dt * 9, 0, 1));
  }

  if (Math.abs(px - bx) < 680 && b.shootTimer <= 0) {
    b.telegraph = 0.42;
    b.shootTimer = 2.2;
  }

  if (b.telegraph > 0) {
    b.telegraph -= dt;
    if (b.telegraph <= 0) {
      for (let i = -1; i <= 1; i += 1) {
        const sx = b.x + b.w * 0.5 + b.dir * 22;
        const sy = b.y + 26;
        const dx = (p.x + p.w * 0.5) - sx + i * 34;
        const dy = (p.y + p.h * 0.4) - sy;
        const mag = Math.hypot(dx, dy) || 1;
        state.projectiles.push({
          x: sx,
          y: sy,
          vx: (dx / mag) * 620,
          vy: (dy / mag) * 620,
          life: 2.4,
          damage: 11,
        });
      }
    }
  }

  if (b.summonTimer <= 0 && b.hp > 0) {
    b.summonTimer = 6.4;
    state.enemies.push(makeEnemy("melee", b.x - 120, state.world.floorY - 56));
    if (Math.random() > 0.4) {
      state.enemies.push(makeEnemy("rifle", b.x - 200, state.world.floorY - 56));
    }
  }

  b.vy += state.world.gravity * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  resolveSolid(b);
  if (b.x < 5320) b.x = 5320;
  if (b.x > 6180) b.x = 6180;
}

function updateEntities(dt) {
  for (const enemy of state.enemies) {
    updateEnemyAI(enemy, dt);
  }
  updateBoss(dt);

  state.enemies = state.enemies.filter((e) => e.hp > 0);

  updateMeleeHits();
  updateWebBolts(dt);
  updateProjectiles(dt);

  for (const spark of state.hitSparks) {
    spark.life -= dt;
  }
  state.hitSparks = state.hitSparks.filter((s) => s.life > 0);

  const p = state.player;
  const goalClear = state.boss && state.boss.hp <= 0;
  if (goalClear && !state.victory && p.x > 6120) {
    state.victory = true;
    state.running = false;
    overlay.classList.add("show");
    overlay.querySelector("h2").textContent = "Victoire";
    overlay.querySelector("p").textContent =
      "La ville est sauvee. Tu as maitrise la toile et vaincu le chef du gang.";
    startBtn.textContent = "Rejouer";
  }
}

function updateCamera(dt) {
  const p = state.player;
  const target = p.x - state.width * 0.35;
  state.cameraX = lerp(state.cameraX, clamp(target, 0, state.world.width - state.width), clamp(dt * 4, 0, 1));
}

function update(dt) {
  if (!state.running || state.gameOver || state.victory) return;

  state.time += dt;
  state.dt = dt;

  updateInput(dt);
  updatePlayer(dt);
  updateEntities(dt);
  updateCamera(dt);
}

function drawCityBackground() {
  const cam = state.cameraX;
  const h = state.height;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0f2647");
  g.addColorStop(1, "#040a14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, state.width, h);

  for (let layer = 0; layer < 3; layer += 1) {
    const speed = 0.15 + layer * 0.18;
    const alpha = 0.22 + layer * 0.16;
    const baseY = h - 120 - layer * 52;
    const offset = -(cam * speed) % 280;

    ctx.fillStyle = `rgba(7, 17, 33, ${alpha})`;
    for (let i = -1; i < 8; i += 1) {
      const x = offset + i * 280;
      const w = 120 + ((i + layer * 7) % 4) * 36;
      const hh = 90 + ((i + layer * 3) % 5) * 50;
      ctx.fillRect(x, baseY - hh, w, hh);

      ctx.fillStyle = "rgba(29, 168, 255, 0.2)";
      for (let wx = 8; wx < w - 10; wx += 16) {
        const blink = 0.35 + 0.65 * Math.sin(state.time * 1.2 + (x + wx) * 0.03 + layer);
        ctx.globalAlpha = 0.18 * blink;
        for (let wy = 8; wy < hh - 12; wy += 18) {
          ctx.fillRect(x + wx, baseY - hh + wy, 6, 8);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(7, 17, 33, ${alpha})`;
    }
  }

  ctx.fillStyle = "#051223";
  ctx.fillRect(0, state.world.floorY, state.width, state.height - state.world.floorY);

  ctx.strokeStyle = "#17518a88";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, state.world.floorY);
  ctx.lineTo(state.width, state.world.floorY);
  ctx.stroke();
}

function drawWorld() {
  const cam = state.cameraX;

  ctx.save();
  ctx.translate(-cam, 0);

  ctx.fillStyle = "#0e2d49";
  for (const block of state.surfaces.blocks) {
    if (block.y >= state.world.floorY - 1) continue;
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.fillStyle = "#1da8ff33";
    ctx.fillRect(block.x, block.y, block.w, 4);
    ctx.fillStyle = "#0e2d49";
  }

  ctx.fillStyle = "#183147";
  for (const wall of state.surfaces.walls) {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = "#ffffff14";
    ctx.fillRect(wall.x + 4, wall.y + 4, 4, wall.h - 8);
    ctx.fillStyle = "#183147";
  }

  for (const anchor of state.surfaces.anchors) {
    ctx.beginPath();
    ctx.fillStyle = "#ff4d77";
    ctx.arc(anchor.x, anchor.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = "#ffd2deaa";
    ctx.lineWidth = 2;
    ctx.arc(anchor.x, anchor.y, 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemy(enemy) {
  const x = enemy.x - state.cameraX;
  const y = enemy.y;
  const isRifle = enemy.type === "rifle" || enemy.type === "boss";

  const body = enemy.type === "boss" ? "#6d1529" : isRifle ? "#6a2430" : "#6c3128";
  const edge = enemy.type === "boss" ? "#ff5a77" : "#ff7d58";

  ctx.fillStyle = body;
  ctx.fillRect(x, y, enemy.w, enemy.h);
  ctx.fillStyle = edge;
  ctx.fillRect(x + 4, y + 6, enemy.w - 8, 10);

  ctx.fillStyle = "#f8f8ff";
  ctx.fillRect(x + enemy.w * 0.2, y + 22, 8, 6);
  ctx.fillRect(x + enemy.w * 0.62, y + 22, 8, 6);

  if (isRifle) {
    ctx.fillStyle = "#253445";
    const gunY = y + enemy.h * 0.55;
    const gunX = enemy.dir > 0 ? x + enemy.w - 2 : x - 16;
    ctx.fillRect(gunX, gunY, 18, 6);
    if (enemy.telegraph > 0) {
      ctx.strokeStyle = "#ff6584";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + enemy.w * 0.5, y + enemy.h * 0.45);
      ctx.lineTo((state.player.x + state.player.w * 0.5) - state.cameraX, state.player.y + state.player.h * 0.35);
      ctx.stroke();
    }
  }

  const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  ctx.fillStyle = "#00000099";
  ctx.fillRect(x, y - 10, enemy.w, 4);
  ctx.fillStyle = enemy.type === "boss" ? "#ff3a66" : "#52e38a";
  ctx.fillRect(x, y - 10, enemy.w * hpRatio, 4);

  if (enemy.webStacks > 0 || enemy.stuckTime > 0) {
    ctx.strokeStyle = "#d7f0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 6);
    ctx.lineTo(x + enemy.w - 2, y + enemy.h - 4);
    ctx.moveTo(x + enemy.w - 2, y + 6);
    ctx.lineTo(x + 2, y + enemy.h - 4);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = state.player;
  const x = p.x - state.cameraX;
  const y = p.y;

  for (const t of p.trail) {
    const alpha = clamp(t.life / 0.25, 0, 1) * 0.45;
    ctx.fillStyle = `rgba(29, 168, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(t.x - state.cameraX, t.y, 9 * alpha + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.webAttached && p.webAnchor) {
    ctx.strokeStyle = "#e8f7ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + p.w * 0.5, y + p.h * 0.35);
    ctx.lineTo(p.webAnchor.x - state.cameraX, p.webAnchor.y);
    ctx.stroke();
  }

  ctx.fillStyle = p.invuln > 0 ? "#ff839e" : "#161a24";
  ctx.fillRect(x, y, p.w, p.h);

  ctx.fillStyle = "#ff305d";
  ctx.fillRect(x + 4, y + 5, p.w - 8, p.h - 8);

  ctx.fillStyle = "#0b1224";
  ctx.fillRect(x + 8, y + 10, p.w - 16, p.h - 12);

  ctx.fillStyle = "#f5fdff";
  ctx.fillRect(x + 7, y + 18, 9, 8);
  ctx.fillRect(x + p.w - 16, y + 18, 9, 8);

  if (p.attackTime > 0) {
    ctx.strokeStyle = "#f9fbff";
    ctx.lineWidth = 3;
    const sx = p.facing > 0 ? x + p.w : x;
    ctx.beginPath();
    ctx.moveTo(sx, y + 22);
    ctx.lineTo(sx + p.facing * 34, y + 18);
    ctx.lineTo(sx + p.facing * 30, y + 38);
    ctx.stroke();
  }
}

function drawShots() {
  for (const shot of state.projectiles) {
    const x = shot.x - state.cameraX;
    ctx.beginPath();
    ctx.fillStyle = "#ff6788";
    ctx.arc(x, shot.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const bolt of state.webBolts) {
    const x = bolt.x - state.cameraX;
    ctx.beginPath();
    ctx.fillStyle = "#d7f0ff";
    ctx.arc(x, bolt.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const spark of state.hitSparks) {
    const alpha = clamp(spark.life / 0.24, 0, 1);
    const x = spark.x - state.cameraX;
    ctx.strokeStyle = `rgba(255, 240, 204, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, spark.y);
    ctx.lineTo(x + 8, spark.y);
    ctx.moveTo(x, spark.y - 8);
    ctx.lineTo(x, spark.y + 8);
    ctx.stroke();
  }
}

function drawHud() {
  const p = state.player;

  const panelX = 12;
  const panelY = 12;
  const panelW = Math.min(360, state.width - 24);
  const panelH = 78;

  ctx.fillStyle = "#031224bb";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#6db9ff66";
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  const hpRatio = clamp(p.health / p.maxHealth, 0, 1);
  const staminaRatio = clamp(p.stamina / p.maxStamina, 0, 1);

  ctx.fillStyle = "#d8f1ff";
  ctx.font = "bold 13px Trebuchet MS";
  ctx.fillText("VIE", panelX + 10, panelY + 20);
  ctx.fillText("TOILE", panelX + 10, panelY + 46);
  ctx.fillText(`Score: ${state.score}`, panelX + 10, panelY + 68);

  ctx.fillStyle = "#00000066";
  ctx.fillRect(panelX + 70, panelY + 11, panelW - 92, 12);
  ctx.fillRect(panelX + 70, panelY + 37, panelW - 92, 12);

  ctx.fillStyle = "#ff4b70";
  ctx.fillRect(panelX + 70, panelY + 11, (panelW - 92) * hpRatio, 12);
  ctx.fillStyle = "#1da8ff";
  ctx.fillRect(panelX + 70, panelY + 37, (panelW - 92) * staminaRatio, 12);

  const remaining = state.enemies.filter((e) => e.hp > 0).length + ((state.boss && state.boss.hp > 0) ? 1 : 0);
  ctx.fillStyle = "#cce8ff";
  ctx.fillText(`Ennemis: ${remaining}`, panelX + panelW - 120, panelY + 68);

  if (state.boss && state.boss.hp > 0 && state.player.x > 5200) {
    const b = state.boss;
    const ratio = clamp(b.hp / b.maxHp, 0, 1);
    const bw = Math.min(520, state.width - 60);
    const bx = (state.width - bw) * 0.5;
    const by = 18;

    ctx.fillStyle = "#0000009c";
    ctx.fillRect(bx, by, bw, 16);
    ctx.fillStyle = "#ff3a66";
    ctx.fillRect(bx, by, bw * ratio, 16);
    ctx.strokeStyle = "#ffc2d0";
    ctx.strokeRect(bx, by, bw, 16);

    ctx.fillStyle = "#ffe7ef";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillText("Chef du gang", bx + 8, by - 4);
  }

  if (state.msg) {
    ctx.fillStyle = "#00000077";
    ctx.fillRect(12, state.height - 44, Math.min(560, state.width - 24), 30);
    ctx.fillStyle = "#e8f5ff";
    ctx.font = "13px Trebuchet MS";
    ctx.fillText(state.msg, 20, state.height - 24);
  }
}

function drawObjectiveHints() {
  const p = state.player;
  const x = p.x;

  ctx.fillStyle = "#9fd8ff";
  ctx.font = "bold 14px Trebuchet MS";

  if (x < 560) {
    ctx.fillText("Tutoriel: clic gauche = toile mobilite, clic droit = toile capture", 20, 130);
  } else if (x < 2100) {
    ctx.fillText("Astuce: vise les points rouges pour te balancer plus haut", 20, 130);
  } else if (x < 4900) {
    ctx.fillText("Les tireurs sont vulnerables apres 3 impacts toile", 20, 130);
  } else if (!state.victory) {
    ctx.fillText("Zone finale: neutralise le chef puis avance a la sortie", 20, 130);
  }
}

function render() {
  drawCityBackground();
  drawWorld();

  for (const enemy of state.enemies) {
    drawEnemy(enemy);
  }
  if (state.boss && state.boss.hp > 0) {
    drawEnemy(state.boss);
  }

  drawPlayer();
  drawShots();
  drawObjectiveHints();
}

let lastTs = 0;

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = clamp((ts - lastTs) / 1000, 0, 0.033);
  lastTs = ts;

  update(dt);
  render();

  requestAnimationFrame(frame);
}

function toggleFullscreen() {
  const root = document.documentElement;
  if (!document.fullscreenElement) {
    root.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

startBtn.addEventListener("click", () => {
  resetGame(120);
  state.running = true;
  setMessage("Atteins le chantier final et bats le chef du gang.");
  overlay.classList.remove("show");
});

restartBtn.addEventListener("click", () => {
  resetGame(state.currentCheckpoint);
  state.running = true;
  overlay.classList.remove("show");
});

fullscreenBtn.addEventListener("click", toggleFullscreen);

window.addEventListener("resize", () => {
  resizeCanvas();
  if (state.player) {
    state.player.y = Math.min(state.player.y, state.world.floorY - state.player.h - 1);
  }
  buildLevel();
});

resizeCanvas();
ensureMobileHud();
resetGame(120);
state.running = true;
setMessage("Demarre la mission.");
requestAnimationFrame(frame);
