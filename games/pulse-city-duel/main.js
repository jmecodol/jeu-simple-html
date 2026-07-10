const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const panelTitle = document.getElementById("panelTitle");
const panelText = document.getElementById("panelText");
const districtInfo = document.getElementById("districtInfo");
const scoreP1 = document.getElementById("scoreP1");
const scoreP2 = document.getElementById("scoreP2");
const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const restartBtn = document.getElementById("restartBtn");

const VEHICLE_TYPES = [
  { kind: "ambulance", icon: "AM", speed: 0.16, color: "#e9f8ff" },
  { kind: "taxi", icon: "TX", speed: 0.13, color: "#ffd44c" },
  { kind: "limousine", icon: "LM", speed: 0.1, color: "#1b1e27" },
  { kind: "velo", icon: "VL", speed: 0.2, color: "#8af7a5" },
];

const LINK_IDLE_SECONDS = 11;
const BASE_COOLDOWN_SECONDS = 0.32;

const districts = [
  {
    name: "Quartier Startups",
    subtitle: "Neons propres, ruelles sales.",
    bg: ["#1b2435", "#202f47", "#324669"],
    wind: { x: 0.03, y: -0.02 },
    zones: [{ x: 0.55, y: 0.43, r: 0.08, label: "Plaza noir" }],
    matchSeconds: 78,
    directionChaos: 0.12,
    curveChaos: 0.16,
  },
  {
    name: "Rives Connectees",
    subtitle: "Berges electro et courants imprenvisibles.",
    bg: ["#17283f", "#1d4464", "#2b708f"],
    wind: { x: 0.09, y: 0.02 },
    zones: [{ x: 0.5, y: 0.5, r: 0.09, label: "Dock pixel" }],
    matchSeconds: 82,
    directionChaos: 0.16,
    curveChaos: 0.22,
  },
  {
    name: "Centre Historique",
    subtitle: "Vieilles facades et tags sarcastiques.",
    bg: ["#36222d", "#5e3841", "#8f5f57"],
    wind: { x: -0.03, y: 0.02 },
    zones: [
      { x: 0.45, y: 0.36, r: 0.07, label: "Musee glitch" },
      { x: 0.58, y: 0.62, r: 0.07, label: "Arcade grin" },
    ],
    matchSeconds: 82,
    directionChaos: 0.11,
    curveChaos: 0.18,
  },
  {
    name: "District Festival",
    subtitle: "Bassline, fumee et mauvais choix.",
    bg: ["#281a42", "#5a2f67", "#9f4a58"],
    wind: { x: 0.0, y: 0.0 },
    zones: [{ x: 0.5, y: 0.52, r: 0.1, label: "Main stage" }],
    matchSeconds: 75,
    pulseJitter: true,
    directionChaos: 0.21,
    curveChaos: 0.26,
  },
  {
    name: "Eco Metropole",
    subtitle: "Toits verts et coups sales.",
    bg: ["#173127", "#2d5f4b", "#648f68"],
    wind: { x: -0.06, y: -0.02 },
    zones: [
      { x: 0.39, y: 0.5, r: 0.065, label: "Jardin vert" },
      { x: 0.62, y: 0.5, r: 0.065, label: "Hub solaire" },
    ],
    matchSeconds: 86,
    directionChaos: 0.14,
    curveChaos: 0.2,
  },
];

const state = {
  running: false,
  now: 0,
  w: 0,
  h: 0,
  baseRadius: 0,
  baseIdCounter: 1,
  districtIndex: 0,
  districtWins: { 1: 0, 2: 0 },
  districtTimeLeft: 0,
  bases: [],
  aimings: new Map(),
  gaugeTime: 0,
  gaugeValue: 0.5,
  fxTrails: [],
  vehicles: [],
  fallingVehicles: [],
  winner: null,
};

function activeDistrict() {
  return districts[state.districtIndex];
}

function baseSizeFactor(base) {
  return 1 + Math.min(0.9, base.children.length * 0.11);
}

function baseVisualRadius(base) {
  return state.baseRadius * baseSizeFactor(base);
}

function getLinkKey(parentId, childId) {
  return `${parentId}->${childId}`;
}

