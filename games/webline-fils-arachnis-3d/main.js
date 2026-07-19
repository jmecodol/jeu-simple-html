import * as THREE from "https://unpkg.com/three@0.166.1/build/three.module.js";

const canvas = document.getElementById("gameCanvas");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const latestBtn = document.getElementById("latestBtn");

const moveZone = document.getElementById("moveZone");
const moveStick = document.getElementById("moveStick");
const moveKnob = document.getElementById("moveKnob");
const actionZone = document.getElementById("actionZone");
const actionBtn = document.getElementById("actionBtn");

const MOBILE = {
  active: window.matchMedia("(hover: none), (pointer: coarse)").matches,
  movePointerId: null,
  moveCenterX: 0,
  moveCenterY: 0,
  moveLastX: 0,
  moveLastY: 0,
  stickX: 0,
  stickY: 0,
  actionPointerId: null,
  actionStartX: 0,
  actionStartY: 0,
  actionLastX: 0,
  actionLastY: 0,
  jumpQueued: false,
  shootQueued: false,
  crawlQueuedDir: 0,
  preview: {
    active: false,
    mode: "",
    color: 0xd7f0ff,
    start: new THREE.Vector3(),
    target: new THREE.Vector3(),
  },
};

const DESKTOP_ACTION = {
  pointerId: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
};

const CONFIG = {
  gravity: 32,
  moveAccel: 48,
  maxWalkSpeed: 5.7,
  maxRunSpeed: 9.8,
  autoRunDelay: 2,
  jumpVelocity: 13.2,
  powerDoubleJumpMul: 1.35,
  hookAngleDeg: 30,
  swipeEnemyAngleDeg: 24,
  swipeEnemyRange: 20,
  swipeEnemyNear: 4.4,
  hookRange: 16,
  hookMomentumThreshold: 7.8,
};

const state = {
  running: true,
  width: 0,
  height: 0,
  dpr: 1,
  world: {
    minX: -5,
    maxX: 95,
    floorY: 0,
    topY: 58,
  },
  cameraX: 0,
  cameraY: 0,
  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    shoot: false,
    action: false,
    crawl: false,
    melee: false,
    dodge: false,
  },
  player: null,
  walls: [],
  anchors: [],
  enemies: [],
  boss: null,
  webBolts: [],
  enemyBolts: [],
  sparks: [],
  lastTs: 0,
  message: "",
};

const three = {
  renderer: null,
  scene: null,
  camera: null,
  floor: null,
  wallGroup: null,
  hookGroup: null,
  enemyGroup: null,
  fxGroup: null,
  player: null,
  webLine: null,
  previewLine: null,
  previewDot: null,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function signOrFacing(value, facing) {
  if (Math.abs(value) < 0.0001) return facing;
  return value > 0 ? 1 : -1;
}

function vec2AngleDeg(ax, ay, bx, by) {
  const magA = Math.hypot(ax, ay) || 1;
  const magB = Math.hypot(bx, by) || 1;
  const dot = clamp((ax / magA) * (bx / magB) + (ay / magA) * (by / magB), -1, 1);
  return (Math.acos(dot) * 180) / Math.PI;
}

function initThree() {
  three.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  three.renderer.outputColorSpace = THREE.SRGBColorSpace;
  three.renderer.shadowMap.enabled = false;

  three.scene = new THREE.Scene();
  three.scene.background = new THREE.Color(0x06101d);
  three.scene.fog = new THREE.Fog(0x06101d, 28, 92);

  three.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300);
  three.camera.position.set(0, 7, 18);

  const hemi = new THREE.HemisphereLight(0x7cb8ff, 0x1a2330, 0.88);
  const dir = new THREE.DirectionalLight(0x88c0ff, 1.05);
  dir.position.set(16, 24, 12);
  three.scene.add(hemi, dir);

  const cityGlow = new THREE.Mesh(
    new THREE.SphereGeometry(160, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0x0a1e33, side: THREE.BackSide })
  );
  three.scene.add(cityGlow);

  three.wallGroup = new THREE.Group();
  three.hookGroup = new THREE.Group();
  three.enemyGroup = new THREE.Group();
  three.fxGroup = new THREE.Group();

  three.scene.add(three.wallGroup, three.hookGroup, three.enemyGroup, three.fxGroup);

  const floorGeo = new THREE.BoxGeometry(200, 1.2, 12);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x12263d, roughness: 0.88, metalness: 0.03 });
  three.floor = new THREE.Mesh(floorGeo, floorMat);
  three.floor.position.set(44, state.world.floorY - 0.6, 0);
  three.scene.add(three.floor);

  const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  three.webLine = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xe5f5ff }));
  three.webLine.visible = false;
  three.scene.add(three.webLine);

  const previewGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  three.previewLine = new THREE.Line(previewGeom, new THREE.LineDashedMaterial({ color: 0xd7f0ff, dashSize: 0.4, gapSize: 0.26 }));
  three.previewLine.visible = false;
  three.scene.add(three.previewLine);

  three.previewDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xd7f0ff })
  );
  three.previewDot.visible = false;
  three.scene.add(three.previewDot);

  const playerGeo = new THREE.CapsuleGeometry(0.42, 1.0, 5, 10);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x1a2431, roughness: 0.55, metalness: 0.1 });
  three.player = new THREE.Mesh(playerGeo, playerMat);
  three.scene.add(three.player);
}

