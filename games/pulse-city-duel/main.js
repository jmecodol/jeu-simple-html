const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const panelTitle = document.getElementById("panelTitle");
const panelText = document.getElementById("panelText");
const scoreP1 = document.getElementById("scoreP1");
const scoreP2 = document.getElementById("scoreP2");
const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const VEHICLE_TYPES = [
  { kind: "ambulance", icon: "AM", speed: 0.16, color: "#e9f8ff" },
  { kind: "taxi", icon: "TX", speed: 0.13, color: "#ffd44c" },
  { kind: "limousine", icon: "LM", speed: 0.1, color: "#1b1e27" },
  { kind: "velo", icon: "VL", speed: 0.2, color: "#8af7a5" },
];

const LINK_IDLE_SECONDS = 11;
const BASE_COOLDOWN_SECONDS = 0.32;
const BASE_SIZE_MULT = 2.2;
const HEAT_BUILD_ADD = 1.1;
const HEAT_DECAY_PER_SEC = 0.22;
const STABILITY_GAIN_PER_SEC = 0.16;
const STABILITY_MAX = 4;

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
  pressBursts: [],
  eventBursts: [],
  playerStats: {
    1: { heat: 0, stability: 0 },
    2: { heat: 0, stability: 0 },
  },
  winner: null,
};

const audioState = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  initialized: false,
  nextBeatAt: 0,
  beatIndex: 0,
};

function activeDistrict() {
  return districts[state.districtIndex];
}

function baseSizeFactor(base) {
  const branchBonus = Math.min(0.9, base.children.length * 0.11);
  return 1 + branchBonus + (base.growth || 0) + ((base.cityScale || 1) - 1);
}

function baseVisualRadius(base) {
  return state.baseRadius * BASE_SIZE_MULT * baseSizeFactor(base);
}

function getLinkKey(parentId, childId) {
  return `${parentId}->${childId}`;
}

function playerStat(owner) {
  return state.playerStats[owner];
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function getOverload(owner) {
  const stat = playerStat(owner);
  return clamp01((stat.heat - 1.05) / 2.9);
}

function getStabilityBonus(owner) {
  const stat = playerStat(owner);
  return clamp01(stat.stability / STABILITY_MAX);
}

function getDestructionRadius(base) {
  return baseVisualRadius(base) * (1 + (base.fragility || 0) * 0.7);
}

function updateLabels() {
  scoreP1.textContent = String(state.districtWins[1]);
  scoreP2.textContent = String(state.districtWins[2]);
}

async function enterFullscreen() {
  if (document.fullscreenElement) return;
  if (!document.documentElement.requestFullscreen) return;
  try {
    await document.documentElement.requestFullscreen();
  } catch {
    // Ignore platforms that block fullscreen requests.
  }
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
    return;
  }
  await enterFullscreen();
}

function updateFullscreenButton() {
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = document.fullscreenElement ? "Exit" : "FS";
}

function ensureAudio() {
  if (audioState.initialized) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  const ctxAudio = new Ctx();
  const master = ctxAudio.createGain();
  const musicGain = ctxAudio.createGain();
  const sfxGain = ctxAudio.createGain();

  master.gain.value = 0.65;
  musicGain.gain.value = 0.18;
  sfxGain.gain.value = 0.24;

  musicGain.connect(master);
  sfxGain.connect(master);
  master.connect(ctxAudio.destination);

  audioState.ctx = ctxAudio;
  audioState.master = master;
  audioState.musicGain = musicGain;
  audioState.sfxGain = sfxGain;
  audioState.initialized = true;
  audioState.nextBeatAt = ctxAudio.currentTime;
}