function updateLabels() {
  const district = activeDistrict();
  districtInfo.textContent = `${district.name} - ${district.subtitle}`;
  scoreP1.textContent = String(state.districtWins[1]);
  scoreP2.textContent = String(state.districtWins[2]);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.w = rect.width;
  state.h = rect.height;
  state.baseRadius = Math.max(11, Math.min(state.w, state.h) * 0.023);
}

function pointFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function quadraticAt(t, p0, p1, p2) {
  const omt = 1 - t;
  return omt * omt * p0 + 2 * omt * t * p1 + t * t * p2;
}

function sampleQuadraticPoints(ax, ay, cx, cy, bx, by, segments = 28) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    points.push({ x: quadraticAt(t, ax, cx, bx), y: quadraticAt(t, ay, cy, by) });
  }
  return points;
}

function createBase(owner, x, y, parentId) {
  const base = {
    id: state.baseIdCounter++,
    owner,
    x,
    y,
    parentId,
    children: [],
    pulse: Math.random() * Math.PI * 2,
    spriteSeed: Math.random() * Math.PI * 2,
    spriteMood: Math.floor(Math.random() * 3),
    cooldownUntil: 0,
    linkLastUsedAt: new Map(),
  };

  state.bases.push(base);

  if (parentId !== null) {
    const parent = state.bases.find((b) => b.id === parentId);
    if (parent) {
      parent.children.push(base.id);
      parent.linkLastUsedAt.set(getLinkKey(parent.id, base.id), state.now);
      createVehicleOnLink(parent.id, base.id, owner, 0.05 + Math.random() * 0.2);
    }
  }

  return base;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;
  if (denom === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function distancePointToPolyline(px, py, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    best = Math.min(best, distancePointToSegment(px, py, a.x, a.y, b.x, b.y));
  }
  return best;
}

function collectSubtreeIds(rootId, set) {
  if (set.has(rootId)) return;
  set.add(rootId);
  const node = state.bases.find((b) => b.id === rootId);
  if (!node) return;
  for (const childId of node.children) {
    collectSubtreeIds(childId, set);
  }
}

function setLinkUsage(parentId, childId) {
  const parent = state.bases.find((b) => b.id === parentId);
  if (!parent) return;
  parent.linkLastUsedAt.set(getLinkKey(parentId, childId), state.now);
}

function unlinkChild(parentId, childId) {
  const parent = state.bases.find((b) => b.id === parentId);
  const child = state.bases.find((b) => b.id === childId);
  if (parent) {
    parent.children = parent.children.filter((id) => id !== childId);
    parent.linkLastUsedAt.delete(getLinkKey(parentId, childId));
  }
  if (child && child.parentId === parentId) {
    child.parentId = null;
  }
}

function makeVehiclesFall(filterFn) {
  const survivors = [];
  for (const v of state.vehicles) {
    if (!filterFn(v)) {
      survivors.push(v);
      continue;
    }

    const p = getVehiclePosition(v);
    state.fallingVehicles.push({
      x: p.x,
      y: p.y,
      vx: (Math.random() - 0.5) * 140,
      vy: -110 - Math.random() * 130,
      spin: (Math.random() - 0.5) * 6,
      angle: Math.random() * Math.PI * 2,
      icon: v.icon,
      color: v.color,
      life: 3.5,
    });
  }
  state.vehicles = survivors;
}

function removeBases(baseIdsSet) {
  if (!baseIdsSet.size) return;

  for (const base of state.bases) {
    if (!base.children.length) continue;
    base.children = base.children.filter((id) => !baseIdsSet.has(id));
    for (const deadId of baseIdsSet) {
      base.linkLastUsedAt.delete(getLinkKey(base.id, deadId));
    }
  }

  for (const base of state.bases) {
    if (baseIdsSet.has(base.id)) continue;
    if (base.parentId !== null && baseIdsSet.has(base.parentId)) {
      base.parentId = null;
    }
  }

  makeVehiclesFall((v) => baseIdsSet.has(v.parentId) || baseIdsSet.has(v.childId));

  for (const [pointerId, aim] of state.aimings.entries()) {
    if (baseIdsSet.has(aim.baseId)) {
      state.aimings.delete(pointerId);
    }
  }

  state.bases = state.bases.filter((base) => !baseIdsSet.has(base.id));
}

function isInNoBuildZone(x, y) {
  for (const zone of activeDistrict().zones) {
    const zx = zone.x * state.w;
    const zy = zone.y * state.h;
    const rr = zone.r * Math.min(state.w, state.h);
    if (Math.hypot(x - zx, y - zy) <= rr) {
      return true;
    }
  }
  return false;
}

function isEndpointValid(x, y) {
  const margin = state.baseRadius * 1.6;
  if (x < margin || x > state.w - margin || y < margin || y > state.h - margin) {
    return false;
  }

  if (isInNoBuildZone(x, y)) return false;

  for (const b of state.bases) {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < baseVisualRadius(b) + state.baseRadius * 1.1) {
      return false;
    }
  }

  return true;
}