function buildWorld() {
  state.walls = [];
  state.anchors = [];
  three.wallGroup.clear();
  three.hookGroup.clear();

  const wallDefs = [
    { x: 10, y: 5, w: 1.2, h: 10 },
    { x: 20, y: 10, w: 1.2, h: 16 },
    { x: 30, y: 15, w: 1.2, h: 20 },
    { x: 40, y: 20, w: 1.2, h: 23 },
    { x: 50, y: 26, w: 1.2, h: 24 },
    { x: 61, y: 31, w: 1.2, h: 22 },
    { x: 73, y: 35, w: 1.2, h: 20 },
    { x: 84, y: 39, w: 1.2, h: 18 },
  ];

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1d334c, roughness: 0.82, metalness: 0.07 });
  const hookMat = new THREE.MeshBasicMaterial({ color: 0xff557e });

  for (const def of wallDefs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, 5.5), wallMat);
    mesh.position.set(def.x, def.y, 0);
    three.wallGroup.add(mesh);

    const wall = {
      minX: def.x - def.w * 0.5,
      maxX: def.x + def.w * 0.5,
      minY: def.y - def.h * 0.5,
      maxY: def.y + def.h * 0.5,
      mesh,
    };
    state.walls.push(wall);

    for (let y = wall.minY + 1.2; y <= wall.maxY - 1.2; y += 3.6) {
      const left = { x: wall.minX - 0.6, y, z: 0 };
      const right = { x: wall.maxX + 0.6, y, z: 0 };
      state.anchors.push(left, right);
    }

    state.anchors.push({ x: def.x, y: wall.maxY - 0.6, z: 0 });
  }

  for (const anchor of state.anchors) {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.08, 8, 14), hookMat);
    hook.position.set(anchor.x, anchor.y, anchor.z + 0.2);
    hook.rotation.x = Math.PI * 0.5;
    three.hookGroup.add(hook);
  }
}

function spawnPlayer() {
  state.player = {
    x: 2,
    y: 1.1,
    z: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    radius: 0.42,
    halfHeight: 0.95,
    onGround: false,
    jumpsLeft: 1,
    jumpGrace: 0,
    jumpBuffer: 0,
    crawlTimer: 0,
    crawlDir: 0,
    walkRunTimer: 0,
    lastWalkDir: 0,
    health: 100,
    stamina: 100,
    maxStamina: 100,
    invuln: 0,
    webAttached: false,
    webAnchor: null,
    webLen: 0,
    webCd: 0,
    trapCd: 0,
  };
}

function makeEnemy(type, x, y) {
  const base = {
    type,
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    w: type === "boss" ? 1.4 : 1,
    h: type === "boss" ? 2.6 : 1.8,
    hp: type === "boss" ? 260 : 1,
    dead: false,
    patrolA: x - 2.4,
    patrolB: x + 2.4,
    dir: -1,
    shootTimer: 0.8 + Math.random() * 1.2,
    mesh: null,
  };

  const color = type === "boss" ? 0x9d213f : type === "rifle" ? 0x77273a : 0x7e3a2f;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(base.w, base.h, 0.9),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.08 })
  );
  mesh.position.set(x, y, 0);
  three.enemyGroup.add(mesh);
  base.mesh = mesh;
  return base;
}

function spawnEnemies() {
  state.enemies = [
    makeEnemy("melee", 8, 1),
    makeEnemy("rifle", 16, 1),
    makeEnemy("melee", 24, 1),
    makeEnemy("rifle", 34, 1),
    makeEnemy("melee", 45, 1),
    makeEnemy("rifle", 57, 1),
    makeEnemy("melee", 69, 1),
    makeEnemy("rifle", 80, 1),
  ];
  state.boss = makeEnemy("boss", 90, 1.3);
}

function setMessage(msg) {
  state.message = msg;
}

function resetGame() {
  three.enemyGroup.clear();
  three.fxGroup.clear();
  state.webBolts = [];
  state.enemyBolts = [];
  state.sparks = [];
  buildWorld();
  spawnPlayer();
  spawnEnemies();
  state.running = true;
  overlay.classList.remove("show");
  setMessage("Mission active");
}

function isAlive(enemy) {
  return enemy && !enemy.dead && enemy.hp > 0;
}

function enemyCenter(enemy) {
  return new THREE.Vector2(enemy.x, enemy.y + enemy.h * 0.35);
}

