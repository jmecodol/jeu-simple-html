import { state } from "./state.js";
import { createShip, clampX, clampY, resize, showMenu, startGame, consumeShipModel } from "./game.js";
import { unlockAudio } from "./audio.js";

const TOUCH_AHEAD_OFFSET = 78;
const DECK_CARD_W = 42;
const DECK_CARD_H = 42;
const DECK_CARD_GAP = 8;

function getForwardTouchY(y, team) {
  const dir = team === "bottom" ? -1 : 1;
  return clampY(y + dir * TOUCH_AHEAD_OFFSET);
}

function getDeckPreviewConfig(team, canvas) {
  if (team === "top") {
    return { x: 14, y: canvas.height * 0.25, align: "left" };
  }
  if (team === "bottom") {
    return { x: canvas.width - 14, y: canvas.height * 0.75, align: "right" };
  }
  return { x: 14, y: canvas.height * 0.5, align: "left" };
}

function getPreferredShipModelAtPoint(x, y, team, canvas) {
  const deck = state.shipDecks[team] || [];
  const previewCount = Math.min(3, deck.length);
  if (previewCount === 0) return null;

  const cfg = getDeckPreviewConfig(team, canvas);
  const totalH = DECK_CARD_H * 3 + DECK_CARD_GAP * 2;
  const startY = cfg.y - totalH / 2;

  for (let i = 0; i < previewCount; i++) {
    const cardY = startY + i * (DECK_CARD_H + DECK_CARD_GAP);
    const cardX = cfg.align === "left" ? cfg.x : cfg.x - DECK_CARD_W;
    const isInside =
      x >= cardX &&
      x <= cardX + DECK_CARD_W &&
      y >= cardY &&
      y <= cardY + DECK_CARD_H;

    if (isInside) return deck[i];
  }

  return null;
}

export function setupInput() {
  const canvas = state.canvas;

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    unlockAudio();
    const isPlaying = state.gameMode === "pvp"
      ? state.gamePhase === "playing"
      : state.coopWavePhase === "playing";
    if (state.gameMode === null || !isPlaying) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const team = state.gameMode === "coop"
      ? "player"
      : (y < canvas.height / 2 ? "top" : "bottom");

    const shipId = `touch_${e.pointerId}`;
    if (state.ships.has(shipId)) return;

    const preferredModel = getPreferredShipModelAtPoint(x, y, team, canvas);
    const model = consumeShipModel(team, preferredModel);
    if (!model) return;

    const ship = createShip(shipId, team, x, getForwardTouchY(y, team));
    ship.model = model;
    ship.lastFire = performance.now();
    state.ships.set(shipId, ship);
    state.pointerToShip.set(e.pointerId, shipId);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    e.preventDefault();
    const shipId = state.pointerToShip.get(e.pointerId);
    if (!shipId) return;
    const ship = state.ships.get(shipId);
    if (!ship) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ship.x = clampX((e.clientX - rect.left) * scaleX);
    ship.y = getForwardTouchY((e.clientY - rect.top) * scaleY, ship.team);
  });

  function releasePointer(e) {
    const shipId = state.pointerToShip.get(e.pointerId);
    if (shipId) {
      state.ships.delete(shipId);
      state.pointerToShip.delete(e.pointerId);
    }
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  window.addEventListener("resize", resize);

  document.getElementById("btnPvp").addEventListener("click", () => startGame("pvp"));
  document.getElementById("btnCoop").addEventListener("click", () => startGame("coop"));
  document.getElementById("replayButton").addEventListener("click", showMenu);
}