function buildControlPoint(sourceBase, aimX, aimY, pathPoints, reach, dirAngle) {
  const mx = (sourceBase.x + aimX) * 0.5;
  const my = (sourceBase.y + aimY) * 0.5;
  const nx = -Math.sin(dirAngle);
  const ny = Math.cos(dirAngle);

  let userCurve = 0;
  if (pathPoints.length > 2) {
    let strongest = 0;
    for (const p of pathPoints) {
      const d = distancePointToSegment(p.x, p.y, sourceBase.x, sourceBase.y, aimX, aimY);
      const side =
        (aimX - sourceBase.x) * (p.y - sourceBase.y) - (aimY - sourceBase.y) * (p.x - sourceBase.x) >= 0
          ? 1
          : -1;
      const signed = d * side;
      if (Math.abs(signed) > Math.abs(strongest)) strongest = signed;
    }
    userCurve = Math.max(-1, Math.min(1, strongest / (reach * 0.45)));
  }

  const randomCurve = (Math.random() - 0.5) * 2 * activeDistrict().curveChaos;
  const curveScalar = (userCurve * 0.95 + randomCurve) * reach * 0.55;

  return {
    x: mx + nx * curveScalar,
    y: my + ny * curveScalar,
  };
}

function createVehicleOnLink(parentId, childId, owner, progress = Math.random()) {
  const type = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];
  state.vehicles.push({
    parentId,
    childId,
    owner,
    t: progress,
    speed: type.speed * (0.8 + Math.random() * 0.5),
    icon: type.icon,
    color: type.color,
    kind: type.kind,
    dir: Math.random() < 0.5 ? 1 : -1,
    wobble: Math.random() * Math.PI * 2,
  });
}

function applyShot(sourceBase, aim) {
  const dirX = aim.x - sourceBase.x;
  const dirY = aim.y - sourceBase.y;
  const len = Math.hypot(dirX, dirY);
  if (len < 10) return;

  if (sourceBase.cooldownUntil > state.now) return;
  sourceBase.cooldownUntil = state.now + BASE_COOLDOWN_SECONDS;

  let power = state.gaugeValue;
  if (activeDistrict().pulseJitter) {
    power = Math.max(0, Math.min(1, power + (Math.random() - 0.5) * 0.14));
  }

  const short = Math.min(state.w, state.h);
  const reach = short * (0.16 + power * 0.45);
  const baseAngle = Math.atan2(dirY, dirX);
  const chaoticAngle = baseAngle + (Math.random() - 0.5) * activeDistrict().directionChaos;
  const nx = Math.cos(chaoticAngle);
  const ny = Math.sin(chaoticAngle);

  const wind = activeDistrict().wind;
  const driftX = wind.x * short * (0.2 + power * 0.8);
  const driftY = wind.y * short * (0.2 + power * 0.8);

  let endX = sourceBase.x + nx * reach + driftX;
  let endY = sourceBase.y + ny * reach + driftY;

  const edge = state.baseRadius * 1.2;
  endX = Math.max(edge, Math.min(state.w - edge, endX));
  endY = Math.max(edge, Math.min(state.h - edge, endY));

  const control = buildControlPoint(sourceBase, endX, endY, aim.pathPoints, reach, chaoticAngle);
  const shotPoints = sampleQuadraticPoints(sourceBase.x, sourceBase.y, control.x, control.y, endX, endY, 30);

  const enemy = sourceBase.owner === 1 ? 2 : 1;
  const touchedEnemyBases = state.bases.filter((b) => {
    if (b.owner !== enemy) return false;
    const d = distancePointToPolyline(b.x, b.y, shotPoints);
    return d <= baseVisualRadius(b) * 0.95;
  });

  const toRemove = new Set();
  for (const hit of touchedEnemyBases) {
    collectSubtreeIds(hit.id, toRemove);
  }
  removeBases(toRemove);

  if (isEndpointValid(endX, endY)) {
    createBase(sourceBase.owner, endX, endY, sourceBase.id);
  }

  state.fxTrails.push({
    ax: sourceBase.x,
    ay: sourceBase.y,
    cx: control.x,
    cy: control.y,
    bx: endX,
    by: endY,
    owner: sourceBase.owner,
    ttl: 0.62,
    jitterSeed: Math.random() * Math.PI * 2,
  });
}