function playerCenter() {
  const p = state.player;
  return new THREE.Vector2(p.x, p.y + p.halfHeight * 0.35);
}

function hitEnemy(enemy, pushDir = 0) {
  if (!isAlive(enemy)) return;
  if (enemy.type !== "boss") {
    enemy.hp = 0;
    enemy.dead = true;
    enemy.vx += pushDir * 2;
    if (enemy.mesh) {
      three.enemyGroup.remove(enemy.mesh);
      enemy.mesh.geometry.dispose();
      enemy.mesh.material.dispose();
    }
    return;
  }

  enemy.hp -= 30;
  enemy.vx += pushDir * 1.8;
  if (enemy.hp <= 0) {
    enemy.dead = true;
    if (enemy.mesh) {
      three.enemyGroup.remove(enemy.mesh);
      enemy.mesh.geometry.dispose();
      enemy.mesh.material.dispose();
    }
    showOverlay("Victoire", "Tu as neutralise le chef du gang.");
    state.running = false;
  }
}

function getSwipeEnemyTarget(dx, dy, maxRange = CONFIG.swipeEnemyRange, angleDeg = CONFIG.swipeEnemyAngleDeg) {
  const p2 = playerCenter();
  const mag = Math.hypot(dx, dy);
  if (mag < 0.01) return null;

  const sx = dx / mag;
  const sy = dy / mag;
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;

  const pool = [...state.enemies, state.boss].filter((e) => isAlive(e));
  for (const enemy of pool) {
    const c = enemyCenter(enemy);
    const ex = c.x - p2.x;
    const ey = c.y - p2.y;
    const d = Math.hypot(ex, ey);
    if (d < 0.4 || d > maxRange) continue;

    const angle = vec2AngleDeg(sx, sy, ex, ey);
    if (angle <= angleDeg && d < bestDist) {
      best = enemy;
      bestDist = d;
    }
  }
  return best;
}

function findSwipeHookTarget(dx, dy, angleDeg = CONFIG.hookAngleDeg, requireDifferent = false) {
  const p = state.player;
  const p2 = playerCenter();
  const mag = Math.hypot(dx, dy);
  if (mag < 0.01) return null;

  const sx = dx / mag;
  const sy = dy / mag;
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const anchor of state.anchors) {
    if (
      requireDifferent &&
      p.webAnchor &&
      Math.hypot(anchor.x - p.webAnchor.x, anchor.y - p.webAnchor.y) < 0.2
    ) {
      continue;
    }

    const ax = anchor.x - p2.x;
    const ay = anchor.y - (p.y + p.halfHeight * 0.1);
    const d = Math.hypot(ax, ay);
    if (d < 0.6 || d > CONFIG.hookRange) continue;

    const angle = vec2AngleDeg(sx, sy, ax, ay);
    if (angle <= angleDeg && d < bestDist) {
      best = anchor;
      bestDist = d;
    }
  }

  return best;
}

function attachHook(anchor) {
  const p = state.player;
  if (!anchor || p.stamina < 8 || p.webCd > 0) return false;

  const px = p.x;
  const py = p.y + p.halfHeight * 0.1;
  const d = Math.hypot(anchor.x - px, anchor.y - py);
  if (d > CONFIG.hookRange) return false;

  p.webAttached = true;
  p.webAnchor = { x: anchor.x, y: anchor.y, z: anchor.z || 0 };
  p.webLen = clamp(d * 0.9, 1.4, 14);
  p.webCd = 0.08;
  p.stamina = Math.max(0, p.stamina - 8);
  return true;
}

function tryAttachFromSwipe(dx, dy) {
  const p = state.player;
  if (p.webAttached) return false;
  const hook = findSwipeHookTarget(dx, dy, CONFIG.hookAngleDeg, false);
  return attachHook(hook);
}

function tryRetargetFromSwipe(dx, dy) {
  const p = state.player;
  if (!p.webAttached) return false;
  const hook = findSwipeHookTarget(dx, dy, CONFIG.hookAngleDeg, true);
  if (!hook) return false;
  return attachHook(hook);
}

function triggerPowerDoubleJump(dx, dy) {
  const p = state.player;
  const mag = Math.hypot(dx, dy);
  const nx = mag > 0 ? dx / mag : p.facing;
  const ny = mag > 0 ? dy / mag : -1;

  p.webAttached = false;
  p.webAnchor = null;
  p.webLen = 0;
  p.vx = nx * 9.8;
  p.vy = Math.min(-1.8, ny * 3) + CONFIG.jumpVelocity * CONFIG.powerDoubleJumpMul;
  p.onGround = false;
  p.jumpsLeft = 0;
}

function fireRapidShot() {
  const p = state.player;
  if (p.trapCd > 0 || p.stamina < 6) return;

  const dir = p.facing >= 0 ? 1 : -1;
  p.trapCd = 0.08;
  p.stamina = Math.max(0, p.stamina - 6);

  const target = getSwipeEnemyTarget(dir, 0, 18, 15);
  if (target) {
    hitEnemy(target, dir);
  }

  state.webBolts.push({
    x: p.x,
    y: p.y + p.halfHeight * 0.4,
    vx: dir * 28,
    vy: 0,
    life: 0.26,
  });
}

