import { BONUS_SPAWN_INTERVAL } from "./constants.js";

/**
 * Single shared mutable state object.
 * Every module imports this and reads/writes its properties directly.
 */
export const state = {
  // Canvas — set by main.js after DOM is ready
  canvas: null,
  ctx: null,
  flashOverlay: null,

  // Live game entities
  ships: new Map(),
  bullets: [],
  activeLasers: [],
  explosions: [],
  bonusPills: [],
  pointerToShip: new Map(),
  shipDecks: {
    top: [],
    bottom: [],
    player: [],
  },

  bonusSpawnTimer: BONUS_SPAWN_INTERVAL,

  // ── Game mode ──────────────────────────────────────────────────────────────
  // null = menu  |  "pvp" = duel  |  "coop" = team vs enemies
  gameMode: null,

  // ── PvP state ──────────────────────────────────────────────────────────────
  teamWins: { top: 0, bottom: 0 },
  levelWins: { top: 0, bottom: 0 },
  currentLevel: 1,
  // "playing" | "levelEnd" | "matchEnd"
  gamePhase: "playing",
  levelEndWinner: null,
  levelEndTimer: 0,

  // ── Coop state ─────────────────────────────────────────────────────────────
  coopWave: 0,
  coopKills: 0,
  coopPlayerDeaths: 0,
  coopVictory: false,
  // "playing" | "waveEnd" | "matchEnd"
  coopWavePhase: "playing",
  coopWaveEndTimer: 0,
  coopEnemySpawnList: [],
  coopEnemySpawnTimer: 0,
  coopEnemyIdCounter: 0,

  // ── Misc ───────────────────────────────────────────────────────────────────
  lastTime: 0,
  audioCtx: null,
  audioUnlocked: false,
  flashTimeout: null,
};