function finalizeDistrict(forcedWinner = null) {
  state.running = false;
  let winner = forcedWinner;

  if (winner === null) {
    const p1Count = state.bases.filter((b) => b.owner === 1).length;
    const p2Count = state.bases.filter((b) => b.owner === 2).length;
    if (p1Count > p2Count) winner = 1;
    else if (p2Count > p1Count) winner = 2;
  }

  if (winner) {
    state.districtWins[winner] += 1;
  }

  state.winner = winner;
  updateLabels();

  const districtName = activeDistrict().name;
  if (!winner) {
    panelTitle.textContent = `${districtName} - Egalite`;
    panelText.textContent = "Les deux reseaux finissent au meme niveau. Relance ce district pour les departager.";
    nextBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
    startBtn.textContent = "Rejouer ce district";
  } else if (state.districtIndex < districts.length - 1) {
    panelTitle.textContent = `${districtName} gagne par J${winner}`;
    panelText.textContent = `Le collectif J${winner} remporte ce quartier. Passez au district suivant.`;
    startBtn.classList.add("hidden");
    nextBtn.classList.remove("hidden");
  } else {
    const finalWinner =
      state.districtWins[1] === state.districtWins[2]
        ? winner
        : state.districtWins[1] > state.districtWins[2]
        ? 1
        : 2;
    panelTitle.textContent = `Saison terminee - Champion: J${finalWinner}`;
    panelText.textContent =
      `Score final ${state.districtWins[1]} - ${state.districtWins[2]}. ` +
      `La ville adopte le style du collectif J${finalWinner}.`;
    startBtn.classList.remove("hidden");
    startBtn.textContent = "Nouvelle saison";
    nextBtn.classList.add("hidden");
  }

  overlay.classList.add("show");
}

function getVehiclePosition(v) {
  const parent = state.bases.find((b) => b.id === v.parentId);
  const child = state.bases.find((b) => b.id === v.childId);
  if (!parent || !child) return { x: 0, y: 0 };
  const t = v.t;
  return {
    x: parent.x + (child.x - parent.x) * t,
    y: parent.y + (child.y - parent.y) * t,
  };
}