function executeSwipeEnemyAction(dx, dy) {
  const p = state.player;
  const target = getSwipeEnemyTarget(dx, dy);
  if (!target) return false;

  const pc = playerCenter();
  const ec = enemyCenter(target);
  const d = pc.distanceTo(ec);
  const dir = signOrFacing(ec.x - pc.x, p.facing);
  p.facing = dir;

  if (d > CONFIG.swipeEnemyNear) {
    state.webBolts.push({
      x: p.x,
      y: p.y + p.halfHeight * 0.4,
      vx: (ec.x - pc.x) * 3.2,
      vy: (ec.y - pc.y) * 3.2,
      life: 0.22,
    });
    hitEnemy(target, dir);
    return true;
  }

  target.x = p.x + dir * 1.2;
  target.y = p.y;
  hitEnemy(target, dir);
  p.vx -= dir * 1.1;
  return true;
}

function triggerCrawl(dir) {
  const p = state.player;
  p.crawlDir = dir === 0 ? p.facing : Math.sign(dir);
  p.crawlTimer = 0.42;
  p.vx = p.crawlDir * 1.8;
}

function tryJumpInput() {
  const p = state.player;
  p.jumpBuffer = 0.14;
}

function updateActionPreview(dx, dy) {
  const p = state.player;
  if (!p) return;

  const prev = MOBILE.preview;
  const pc = playerCenter();
  prev.start.set(pc.x, pc.y, 0.4);

  const swipeLen = Math.hypot(dx, dy);
  const nx = swipeLen > 0 ? dx / swipeLen : p.facing;
  const ny = swipeLen > 0 ? dy / swipeLen : 0;
  prev.active = true;

  if (swipeLen < 16) {
    prev.mode = "shot";
    prev.target.set(pc.x + p.facing * 7, pc.y, 0.4);
    prev.color = 0xd7f0ff;
    return;
  }

  if (p.webAttached) {
    const hook = findSwipeHookTarget(dx, dy, CONFIG.hookAngleDeg, true);
    if (hook) {
      prev.mode = "retarget";
      prev.target.set(hook.x, hook.y, 0.4);
      prev.color = 0x7be8ff;
      return;
    }
    prev.mode = "doublejump";
    prev.target.set(pc.x + nx * 6, pc.y + ny * 6, 0.4);
    prev.color = 0xffd180;
    return;
  }

  const enemy = getSwipeEnemyTarget(dx, dy);
  if (enemy) {
    const ec = enemyCenter(enemy);
    const d = pc.distanceTo(ec);
    prev.mode = d > CONFIG.swipeEnemyNear ? "filin-kill" : "pull-finish";
    prev.target.set(ec.x, ec.y, 0.4);
    prev.color = d > CONFIG.swipeEnemyNear ? 0xff9cab : 0xff6d8a;
    return;
  }

  const hook = findSwipeHookTarget(dx, dy, CONFIG.hookAngleDeg, false);
  if (hook) {
    prev.mode = "attach";
    prev.target.set(hook.x, hook.y, 0.4);
    prev.color = 0x8de8ff;
    return;
  }

  if (ny < -0.6) {
    prev.mode = "jump";
    prev.target.set(pc.x, pc.y + 7, 0.4);
    prev.color = 0xb8e986;
    return;
  }

  if (ny > 0.6) {
    prev.mode = "crawl";
    prev.target.set(pc.x + nx * 4, pc.y - 1.3, 0.4);
    prev.color = 0xf8c471;
    return;
  }

  prev.mode = "neutral";
  prev.target.set(pc.x + nx * 4, pc.y + ny * 4, 0.4);
  prev.color = 0xd7f0ff;
}

function executeRightSwipe(dx, dy, swipeLen) {
  const p = state.player;

  if (swipeLen < 16) {
    MOBILE.shootQueued = true;
    return;
  }

  if (p.webAttached) {
    if (!tryRetargetFromSwipe(dx, dy)) {
      triggerPowerDoubleJump(dx, dy);
    }
    return;
  }

  if (executeSwipeEnemyAction(dx, dy)) return;
  if (tryAttachFromSwipe(dx, dy)) return;

  if (dy < -Math.abs(dx) * 0.6) {
    MOBILE.jumpQueued = true;
  } else if (dy > Math.abs(dx) * 0.6) {
    MOBILE.crawlQueuedDir = dx === 0 ? p.facing : Math.sign(dx);
  }
}

function executeForwardAction() {
  const p = state.player;

  if (p.webAttached) {
    if (!tryRetargetFromSwipe(p.facing, -0.4)) {
      triggerPowerDoubleJump(p.facing, -1);
    }
    return;
  }

  if (executeSwipeEnemyAction(p.facing, 0)) return;
  if (tryAttachFromSwipe(p.facing, -0.35)) return;
  fireRapidShot();
}