function tone(targetGain, type, frequency, startAt, duration, volume, sweepTo = null) {
  if (!audioState.initialized) return;
  const osc = audioState.ctx.createOscillator();
  const gain = audioState.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  if (sweepTo !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(22, sweepTo), startAt + duration);
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(targetGain);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

function playSfxShot(owner) {
  if (!audioState.initialized) return;
  const t = audioState.ctx.currentTime;
  const base = owner === 1 ? 420 : 330;
  tone(audioState.sfxGain, "triangle", base, t, 0.09, 0.16, base * 1.5);
}

function playSfxBuild(owner) {
  if (!audioState.initialized) return;
  const t = audioState.ctx.currentTime;
  const base = owner === 1 ? 680 : 520;
  tone(audioState.sfxGain, "square", base, t, 0.08, 0.1);
  tone(audioState.sfxGain, "triangle", base * 1.5, t + 0.05, 0.08, 0.08);
}

function playSfxDestroy(power = 1) {
  if (!audioState.initialized) return;
  const t = audioState.ctx.currentTime;
  const depth = 180 / Math.max(1, power);
  tone(audioState.sfxGain, "sawtooth", 240, t, 0.15, 0.18, 90 + depth);
}

function playSfxFall() {
  if (!audioState.initialized) return;
  const t = audioState.ctx.currentTime;
  tone(audioState.sfxGain, "triangle", 310, t, 0.12, 0.12, 95);
}

function playSfxPress(owner) {
  if (!audioState.initialized) return;
  const t = audioState.ctx.currentTime;
  const f = owner === 1 ? 560 : 460;
  tone(audioState.sfxGain, "sine", f, t, 0.07, 0.08);
}

function playSfxPermitDenied() {
  if (!audioState.initialized) return;
  const t = audioState.ctx.currentTime;
  tone(audioState.sfxGain, "square", 440, t, 0.06, 0.09, 300);
  tone(audioState.sfxGain, "sawtooth", 220, t + 0.05, 0.07, 0.08, 130);
}

function playSfxJam() {
  if (!audioState.initialized) return;
  const t = audioState.ctx.currentTime;
  tone(audioState.sfxGain, "triangle", 260, t, 0.1, 0.1, 160);
}

function updateSoundtrack() {
  if (!audioState.initialized || !state.running) return;
  const bpm = 106;
  const step = 60 / bpm / 2;
  const ctxAudio = audioState.ctx;

  while (audioState.nextBeatAt < ctxAudio.currentTime + 0.2) {
    const beat = audioState.beatIndex % 16;
    const t = audioState.nextBeatAt;

    if (beat % 4 === 0) {
      tone(audioState.musicGain, "sine", 60, t, 0.09, 0.2, 34);
    }
    if (beat % 4 === 2) {
      tone(audioState.musicGain, "square", 170, t, 0.05, 0.08);
    }
    if (beat % 2 === 1) {
      const note = [220, 247, 196, 247][Math.floor(beat / 2) % 4];
      tone(audioState.musicGain, "triangle", note, t, 0.12, 0.07);
    }

    audioState.nextBeatAt += step;
    audioState.beatIndex += 1;
  }
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

function addEventBurst(x, y, owner, kind) {
  state.eventBursts.push({
    x,
    y,
    owner,
    kind,
    life: 0.62,
    r: state.baseRadius * BASE_SIZE_MULT * 0.55,
  });
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
    growth: 0,
    cityScale: 1,
    fragility: 0,
    mergeCooldownUntil: 0,
    cooldownUntil: 0,
    linkLastUsedAt: new Map(),
    linkBirthAt: new Map(),
  };

  state.bases.push(base);

  if (parentId !== null) {
    const parent = state.bases.find((b) => b.id === parentId);
    if (parent) {
      parent.children.push(base.id);
      parent.linkLastUsedAt.set(getLinkKey(parent.id, base.id), state.now);
      parent.linkBirthAt.set(getLinkKey(parent.id, base.id), state.now);
      createVehicleOnLink(parent.id, base.id, owner, 0.05 + Math.random() * 0.2);
      const stat = playerStat(owner);
      stat.heat += HEAT_BUILD_ADD;
      stat.stability = Math.max(0, stat.stability - 0.3);
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
    parent.linkBirthAt.delete(getLinkKey(parentId, childId));
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

  playSfxDestroy(baseIdsSet.size);

  for (const base of state.bases) {
    if (!base.children.length) continue;
    base.children = base.children.filter((id) => !baseIdsSet.has(id));
    for (const deadId of baseIdsSet) {
      base.linkLastUsedAt.delete(getLinkKey(base.id, deadId));
      base.linkBirthAt.delete(getLinkKey(base.id, deadId));
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
  const margin = state.baseRadius * BASE_SIZE_MULT * 1.25;
  if (x < margin || x > state.w - margin || y < margin || y > state.h - margin) {
    return false;
  }

  if (isInNoBuildZone(x, y)) return false;

  for (const b of state.bases) {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < baseVisualRadius(b) + state.baseRadius * BASE_SIZE_MULT * 0.8) {
      return false;
    }
  }

  return true;
}

function buildControlPoint(sourceBase, aimX, aimY, pathPoints, reach, dirAngle, owner) {
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

  const overload = getOverload(owner);
  const stability = getStabilityBonus(owner);
  const randomCurve = (Math.random() - 0.5) * 2 * activeDistrict().curveChaos * (1 + overload * 1.15 - stability * 0.3);
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

  const overload = getOverload(sourceBase.owner);
  const stability = getStabilityBonus(sourceBase.owner);
  sourceBase.cooldownUntil =
    state.now + BASE_COOLDOWN_SECONDS * (1 + overload * 1.7 - stability * 0.28);

  let power = state.gaugeValue;
  if (activeDistrict().pulseJitter) {
    power = Math.max(0, Math.min(1, power + (Math.random() - 0.5) * 0.14));
  }

  const short = Math.min(state.w, state.h);
  const minReach = state.baseRadius * BASE_SIZE_MULT * 2.6;
  const maxReach = short * 0.92;
  const intendedReach = Math.max(minReach, Math.min(maxReach, len));
  const powerScale = 0.84 + power * 0.36;
  const randomScale = 1 + (Math.random() - 0.5) * activeDistrict().directionChaos * 2.1;
  const reach = Math.max(minReach, Math.min(maxReach, intendedReach * powerScale * randomScale));
  const baseAngle = Math.atan2(dirY, dirX);
  const directionChaos = activeDistrict().directionChaos * (1 + overload * 0.95 - stability * 0.25);
  const chaoticAngle = baseAngle + (Math.random() - 0.5) * directionChaos;
  const nx = Math.cos(chaoticAngle);
  const ny = Math.sin(chaoticAngle);

  const wind = activeDistrict().wind;
  const driftX = wind.x * short * (0.2 + power * 0.8);
  const driftY = wind.y * short * (0.2 + power * 0.8);

  let endX = sourceBase.x + nx * reach + driftX;
  let endY = sourceBase.y + ny * reach + driftY;

  const edge = state.baseRadius * BASE_SIZE_MULT * 0.95;
  endX = Math.max(edge, Math.min(state.w - edge, endX));
  endY = Math.max(edge, Math.min(state.h - edge, endY));

  const control = buildControlPoint(sourceBase, endX, endY, aim.pathPoints, reach, chaoticAngle, sourceBase.owner);
  const shotPoints = sampleQuadraticPoints(sourceBase.x, sourceBase.y, control.x, control.y, endX, endY, 30);

  const enemy = sourceBase.owner === 1 ? 2 : 1;
  const touchedEnemyBases = state.bases.filter((b) => {
    if (b.owner !== enemy) return false;
    const d = distancePointToPolyline(b.x, b.y, shotPoints);
    return d <= getDestructionRadius(b) * 0.95;
  });

  const toRemove = new Set();
  for (const hit of touchedEnemyBases) {
    collectSubtreeIds(hit.id, toRemove);
  }
  removeBases(toRemove);

  if (isEndpointValid(endX, endY)) {
    const denied = Math.random() < overload * 0.34;
    if (denied) {
      addEventBurst(endX, endY, sourceBase.owner, "denied");
      playSfxPermitDenied();
    } else {
      createBase(sourceBase.owner, endX, endY, sourceBase.id);
      addEventBurst(endX, endY, sourceBase.owner, "build");
      playSfxBuild(sourceBase.owner);
    }
  }

  playSfxShot(sourceBase.owner);

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
    const overload = getOverload(base.owner);
    const stability = getStabilityBonus(base.owner);
    const effectiveIdle = LINK_IDLE_SECONDS * (1 - overload * 0.55 + stability * 0.5);
    const clampedIdle = Math.max(4.2, Math.min(21, effectiveIdle));

    for (const childId of base.children) {
      const linkKey = getLinkKey(base.id, childId);
      const lastUsed = base.linkLastUsedAt.get(linkKey) ?? state.now;
      const age = state.now - lastUsed;
      if (age > clampedIdle) {
        playSfxFall();
        addEventBurst(base.x, base.y, base.owner, "jam");
        makeVehiclesFall((v) => v.parentId === base.id && v.childId === childId);
        unlinkChild(base.id, childId);
      } else if (
        age < clampedIdle * 0.55 &&
        Math.random() < dt * ((0.85 - age / clampedIdle * 0.6) * (1 - overload * 0.5 + stability * 0.35))
      ) {
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

    const overload = getOverload(v.owner);
    const stability = getStabilityBonus(v.owner);
    const trafficFactor = 1 - overload * 0.34 + stability * 0.22;
    if (Math.random() < dt * (0.045 * overload)) {
      playSfxJam();
      const p = getVehiclePosition(v);
      addEventBurst(p.x, p.y, v.owner, "jam");
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
    v.t += dir * v.speed * dt * trafficFactor;
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

function updateBaseGrowthAndMerges(dt) {
  for (const base of state.bases) {
    const cityBoost = Math.min(0.35, ((base.cityScale || 1) - 1) * 0.3);
    const targetGrowth = Math.min(0.44, 0.04 + base.children.length * 0.025 + cityBoost);
    base.growth += (targetGrowth - (base.growth || 0)) * Math.min(1, dt * 1.32);
  }

  for (let i = 0; i < state.bases.length; i += 1) {
    const a = state.bases[i];
    if (!a) continue;
    for (let j = i + 1; j < state.bases.length; j += 1) {
      const b = state.bases[j];
      if (!b) continue;
      if (a.owner !== b.owner) continue;
      if (a.mergeCooldownUntil > state.now || b.mergeCooldownUntil > state.now) continue;

      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const touchDistance = (baseVisualRadius(a) + baseVisualRadius(b)) * 0.95;
      if (dist > touchDistance) continue;

      mergeCities(a, b);
      return;
    }
  }
}

function mergeCities(baseA, baseB) {
  const survivor = (baseA.children.length + baseA.cityScale) >= (baseB.children.length + baseB.cityScale) ? baseA : baseB;
  const absorbed = survivor === baseA ? baseB : baseA;

  if (absorbed.parentId !== null && absorbed.parentId !== survivor.id) {
    unlinkChild(absorbed.parentId, absorbed.id);
  }

  for (const childId of absorbed.children) {
    if (!survivor.children.includes(childId)) {
      survivor.children.push(childId);
      survivor.linkLastUsedAt.set(getLinkKey(survivor.id, childId), state.now);
      survivor.linkBirthAt.set(getLinkKey(survivor.id, childId), state.now);
    }
    const child = state.bases.find((b) => b.id === childId);
    if (child && child.parentId === absorbed.id) {
      child.parentId = survivor.id;
    }
  }

  makeVehiclesFall((v) => v.parentId === absorbed.id || v.childId === absorbed.id);

  survivor.x = (survivor.x + absorbed.x) * 0.5;
  survivor.y = (survivor.y + absorbed.y) * 0.5;
  survivor.cityScale = Math.min(2.7, (survivor.cityScale || 1) + 0.42);
  survivor.fragility = Math.min(1.2, (survivor.fragility || 0) + 0.32);
  survivor.mergeCooldownUntil = state.now + 1.2;

  for (const [pointerId, aim] of state.aimings.entries()) {
    if (aim.baseId === absorbed.id) {
      aim.baseId = survivor.id;
      aim.owner = survivor.owner;
      state.aimings.set(pointerId, aim);
    }
  }

  addEventBurst(survivor.x, survivor.y, survivor.owner, "merge");
  playSfxBuild(survivor.owner);
  state.bases = state.bases.filter((b) => b.id !== absorbed.id);
}

function updateStrategy(dt) {
  for (const owner of [1, 2]) {
    const stat = playerStat(owner);
    const ownedBaseCount = state.bases.filter((b) => b.owner === owner).length;

    stat.heat = Math.max(0, stat.heat - dt * HEAT_DECAY_PER_SEC);

    if (stat.heat < 1.05 && ownedBaseCount > 0) {
      stat.stability = Math.min(
        STABILITY_MAX,
        stat.stability + dt * (STABILITY_GAIN_PER_SEC + Math.min(0.08, ownedBaseCount * 0.008)),
      );
    } else {
      stat.stability = Math.max(0, stat.stability - dt * (0.14 + getOverload(owner) * 0.2));
    }
  }
}

function resetDistrictState() {
  state.baseIdCounter = 1;
  state.districtTimeLeft = activeDistrict().matchSeconds;
  state.bases = [];
  state.aimings = new Map();
  state.fxTrails = [];
  state.vehicles = [];
  state.fallingVehicles = [];
  state.pressBursts = [];
  state.eventBursts = [];
  state.playerStats[1].heat = 0;
  state.playerStats[1].stability = 0;
  state.playerStats[2].heat = 0;
  state.playerStats[2].stability = 0;
  state.winner = null;

  const edgeGap = Math.max(state.baseRadius * BASE_SIZE_MULT * 1.45, Math.min(state.w, state.h) * 0.035);
  const leftX = edgeGap;
  const rightX = state.w - edgeGap;
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
    "Si tu t etends trop vite: embouteillages, permis refuses, routes fragiles. " +
    "Si tu construis calmement: ton reseau devient solide et finit par gagner.";
  startBtn.textContent = "Lancer le district";
  nextBtn.classList.add("hidden");
  updateLabels();
  startDistrict();
}

canvas.addEventListener("pointerdown", (evt) => {
  if (!state.running) return;

  ensureAudio();

  const p = pointFromEvent(evt);

  let chosen = null;
  for (const b of state.bases) {
    if (distance({ x: p.x, y: p.y }, b) <= baseVisualRadius(b) * 1.5) {
      chosen = b;
      break;
    }
  }

  if (!chosen) return;

  state.pressBursts.push({
    x: chosen.x,
    y: chosen.y,
    owner: chosen.owner,
    r: baseVisualRadius(chosen) * 0.5,
    life: 0.45,
  });
  playSfxPress(chosen.owner);

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
    ctx.fillRect(x + 8, y + 7, w - 16, 6);
  }
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

  }
}

function drawPressBursts(dt) {
  for (const b of state.pressBursts) {
    b.life -= dt;
    b.r += dt * Math.min(state.w, state.h) * 0.45;
    const alpha = Math.max(0, b.life / 0.45);
    const col = b.owner === 1 ? "70,230,255" : "255,150,130";

    ctx.fillStyle = `rgba(${col}, ${0.16 * alpha})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${col}, ${0.9 * alpha})`;
    ctx.lineWidth = Math.max(2, state.baseRadius * 0.28);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  state.pressBursts = state.pressBursts.filter((b) => b.life > 0);
}

function drawEventBursts(dt) {
  for (const b of state.eventBursts) {
    b.life -= dt;
    b.r += dt * Math.min(state.w, state.h) * 0.2;
    const alpha = Math.max(0, b.life / 0.62);
    const col = b.owner === 1 ? "90,230,255" : "255,150,130";

    ctx.strokeStyle = `rgba(${col}, ${0.8 * alpha})`;
    ctx.lineWidth = Math.max(2, state.baseRadius * 0.18);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();

    if (b.kind === "denied") {
      ctx.strokeStyle = `rgba(255, 90, 90, ${0.95 * alpha})`;
      ctx.lineWidth = Math.max(2, state.baseRadius * 0.22);
      ctx.beginPath();
      ctx.moveTo(b.x - b.r * 0.45, b.y - b.r * 0.45);
      ctx.lineTo(b.x + b.r * 0.45, b.y + b.r * 0.45);
      ctx.moveTo(b.x + b.r * 0.45, b.y - b.r * 0.45);
      ctx.lineTo(b.x - b.r * 0.45, b.y + b.r * 0.45);
      ctx.stroke();
    } else if (b.kind === "jam") {
      ctx.fillStyle = `rgba(255, 180, 60, ${0.9 * alpha})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === "merge") {
      ctx.strokeStyle = `rgba(255, 242, 120, ${0.95 * alpha})`;
      ctx.lineWidth = Math.max(2, state.baseRadius * 0.24);
      ctx.beginPath();
      ctx.moveTo(b.x - b.r * 0.45, b.y);
      ctx.lineTo(b.x + b.r * 0.45, b.y);
      ctx.moveTo(b.x, b.y - b.r * 0.45);
      ctx.lineTo(b.x, b.y + b.r * 0.45);
      ctx.stroke();
    }
  }

  state.eventBursts = state.eventBursts.filter((b) => b.life > 0);
}

function drawStrategyMeters() {
  const drawMeter = (owner, x) => {
    const heat = getOverload(owner);
    const stability = getStabilityBonus(owner);
    const y = 62;
    const h = 42;
    const w = 8;

    ctx.fillStyle = "#00000066";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    ctx.fillStyle = "#1a2028";
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = `rgba(255, 92, 92, ${0.75 + heat * 0.2})`;
    const heatH = h * heat;
    ctx.fillRect(x + 1, y + 1, w - 2, Math.max(0, heatH - 1));

    ctx.fillStyle = `rgba(120, 255, 145, ${0.75 + stability * 0.2})`;
    const stH = h * stability;
    ctx.fillRect(x + 1, y + h - stH, w - 2, Math.max(0, stH - 1));
  };

  drawMeter(1, 14);
  drawMeter(2, state.w - 22);
}

function drawLinks() {
  for (const b of state.bases) {
    for (const childId of b.children) {
      const child = state.bases.find((n) => n.id === childId);
      if (!child) continue;
      const linkKey = getLinkKey(b.id, child.id);
      const lastUsed = b.linkLastUsedAt.get(linkKey) ?? state.now;
      const birthAt = b.linkBirthAt.get(linkKey) ?? lastUsed;
      const freshness = Math.max(0, 1 - (state.now - lastUsed) / LINK_IDLE_SECONDS);
      if (freshness <= 0) continue;

      const age = Math.max(0, state.now - birthAt);
      const complexity = Math.min(1, age / 18);
      const dx = child.x - b.x;
      const dy = child.y - b.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const sway = Math.sin(state.now * 0.6 + b.id * 0.7 + child.id * 0.3) * (state.baseRadius * (0.8 + complexity * 2.4));
      const cx = (b.x + child.x) * 0.5 + nx * sway;
      const cy = (b.y + child.y) * 0.5 + ny * sway;

      const roadW = Math.max(3, state.baseRadius * (0.56 + freshness * 0.58));

      // Asphalt body
      ctx.strokeStyle = `rgba(28, 33, 42, ${0.42 + freshness * 0.35})`;
      ctx.lineWidth = roadW * 1.55;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(cx, cy, child.x, child.y);
      ctx.stroke();

      // Inner lane surface
      ctx.strokeStyle = `rgba(46, 58, 73, ${0.45 + freshness * 0.26})`;
      ctx.lineWidth = roadW;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(cx, cy, child.x, child.y);
      ctx.stroke();

      // Owner neon curb
      ctx.strokeStyle =
        b.owner === 1 ? `rgba(116, 222, 248, ${0.25 + freshness * 0.45})` : `rgba(252, 166, 142, ${0.25 + freshness * 0.45})`;
      ctx.lineWidth = Math.max(1.5, roadW * 0.28);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(cx + nx * 2, cy + ny * 2, child.x, child.y);
      ctx.stroke();

      // Urban lane markings
      ctx.strokeStyle = `rgba(238, 232, 188, ${0.2 + freshness * 0.35})`;
      ctx.lineWidth = Math.max(1, roadW * 0.12);
      ctx.setLineDash([6, 7]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(cx, cy, child.x, child.y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (complexity > 0.2) {
        ctx.strokeStyle = b.owner === 1 ? `rgba(105, 204, 230, ${0.18 * complexity})` : `rgba(240, 150, 130, ${0.18 * complexity})`;
        ctx.lineWidth = Math.max(1.2, state.baseRadius * 0.16);
        for (let k = 0; k < 2; k += 1) {
          const t = (k + 1) / 3;
          const px = quadraticAt(t, b.x, cx, child.x);
          const py = quadraticAt(t, b.y, cy, child.y);
          const branch = state.baseRadius * (0.6 + complexity * 1.4);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + nx * branch * (k === 0 ? 1 : -1), py + ny * branch * (k === 0 ? 1 : -1));
          ctx.stroke();
        }
      }
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

    const drawWheels = (x, y, spread) => {
      ctx.fillStyle = "#0e1116";
      ctx.beginPath();
      ctx.arc(x - spread, y + 4, 2.1, 0, Math.PI * 2);
      ctx.arc(x + spread, y + 4, 2.1, 0, Math.PI * 2);
      ctx.fill();
    };

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(heading);

    if (v.kind === "ambulance") {
      ctx.fillStyle = "#f3f9ff";
      ctx.fillRect(-10, -5, 20, 10);
      ctx.fillStyle = "#d84545";
      ctx.fillRect(-2, -3.6, 4, 7.2);
      ctx.fillRect(-4.1, -1.5, 8.2, 3);
      ctx.fillStyle = "#8ee6ff";
      ctx.fillRect(-7, -5.8, 5, 1.5);
      ctx.fillRect(2, -5.8, 5, 1.5);
      drawWheels(0, 0, 6.3);
    } else if (v.kind === "taxi") {
      ctx.fillStyle = "#ffd44c";
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = "#161515";
      for (let i = -7; i <= 5; i += 4) {
        ctx.fillRect(i, -1.4, 2, 2.8);
      }
      ctx.fillStyle = "#fff1a2";
      ctx.fillRect(-2.6, -6.4, 5.2, 1.6);
      drawWheels(0, 0, 5.8);
    } else if (v.kind === "limousine") {
      ctx.fillStyle = "#151823";
      ctx.fillRect(-14, -4.8, 28, 9.6);
      ctx.fillStyle = "#2b3040";
      ctx.fillRect(-8, -3, 16, 6);
      ctx.fillStyle = "#cfd3dc";
      ctx.fillRect(11.2, -0.8, 2, 1.6);
      drawWheels(0, 0, 9.8);
    } else {
      ctx.strokeStyle = "#79f39f";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(-4, 3, 2.1, 0, Math.PI * 2);
      ctx.arc(4, 3, 2.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#79f39f";
      ctx.beginPath();
      ctx.moveTo(-4, 3);
      ctx.lineTo(0, -2.5);
      ctx.lineTo(4, 3);
      ctx.stroke();
      ctx.fillStyle = "#c6ffd8";
      ctx.beginPath();
      ctx.arc(0, -3.8, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (v.kind !== "velo") {
      ctx.fillStyle = "#11151d";
      ctx.font = "700 7px 'Trebuchet MS'";
      ctx.textAlign = "center";
      ctx.fillText(v.icon, 0, 2.6);
    }

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

    if ((b.fragility || 0) > 0) {
      const f = Math.min(1, b.fragility);
      ctx.strokeStyle = `rgba(255, 120, 120, ${0.35 + f * 0.45})`;
      ctx.lineWidth = Math.max(1.5, state.baseRadius * 0.18);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * (1.1 + f * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
    const control = buildControlPoint(src, aim.x, aim.y, aim.pathPoints, len, angle, aim.owner);

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
  updateSoundtrack();

  if (state.running) {
    updateStrategy(dt);
    updateBaseGrowthAndMerges(dt);
    updateVehicles(dt);

    const p1Alive = state.bases.some((b) => b.owner === 1);
    const p2Alive = state.bases.some((b) => b.owner === 2);
    if (!p1Alive || !p2Alive) {
      finalizeDistrict(!p1Alive ? 2 : !p2Alive ? 1 : null);
    }
  } else {
    updateVehicles(dt);
  }

  drawUrbanBackground();
  drawNoBuildZones();
  drawPressBursts(dt);
  drawEventBursts(dt);
  drawLinks();
  drawShotFx(dt);
  drawVehicles();
  drawBases();
  drawAimPreview();
  drawStrategyMeters();

  requestAnimationFrame(frame);
}

startBtn.addEventListener("click", () => {
  ensureAudio();
  if (startBtn.textContent.includes("Nouvelle saison")) {
    enterFullscreen();
    startSeason();
    return;
  }
  enterFullscreen();
  startDistrict();
});

nextBtn.addEventListener("click", nextDistrict);
restartBtn.addEventListener("click", startSeason);
if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", toggleFullscreen);
}
document.addEventListener("fullscreenchange", updateFullscreenButton);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateLabels();
updateFullscreenButton();
requestAnimationFrame(frame);