function updateVehicles(dt) {
  for (const base of state.bases) {
    for (const childId of base.children) {
      const linkKey = getLinkKey(base.id, childId);
      const lastUsed = base.linkLastUsedAt.get(linkKey) ?? state.now;
      const age = state.now - lastUsed;
      if (age > LINK_IDLE_SECONDS) {
        makeVehiclesFall((v) => v.parentId === base.id && v.childId === childId);
        unlinkChild(base.id, childId);
      } else if (age < LINK_IDLE_SECONDS * 0.55 && Math.random() < dt * (0.85 - age / LINK_IDLE_SECONDS * 0.6)) {
        createVehicleOnLink(base.id, childId, base.owner);
      }
    }
  }

  const survivors = [];
  for (const v of state.vehicles) {
    const parent = state.bases.find((b) => b.id === v.parentId);
    const child = state.bases.find((b) => b.id === v.childId);
    if (!parent || !child || !parent.children.includes(child.id)) {
      const p = getVehiclePosition(v);
      state.fallingVehicles.push({
        x: p.x,
        y: p.y,
        vx: (Math.random() - 0.5) * 140,
        vy: -110 - Math.random() * 130,
        spin: (Math.random() - 0.5) * 6,
        angle: Math.random() * Math.PI * 2,
        icon: v.icon,
        color: v.color,
        life: 3.5,
      });
      continue;
    }

    const dir = v.dir;
    v.t += dir * v.speed * dt;
    if (v.t >= 1) {
      v.t = 1;
      v.dir = -1;
      setLinkUsage(parent.id, child.id);
    } else if (v.t <= 0) {
      v.t = 0;
      v.dir = 1;
      setLinkUsage(parent.id, child.id);
    }

    survivors.push(v);
  }
  state.vehicles = survivors;

  for (const f of state.fallingVehicles) {
    f.vy += 260 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.angle += f.spin * dt;
    if (f.y > state.h - 6 && f.vy > 0) {
      f.vy *= -0.42;
      f.vx *= 0.85;
    }
    f.life -= dt;
  }
  state.fallingVehicles = state.fallingVehicles.filter((f) => f.life > 0);
}

function resetDistrictState() {
  state.baseIdCounter = 1;
  state.districtTimeLeft = activeDistrict().matchSeconds;
  state.bases = [];
  state.aimings = new Map();
  state.fxTrails = [];
  state.vehicles = [];
  state.fallingVehicles = [];
  state.winner = null;

  const leftX = state.w * 0.14;
  const rightX = state.w * 0.86;
  const y = state.h * 0.5;

  createBase(1, leftX, y, null);
  createBase(2, rightX, y, null);
}

function startDistrict() {
  resizeCanvas();
  resetDistrictState();
  updateLabels();
  state.running = true;
  overlay.classList.remove("show");
  nextBtn.classList.add("hidden");
  startBtn.classList.remove("hidden");
  startBtn.textContent = "Rejouer ce district";
}

function startSeason() {
  state.districtIndex = 0;
  state.districtWins = { 1: 0, 2: 0 };
  panelTitle.textContent = "Pulse City - Duel de quartiers";
  panelText.textContent =
    "Les deux joueurs jouent en meme temps. Trace ta direction et ta courbe, puis relache sur la jauge mobile. " +
    "Le trafic urbain vit sur les chemins: s ils ne servent plus, ils meurent.";
  startBtn.textContent = "Lancer le district";
  nextBtn.classList.add("hidden");
  updateLabels();
  startDistrict();
}

canvas.addEventListener("pointerdown", (evt) => {
  if (!state.running) return;

  const p = pointFromEvent(evt);

  let chosen = null;
  for (const b of state.bases) {
    if (distance({ x: p.x, y: p.y }, b) <= baseVisualRadius(b)) {
      chosen = b;
      break;
    }
  }

  if (!chosen) return;

  canvas.setPointerCapture(evt.pointerId);
  state.aimings.set(evt.pointerId, {
    pointerId: evt.pointerId,
    baseId: chosen.id,
    owner: chosen.owner,
    x: p.x,
    y: p.y,
    pathPoints: [{ x: p.x, y: p.y }],
  });
});

canvas.addEventListener("pointermove", (evt) => {
  const aim = state.aimings.get(evt.pointerId);
  if (!aim) return;
  const p = pointFromEvent(evt);
  aim.x = p.x;
  aim.y = p.y;
  aim.pathPoints.push({ x: p.x, y: p.y });
  if (aim.pathPoints.length > 28) {
    aim.pathPoints.shift();
  }
});

function releaseAim(pointerId) {
  const aim = state.aimings.get(pointerId);
  if (!aim) return;
  state.aimings.delete(pointerId);
  const source = state.bases.find((b) => b.id === aim.baseId);
  if (!state.running || !source) return;
  applyShot(source, aim);
}

canvas.addEventListener("pointerup", (evt) => releaseAim(evt.pointerId));
canvas.addEventListener("pointercancel", (evt) => releaseAim(evt.pointerId));

