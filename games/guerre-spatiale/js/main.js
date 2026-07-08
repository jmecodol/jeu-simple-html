/**
 * main.js — entry point
 *
 * Initialises the canvas + flash overlay in the shared state,
 * wires up input, and starts the game loop.
 *
 * ES modules are deferred by default, so the DOM is ready when this runs.
 */

import { state } from "./state.js";
import { showMenu, gameLoop } from "./game.js";
import { setupInput } from "./input.js";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

state.canvas = document.getElementById("gameCanvas");
state.ctx = state.canvas.getContext("2d");

state.flashOverlay = document.createElement("div");
state.flashOverlay.style.cssText =
  "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;z-index:10;";
document.body.appendChild(state.flashOverlay);

setupInput();
showMenu();
requestAnimationFrame(gameLoop);
