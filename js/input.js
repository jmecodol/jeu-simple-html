import { state } from "./state.js";
import { createShip, clampX, clampY, resize, showMenu, startGame, consumeShipModel } from "./game.js";
import { unlockAudio } from "./audio.js";

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

    const model = consumeShipModel(team);
    if (!model) return;

    const ship = createShip(shipId, team, x, y);
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
    ship.y = clampY((e.clientY - rect.top) * scaleY);
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