function drawUrbanBackground() {
  const district = activeDistrict();
  const g = ctx.createLinearGradient(0, 0, state.w, state.h);
  g.addColorStop(0, district.bg[0]);
  g.addColorStop(0.55, district.bg[1]);
  g.addColorStop(1, district.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, state.w, state.h);

  const roadAlpha = 0.13;
  ctx.strokeStyle = `rgba(16, 18, 24, ${roadAlpha})`;
  ctx.lineWidth = Math.max(3, state.w * 0.015);
  for (let i = -1; i < 6; i += 1) {
    const y = (i * state.h) / 5 + Math.sin(state.gaugeTime + i) * 8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.w, y + 24);
    ctx.stroke();
  }

  ctx.lineWidth = Math.max(2, state.h * 0.012);
  for (let i = -1; i < 7; i += 1) {
    const x = (i * state.w) / 6 + Math.cos(state.gaugeTime * 0.8 + i) * 6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 18, state.h);
    ctx.stroke();
  }

  for (let i = 0; i < 24; i += 1) {
    const x = ((i * 229 + 31) % (state.w + 120)) - 60;
    const h = 30 + ((i * 47) % 90);
    const w = 14 + ((i * 73) % 28);
    const y = state.h - h - ((i * 19) % 30);
    ctx.fillStyle = i % 2 ? "#10161f8f" : "#0a0f1794";
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = i % 3 ? "#56d3ff5f" : "#ff6f5e5f";
    ctx.fillRect(x + 2, y + 4, w - 4, 3);
  }

  for (let i = 0; i < 8; i += 1) {
    const x = (i * state.w) / 8 + 20;
    const y = 26 + Math.sin(state.gaugeTime * 1.4 + i) * 8;
    const w = 64;
    const h = 20;
    ctx.fillStyle = "#120d17b3";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = i % 2 ? "#ff6b61" : "#58def4";
    ctx.font = "700 11px 'Trebuchet MS'";
    ctx.textAlign = "center";
    ctx.fillText(i % 2 ? "NO FUTURE" : "RENT++", x + w / 2, y + 14);
  }
  ctx.textAlign = "left";
}

function drawNoBuildZones() {
  for (const zone of activeDistrict().zones) {
    const x = zone.x * state.w;
    const y = zone.y * state.h;
    const r = zone.r * Math.min(state.w, state.h);

    ctx.fillStyle = "#090b103d";
    ctx.strokeStyle = "#f5e6b887";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f4f0d3";
    ctx.font = "600 12px 'Trebuchet MS'";
    ctx.textAlign = "center";
    ctx.fillText(zone.label, x, y + 4);
  }
  ctx.textAlign = "left";
}

function drawLinks() {
  for (const b of state.bases) {
    for (const childId of b.children) {
      const child = state.bases.find((n) => n.id === childId);
      if (!child) continue;
      const linkKey = getLinkKey(b.id, child.id);
      const lastUsed = b.linkLastUsedAt.get(linkKey) ?? state.now;
      const freshness = Math.max(0, 1 - (state.now - lastUsed) / LINK_IDLE_SECONDS);
      if (freshness <= 0) continue;

      ctx.strokeStyle =
        b.owner === 1 ? `rgba(128, 223, 244, ${0.18 + freshness * 0.55})` : `rgba(255, 179, 155, ${0.18 + freshness * 0.55})`;
      ctx.lineWidth = Math.max(2, state.baseRadius * (0.36 + freshness * 0.45));
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(child.x, child.y);
      ctx.stroke();
    }
  }
}

function drawShotFx(dt) {
  state.fxTrails = state.fxTrails.filter((fx) => (fx.ttl -= dt) > 0);

  for (const fx of state.fxTrails) {
    const alpha = Math.max(0, fx.ttl / 0.62);
    const jitter = Math.sin(state.gaugeTime * 14 + fx.jitterSeed) * 8 * alpha;
    ctx.strokeStyle =
      fx.owner === 1 ? `rgba(79, 232, 252, ${0.42 * alpha})` : `rgba(255, 130, 113, ${0.42 * alpha})`;
    ctx.lineWidth = Math.max(3, state.baseRadius * 0.84);
    ctx.beginPath();
    ctx.moveTo(fx.ax, fx.ay);
    ctx.quadraticCurveTo(fx.cx + jitter, fx.cy - jitter, fx.bx, fx.by);
    ctx.stroke();
  }
}

