// ── Ship & physics ──────────────────────────────────────────────────────────
export const SHIP_SIZE = 36;
export const BASE_BULLET_SPEED = 520;
export const BULLET_RADIUS = 6;
export const SHIP_HIT_RADIUS = 34;
export const BASE_FIRE_INTERVAL = 190;
export const MAX_HEAT = 100;
export const SHOT_HEAT = 18;
export const COOL_RATE = 34;
export const HEAT_RECOVERY_LEVEL = 35;
export const TOUCH_AHEAD_OFFSET = 78;

// ── PvP ──────────────────────────────────────────────────────────────────────
export const WIN_MILESTONE = 10;
export const LEVELS_TO_WIN = 3;
export const LEVEL_END_DURATION = 2800;
export const TOP_COLOR = "#7bdff2";
export const BOTTOM_COLOR = "#ff9f68";

// ── Coop ─────────────────────────────────────────────────────────────────────
export const COOP_ENEMY_COLOR = "#ff4455";
export const COOP_WAVES_TO_WIN = 5;
export const COOP_WAVE_END_DURATION = 3000;
export const COOP_ENEMY_SPAWN_INTERVAL = 900;
export const COOP_ENEMY_BASE_MOVE_SPEED = 75;
export const COOP_ENEMY_FIRE_RATE_MULTIPLIER = 0.55;
export const COOP_ENEMY_BASE_HP = 6;
export const COOP_ENEMY_HP_PER_WAVE = 2;
export const COOP_MAX_PLAYER_DEATHS = 10;

// ── Campaign ─────────────────────────────────────────────────────────────────
export const CAMPAIGN_BOSS_SPAWN_DELAY_MS = 60000;
export const CAMPAIGN_ENEMY_SPAWN_INTERVAL = 850;
export const CAMPAIGN_MAX_PLAYER_DEATHS = 8;
export const CAMPAIGN_BOSS_COUNT = 2;
export const CAMPAIGN_BOSS_HP_MULTIPLIER = 2;
export const CAMPAIGN_BOSS_HP_BAR_WIDTH_MULTIPLIER = 2;

// ── Bonus pills ───────────────────────────────────────────────────────────────
export const BONUS_PILL_RADIUS = 14;
export const BONUS_PILL_SPEED = 65;
export const BONUS_PILL_LIFE = 9000;
export const MAX_BONUS_PILLS = 6;
export const BONUS_SPAWN_INTERVAL = 2750;

export const BONUS_TYPES = [
  "ring", "rapid", "triple", "scatter", "burst", "nova", "quake", "magnet",
];

export const BONUS_COLORS = {
  ring:     "#cc44ff",
  rapid:    "#ffdd00",
  triple:   "#44ff88",
  scatter:  "#ff6644",
  burst:    "#ff44ff",
  nova:     "#ff8800",
  quake:    "#ff5566",
  magnet:   "#66e0ff",
};

export const BONUS_ICONS = {
  ring:     "RG",
  rapid:    "2X",
  triple:   "3",
  scatter:  "5",
  burst:    "4",
  nova:     "NV",
  quake:    "QK",
  magnet:   "MGN",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the vertical firing direction (+1 down, -1 up) for a team. */
export function teamDir(team) {
  if (team === "bottom") return -1;
  return 1; // "top", "player", "enemy"
}