function setupInput() {
  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyA" || event.code === "KeyQ" || event.code === "ArrowLeft") state.keys.left = true;
    if (event.code === "KeyD" || event.code === "ArrowRight") state.keys.right = true;
    if (event.code === "Space" || event.code === "KeyW" || event.code === "KeyZ" || event.code === "ArrowUp") {
      state.keys.jump = true;
    }
    if (event.code === "KeyF" || event.code === "Enter") state.keys.shoot = true;
    if (event.code === "KeyE") state.keys.action = true;
    if (event.code === "KeyS" || event.code === "ArrowDown") state.keys.crawl = true;
    if (event.code === "KeyR") resetGame();
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyA" || event.code === "KeyQ" || event.code === "ArrowLeft") state.keys.left = false;
    if (event.code === "KeyD" || event.code === "ArrowRight") state.keys.right = false;
    if (event.code === "Space" || event.code === "KeyW" || event.code === "KeyZ" || event.code === "ArrowUp") {
      state.keys.jump = false;
    }
    if (event.code === "KeyF" || event.code === "Enter") state.keys.shoot = false;
    if (event.code === "KeyE") state.keys.action = false;
    if (event.code === "KeyS" || event.code === "ArrowDown") state.keys.crawl = false;
  });

  const getStickAnchor = () => {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + 22 + 68, y: rect.top + rect.height - 18 - 68 };
  };

  const updateStick = (clientX, clientY, reset = false) => {
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
    moveKnob.style.left = `${40 + dx}px`;
    moveKnob.style.top = `${40 + dy}px`;
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

    const rect = canvas.getBoundingClientRect();
    const localX = anchor.x - rect.left;
    const localY = anchor.y - rect.top;
    moveStick.style.left = `${localX - 68}px`;
    moveStick.style.top = `${localY - 68}px`;
    moveStick.style.right = "auto";
    moveStick.style.bottom = "auto";

    updateStick(event.clientX, event.clientY);
    moveZone.setPointerCapture(event.pointerId);
  });

  moveZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== MOBILE.movePointerId) return;
    event.preventDefault();
    MOBILE.moveLastX = event.clientX;
    MOBILE.moveLastY = event.clientY;
    updateStick(event.clientX, event.clientY);
  });

  const resetMove = (event) => {
    if (event.pointerId !== MOBILE.movePointerId) return;
    MOBILE.movePointerId = null;
    updateStick(MOBILE.moveLastX, MOBILE.moveLastY, true);
    moveStick.style.left = `calc(22px + env(safe-area-inset-left))`;
    moveStick.style.top = "auto";
    moveStick.style.right = "auto";
    moveStick.style.bottom = `calc(18px + env(safe-area-inset-bottom))`;
  };

  moveZone.addEventListener("pointerup", resetMove);
  moveZone.addEventListener("pointercancel", resetMove);

  actionZone.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (MOBILE.actionPointerId !== null) return;
    MOBILE.actionPointerId = event.pointerId;
    MOBILE.actionStartX = event.clientX;
    MOBILE.actionStartY = event.clientY;
    MOBILE.actionLastX = event.clientX;
    MOBILE.actionLastY = event.clientY;
    MOBILE.preview.active = true;
    updateActionPreview(0, 0);
    actionZone.setPointerCapture(event.pointerId);
  });

  actionZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== MOBILE.actionPointerId) return;
    event.preventDefault();
    MOBILE.actionLastX = event.clientX;
    MOBILE.actionLastY = event.clientY;
    updateActionPreview(MOBILE.actionLastX - MOBILE.actionStartX, MOBILE.actionLastY - MOBILE.actionStartY);
  });

  const releaseAction = (event) => {
    if (event.pointerId !== MOBILE.actionPointerId) return;
    const dx = MOBILE.actionLastX - MOBILE.actionStartX;
    const dy = MOBILE.actionLastY - MOBILE.actionStartY;
    const swipeLen = Math.hypot(dx, dy);
    executeRightSwipe(dx, dy, swipeLen);
    MOBILE.preview.active = false;
    MOBILE.actionPointerId = null;
  };

  actionZone.addEventListener("pointerup", releaseAction);
  actionZone.addEventListener("pointercancel", releaseAction);

  actionBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (MOBILE.active) return;
    if (event.button !== 0) return;
    DESKTOP_ACTION.pointerId = event.pointerId;
    DESKTOP_ACTION.startX = event.clientX;
    DESKTOP_ACTION.startY = event.clientY;
    DESKTOP_ACTION.lastX = event.clientX;
    DESKTOP_ACTION.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (MOBILE.active) return;
    if (event.pointerId !== DESKTOP_ACTION.pointerId) return;
    DESKTOP_ACTION.lastX = event.clientX;
    DESKTOP_ACTION.lastY = event.clientY;
  });

  const releaseDesktopAction = (event) => {
    if (MOBILE.active) return;
    if (event.pointerId !== DESKTOP_ACTION.pointerId) return;
    const dx = DESKTOP_ACTION.lastX - DESKTOP_ACTION.startX;
    const dy = DESKTOP_ACTION.lastY - DESKTOP_ACTION.startY;
    const swipeLen = Math.hypot(dx, dy);
    executeRightSwipe(dx, dy, swipeLen);
    DESKTOP_ACTION.pointerId = null;
  };

  canvas.addEventListener("pointerup", releaseDesktopAction);
  canvas.addEventListener("pointercancel", releaseDesktopAction);
}