function drawVehicles() {
  for (const v of state.vehicles) {
    const parent = state.bases.find((b) => b.id === v.parentId);
    const child = state.bases.find((b) => b.id === v.childId);
    if (!parent || !child) continue;

    const p = getVehiclePosition(v);
    const heading = Math.atan2(child.y - parent.y, child.x - parent.x) + Math.sin(state.gaugeTime * 6 + v.wobble) * 0.04;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(heading);
    ctx.fillStyle = "#0a0d139a";
    ctx.fillRect(-10, -6, 20, 12);
    ctx.fillStyle = v.color;
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = v.kind === "limousine" ? "#d6d9df" : "#11151d";
    ctx.font = "700 8px 'Trebuchet MS'";
    ctx.textAlign = "center";
    ctx.fillText(v.icon, 0, 3);
    ctx.restore();
  }

  for (const f of state.fallingVehicles) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    ctx.fillStyle = f.color;
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = "#11151d";
    ctx.font = "700 8px 'Trebuchet MS'";
    ctx.textAlign = "center";
    ctx.fillText(f.icon, 0, 3);
    ctx.restore();
  }
}

function drawPixelBlock(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function drawPunkSprite(base, r) {
  const px = r / 6;
  const anim = Math.sin(state.gaugeTime * 5 + base.spriteSeed);
  const blink = Math.sin(state.gaugeTime * 8 + base.spriteSeed * 2) > 0.88;
  const isBlue = base.owner === 1;

  const skin = isBlue ? "#d7f5ff" : "#ffe5e2";
  const eye = isBlue ? "#123d52" : "#5d201c";
  const mohawk = isBlue ? "#58d8f2" : "#ff7b6f";
  const stitch = "#1e1c25";

  for (let i = -2; i <= 2; i += 1) {
    const spikeY = base.y - r - px * (0.9 + (i % 2) * 0.3 + 0.2 * anim);
    drawPixelBlock(base.x + i * px - px * 0.5, spikeY, px, px, mohawk);
  }

  drawPixelBlock(base.x - 2 * px, base.y - 2 * px, 4 * px, 4 * px, skin);

  if (!blink) {
    if (base.spriteMood === 0) {
      drawPixelBlock(base.x - 1.5 * px, base.y - px, px, px, eye);
      drawPixelBlock(base.x + 0.5 * px, base.y - px, px, px, eye);
    } else if (base.spriteMood === 1) {
      drawPixelBlock(base.x - 1.5 * px, base.y - px, px, px, eye);
      drawPixelBlock(base.x - 0.5 * px, base.y - 0.2 * px, px, px, eye);
      drawPixelBlock(base.x + 0.5 * px, base.y - px, px, px, eye);
      drawPixelBlock(base.x + 1.5 * px, base.y - 0.2 * px, px, px, eye);
    } else {
      drawPixelBlock(base.x - 1.5 * px, base.y - px, px, px, eye);
      drawPixelBlock(base.x - 0.6 * px, base.y - 0.1 * px, px, px, eye);
      drawPixelBlock(base.x + 0.5 * px, base.y - 0.1 * px, px, px, eye);
      drawPixelBlock(base.x + 1.4 * px, base.y - px, px, px, eye);
    }
  } else {
    drawPixelBlock(base.x - 1.6 * px, base.y - 0.7 * px, 1.2 * px, px * 0.6, stitch);
    drawPixelBlock(base.x + 0.4 * px, base.y - 0.7 * px, 1.2 * px, px * 0.6, stitch);
  }

  const grin = 0.3 + 0.25 * anim;
  drawPixelBlock(base.x - 1.5 * px, base.y + px * (0.3 + grin), 3 * px, px, stitch);
  drawPixelBlock(base.x - 0.2 * px, base.y + px * (0.5 + grin), px * 0.8, px * 0.8, "#f3d278");
}

function drawBases() {
  for (const b of state.bases) {
    const pulse = 0.55 + 0.45 * Math.sin(state.gaugeTime * 3 + b.pulse);
    const r = baseVisualRadius(b) * (1.01 + 0.05 * pulse);

    const glow = ctx.createRadialGradient(b.x, b.y, r * 0.3, b.x, b.y, r * 2.3);
    if (b.owner === 1) {
      glow.addColorStop(0, "#6ee8ff9d");
      glow.addColorStop(1, "#6ee8ff00");
    } else {
      glow.addColorStop(0, "#ff96889d");
      glow.addColorStop(1, "#ff968800");
    }

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.owner === 1 ? "#0d4254" : "#5a2420";
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();

    drawPunkSprite(b, r * 0.78);

    ctx.strokeStyle = "#ffffffba";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAimPreview() {
  for (const aim of state.aimings.values()) {
    const src = state.bases.find((b) => b.id === aim.baseId);
    if (!src) continue;

    const dx = aim.x - src.x;
    const dy = aim.y - src.y;
    const len = Math.hypot(dx, dy);
    if (len < 8) continue;

    const angle = Math.atan2(dy, dx);
    const control = buildControlPoint(src, aim.x, aim.y, aim.pathPoints, len, angle);

    ctx.strokeStyle = aim.owner === 1 ? "#9beff8" : "#ffc0b6";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.quadraticCurveTo(control.x, control.y, aim.x, aim.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const gaugeT = 0.15 + 0.75 * state.gaugeValue;
    const gx = quadraticAt(gaugeT, src.x, control.x, aim.x);
    const gy = quadraticAt(gaugeT, src.y, control.y, aim.y);
    const gaugeCol = aim.owner === 1 ? "#59ecff" : "#ff8c7d";

    ctx.fillStyle = gaugeCol;
    ctx.beginPath();
    ctx.arc(gx, gy, Math.max(6, state.baseRadius * 0.46), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffffcc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, Math.max(9, state.baseRadius * 0.72), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTopHud() {
  const p1Count = state.bases.filter((b) => b.owner === 1).length;
  const p2Count = state.bases.filter((b) => b.owner === 2).length;
  ctx.fillStyle = "#00000063";
  ctx.fillRect(state.w / 2 - 178, 10, 356, 36);
  ctx.fillStyle = "#f8f7ee";
  ctx.font = "700 14px 'Trebuchet MS'";
  ctx.textAlign = "center";
  ctx.fillText(
    `J1 ${p1Count} bases  |  J2 ${p2Count} bases  |  ${Math.ceil(state.districtTimeLeft)}s`,
    state.w / 2,
    33,
  );
  ctx.textAlign = "left";
}

function nextDistrict() {
  if (state.districtIndex < districts.length - 1) {
    state.districtIndex += 1;
    startDistrict();
  }
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  state.now += dt;
  state.gaugeTime += dt;
  state.gaugeValue = (Math.sin(state.gaugeTime * 2.7) + 1) * 0.5;

  if (state.running) {
    state.districtTimeLeft = Math.max(0, state.districtTimeLeft - dt);
    updateVehicles(dt);

    const p1Alive = state.bases.some((b) => b.owner === 1);
    const p2Alive = state.bases.some((b) => b.owner === 2);
    if (!p1Alive || !p2Alive || state.districtTimeLeft <= 0) {
      finalizeDistrict(!p1Alive ? 2 : !p2Alive ? 1 : null);
    }
  } else {
    updateVehicles(dt);
  }

  drawUrbanBackground();
  drawNoBuildZones();
  drawLinks();
  drawShotFx(dt);
  drawVehicles();
  drawBases();
  drawAimPreview();
  drawTopHud();

  requestAnimationFrame(frame);
}

startBtn.addEventListener("click", () => {
  if (startBtn.textContent.includes("Nouvelle saison")) {
    startSeason();
    return;
  }
  startDistrict();
});

nextBtn.addEventListener("click", nextDistrict);
restartBtn.addEventListener("click", startSeason);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateLabels();
requestAnimationFrame(frame);