function resolveWorldCollisions() {
  const p = state.player;
  p.onGround = false;

  const floorHitY = state.world.floorY + p.halfHeight;
  if (p.y <= floorHitY) {
    p.y = floorHitY;
    if (p.vy < 0) p.vy = 0;
    p.onGround = true;
  }

  if (p.webAttached) return;

  const playerMinX = p.x - p.radius;
  const playerMaxX = p.x + p.radius;
  const playerMinY = p.y - p.halfHeight;
  const playerMaxY = p.y + p.halfHeight;

  for (const wall of state.walls) {
    const overlapX = playerMaxX > wall.minX && playerMinX < wall.maxX;
    const overlapY = playerMaxY > wall.minY && playerMinY < wall.maxY;
    if (!overlapX || !overlapY) continue;

    const leftPen = wall.maxX - playerMinX;
    const rightPen = playerMaxX - wall.minX;
    const downPen = wall.maxY - playerMinY;
    const upPen = playerMaxY - wall.minY;

    const minXPen = Math.min(leftPen, rightPen);
    const minYPen = Math.min(downPen, upPen);

    if (minXPen < minYPen) {
      if (leftPen < rightPen) {
        p.x = wall.maxX + p.radius;
      } else {
        p.x = wall.minX - p.radius;
      }
      p.vx *= -0.08;
    } else {
      if (downPen < upPen) {
        p.y = wall.maxY + p.halfHeight;
        if (p.vy < 0) p.vy = 0;
      } else {
        p.y = wall.minY - p.halfHeight;
        if (p.vy > 0) p.vy = 0;
      }
    }
  }
}

function updatePlayer(dt) {
  const p = state.player;

  p.webCd = Math.max(0, p.webCd - dt);
  p.trapCd = Math.max(0, p.trapCd - dt);
  p.crawlTimer = Math.max(0, p.crawlTimer - dt);
  p.jumpGrace = p.onGround ? 0.11 : Math.max(0, p.jumpGrace - dt);
  p.stamina = p.webAttached ? Math.max(0, p.stamina - dt * 8.5) : Math.min(p.maxStamina, p.stamina + dt * 10.5);

  const moveThreshold = p.webAttached ? 0.24 : 0.4;
  let moveLeft = state.keys.left;
  let moveRight = state.keys.right;
  let moveUp = false;
  let moveDown = false;

  if (MOBILE.active) {
    moveLeft = MOBILE.stickX < -moveThreshold;
    moveRight = MOBILE.stickX > moveThreshold;
    if (p.webAttached) {
      moveUp = MOBILE.stickY < -0.24;
      moveDown = MOBILE.stickY > 0.24;
    }
  }

  let move = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

  if (!p.webAttached && p.crawlTimer <= 0 && p.onGround && move !== 0) {
    const md = Math.sign(move);
    if (p.lastWalkDir !== 0 && md !== p.lastWalkDir) p.walkRunTimer = 0;
    p.lastWalkDir = md;
    p.walkRunTimer = Math.min(CONFIG.autoRunDelay + 1.5, p.walkRunTimer + dt);
  } else {
    p.walkRunTimer = Math.max(0, p.walkRunTimer - dt * 2);
    if (move === 0) p.lastWalkDir = 0;
  }

  let accel = CONFIG.moveAccel;
  let maxSpeed = CONFIG.maxWalkSpeed;

  if (p.walkRunTimer >= CONFIG.autoRunDelay && p.crawlTimer <= 0) {
    maxSpeed = CONFIG.maxRunSpeed;
    accel = 74;
  }

  if (p.crawlTimer > 0) {
    maxSpeed = 2.2;
    accel = 24;
    move = p.crawlDir || move;
    p.walkRunTimer = 0;
  }

  if (move !== 0) {
    p.facing = Math.sign(move);
    p.vx += move * accel * dt;
  } else {
    p.vx = lerp(p.vx, 0, clamp(dt * 8, 0, 1));
  }

  p.vx = clamp(p.vx, -maxSpeed, maxSpeed);

  if (MOBILE.jumpQueued || state.keys.jump) {
    tryJumpInput();
    MOBILE.jumpQueued = false;
    state.keys.jump = false;
  }

  if (MOBILE.shootQueued) {
    fireRapidShot();
    MOBILE.shootQueued = false;
  }

  if (state.keys.shoot) {
    fireRapidShot();
  }

  if (state.keys.action) {
    executeForwardAction();
    state.keys.action = false;
  }

  if (MOBILE.crawlQueuedDir !== 0) {
    triggerCrawl(MOBILE.crawlQueuedDir);
    MOBILE.crawlQueuedDir = 0;
  }

  if (state.keys.crawl) {
    triggerCrawl(p.facing);
    state.keys.crawl = false;
  }

  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (p.jumpBuffer > 0) {
    const canGround = p.onGround || p.jumpGrace > 0;
    if (canGround || p.jumpsLeft > 0) {
      p.jumpBuffer = 0;
      p.webAttached = false;
      p.webAnchor = null;
      p.vy = CONFIG.jumpVelocity;
      p.onGround = false;
      if (!canGround) p.jumpsLeft = Math.max(0, p.jumpsLeft - 1);
    }
  }

  if (p.webAttached && p.webAnchor) {
    p.vy -= CONFIG.gravity * dt;

    const inputX = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
    const inputY = (moveDown ? 1 : 0) - (moveUp ? 1 : 0);
    if (inputX !== 0 || inputY !== 0) {
      p.vx += inputX * 22 * dt;
      p.vy += inputY * 20 * dt;
    }

    if (moveUp) p.webLen = Math.max(1, p.webLen - 6.4 * dt);
    if (moveDown) p.webLen = Math.min(20, p.webLen + 6.4 * dt);

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const dx = p.x - p.webAnchor.x;
    const dy = (p.y + p.halfHeight * 0.2) - p.webAnchor.y;
    const len = Math.hypot(dx, dy) || 1;

    if (len > p.webLen) {
      const nx = dx / len;
      const ny = dy / len;
      const targetX = p.webAnchor.x + nx * p.webLen;
      const targetY = p.webAnchor.y + ny * p.webLen;

      p.x = targetX;
      p.y = targetY - p.halfHeight * 0.2;

      const radial = p.vx * nx + p.vy * ny;
      if (radial > 0) {
        p.vx -= radial * nx;
        p.vy -= radial * ny;
      }
    }

    const bodyY = p.y + p.halfHeight * 0.2;
    const capY = p.webAnchor.y - 0.15;
    if (bodyY > capY && Math.abs(p.vx) < CONFIG.hookMomentumThreshold) {
      p.y = capY - p.halfHeight * 0.2;
      if (p.vy > 0) p.vy = 0;
    }

    if (p.stamina <= 0) {
      p.webAttached = false;
      p.webAnchor = null;
    }
  } else {
    p.vy -= CONFIG.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  resolveWorldCollisions();

  p.x = clamp(p.x, state.world.minX, state.world.maxX);
  if (p.y < -18) {
    p.x = 2;
    p.y = state.world.floorY + p.halfHeight;
    p.vx = 0;
    p.vy = 0;
    p.webAttached = false;
    p.webAnchor = null;
  }

  if (p.y > state.world.topY) {
    p.y = state.world.topY;
    if (p.vy > 0) p.vy = 0;
  }

  if (p.onGround) p.jumpsLeft = 1;
}

function updateEnemies(dt) {
  const p = state.player;
  const pool = [...state.enemies, state.boss].filter((e) => isAlive(e));

  for (const enemy of pool) {
    if (enemy.type === "boss") {
      enemy.vx = Math.sin(performance.now() * 0.0018) * 1.2;
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = 1.6;
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const mag = Math.hypot(dx, dy) || 1;
        state.enemyBolts.push({
          x: enemy.x,
          y: enemy.y + enemy.h * 0.3,
          vx: (dx / mag) * 12,
          vy: (dy / mag) * 12,
          life: 2.2,
          damage: 8,
        });
      }
    } else if (enemy.type === "rifle") {
      enemy.shootTimer -= dt;
      enemy.vx = lerp(enemy.vx, 0, clamp(dt * 3.5, 0, 1));
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = 1.8 + Math.random() * 0.9;
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const mag = Math.hypot(dx, dy) || 1;
        state.enemyBolts.push({
          x: enemy.x,
          y: enemy.y + enemy.h * 0.3,
          vx: (dx / mag) * 10,
          vy: (dy / mag) * 10,
          life: 2,
          damage: 7,
        });
      }
    } else {
      if (enemy.x <= enemy.patrolA) enemy.dir = 1;
      if (enemy.x >= enemy.patrolB) enemy.dir = -1;
      enemy.vx = lerp(enemy.vx, enemy.dir * 1.4, clamp(dt * 2.8, 0, 1));
    }

    enemy.vy -= CONFIG.gravity * dt;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    const minY = state.world.floorY + enemy.h * 0.5;
    if (enemy.y < minY) {
      enemy.y = minY;
      enemy.vy = 0;
    }

    if (enemy.mesh) {
      enemy.mesh.position.set(enemy.x, enemy.y, 0);
    }
  }

  state.enemies = state.enemies.filter((e) => isAlive(e));
}

function updateProjectiles(dt) {
  const p = state.player;

  for (const bolt of state.webBolts) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
  }
  state.webBolts = state.webBolts.filter((b) => b.life > 0);

  for (const shot of state.enemyBolts) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;

    const pxMin = p.x - p.radius;
    const pxMax = p.x + p.radius;
    const pyMin = p.y - p.halfHeight;
    const pyMax = p.y + p.halfHeight;

    if (shot.x >= pxMin && shot.x <= pxMax && shot.y >= pyMin && shot.y <= pyMax) {
      shot.life = 0;
      p.invuln = 0.2;
      setMessage("Impact ignore (vies infinies)");
    }
  }
  state.enemyBolts = state.enemyBolts.filter((s) => s.life > 0);
}

function updateCamera(dt) {
  const p = state.player;
  const targetX = p.x + 1.5;
  const targetY = p.y + 6.8;

  state.cameraX = lerp(state.cameraX, targetX, clamp(dt * 3.6, 0, 1));
  state.cameraY = lerp(state.cameraY, clamp(targetY, 6.2, state.world.topY + 8), clamp(dt * 4, 0, 1));

  three.camera.position.set(state.cameraX - 5.6, state.cameraY, 18);
  three.camera.lookAt(state.cameraX + 2.4, state.cameraY - 2.9, 0);
}

function updateWebLineVisual() {
  const p = state.player;
  if (!p.webAttached || !p.webAnchor) {
    three.webLine.visible = false;
    return;
  }
  const start = new THREE.Vector3(p.x, p.y + p.halfHeight * 0.25, 0.3);
  const end = new THREE.Vector3(p.webAnchor.x, p.webAnchor.y, 0.3);
  three.webLine.geometry.setFromPoints([start, end]);
  three.webLine.visible = true;
}

function updatePreviewVisual() {
  if (!MOBILE.active || !MOBILE.preview.active || MOBILE.actionPointerId === null) {
    three.previewLine.visible = false;
    three.previewDot.visible = false;
    return;
  }

  three.previewLine.geometry.setFromPoints([MOBILE.preview.start, MOBILE.preview.target]);
  three.previewLine.material.color.setHex(MOBILE.preview.color);
  three.previewLine.computeLineDistances();
  three.previewLine.visible = true;

  three.previewDot.position.copy(MOBILE.preview.target);
  three.previewDot.material.color.setHex(MOBILE.preview.color);
  three.previewDot.visible = true;
}

function syncMeshes() {
  const p = state.player;
  three.player.position.set(p.x, p.y, 0);
  three.player.rotation.y = p.facing < 0 ? Math.PI : 0;

  const reuse = [];
  while (three.fxGroup.children.length) {
    const child = three.fxGroup.children.pop();
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    reuse.push(child);
  }

  for (const bolt of state.webBolts) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xd7f0ff })
    );
    dot.position.set(bolt.x, bolt.y, 0.5);
    three.fxGroup.add(dot);
  }

  for (const shot of state.enemyBolts) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6f8d })
    );
    dot.position.set(shot.x, shot.y, 0.5);
    three.fxGroup.add(dot);
  }

  updateWebLineVisual();
  updatePreviewVisual();
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.add("show");
}

function update(dt) {
  if (!state.running) return;

  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateCamera(dt);
  syncMeshes();

  if (state.boss && state.boss.dead && state.player.x > 92) {
    showOverlay("Victoire", "La ville est securisee.");
    state.running = false;
  }
}

function render() {
  three.renderer.render(three.scene, three.camera);
}

function frame(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = clamp((ts - state.lastTs) / 1000, 0, 0.033);
  state.lastTs = ts;

  update(dt);
  render();
  requestAnimationFrame(frame);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.dpr = dpr;
  const rect = canvas.getBoundingClientRect();
  state.width = rect.width;
  state.height = rect.height;
  three.renderer.setPixelRatio(dpr);
  three.renderer.setSize(rect.width, rect.height, false);
  three.camera.aspect = rect.width / rect.height;
  three.camera.updateProjectionMatrix();
}

function toggleFullscreen() {
  const root = document.documentElement;
  if (!document.fullscreenElement) {
    root.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

async function reloadLatestVersion() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Continue with forced reload.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}

startBtn.addEventListener("click", () => {
  resetGame();
  state.running = true;
  overlay.classList.remove("show");
});

restartBtn.addEventListener("click", () => {
  resetGame();
  state.running = true;
  overlay.classList.remove("show");
});

fullscreenBtn.addEventListener("click", toggleFullscreen);
latestBtn.addEventListener("click", reloadLatestVersion);
window.addEventListener("resize", resize);

initThree();
setupInput();
resetGame();
resize();
requestAnimationFrame(frame);
