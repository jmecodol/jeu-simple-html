import { state } from "./state.js";

// ── Public API ────────────────────────────────────────────────────────────────

export function unlockAudio() {
  state.audioUnlocked = true;
  if (state.audioCtx && state.audioCtx.state === "suspended") {
    state.audioCtx.resume().catch(() => {});
  }
}

export function playBonusPickup() {
  if (!state.audioUnlocked) return;
  try {
    const ac = _ctx();
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.3, now + 0.06);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.95);

    const oscA = ac.createOscillator();
    const oscB = ac.createOscillator();
    oscA.type = "sawtooth";
    oscB.type = "triangle";
    oscB.detune.setValueAtTime(-7, now);

    const melody = [
      [392, 0.0],
      [494, 0.14],
      [466, 0.28],
      [587, 0.44],
      [523, 0.62],
    ];
    for (const [f, t] of melody) {
      oscA.frequency.setValueAtTime(f, now + t);
      oscB.frequency.setValueAtTime(f * 0.5, now + t);
    }

    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(6.5, now);
    lfoGain.gain.setValueAtTime(18, now);
    lfo.connect(lfoGain);
    lfoGain.connect(oscA.frequency);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(master);
    master.connect(ac.destination);

    oscA.start(now);
    oscB.start(now);
    lfo.start(now);
    oscA.stop(now + 0.95);
    oscB.stop(now + 0.95);
    lfo.stop(now + 0.95);
  } catch (_) {}
}

export function playExplosion() {
  if (!state.audioUnlocked) return;
  try {
    const ac = _ctx();
    const bufferSize = ac.sampleRate * 0.45;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.15);
    }
    const source = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, ac.currentTime);
    filter.frequency.exponentialRampToValueAtTime(70, ac.currentTime + 0.45);
    gain.gain.setValueAtTime(1.5, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.45);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    source.start();
  } catch (_) {}
}

export function playShot(type = "normal") {
  if (!state.audioUnlocked) return;
  try {
    const ac = _ctx();
    const now = ac.currentTime;

    if (type === "laser") {
      const main = ac.createOscillator();
      const body = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();

      main.type = "sawtooth";
      body.type = "triangle";
      main.frequency.setValueAtTime(980, now);
      main.frequency.exponentialRampToValueAtTime(260, now + 0.14);
      body.frequency.setValueAtTime(510, now);
      body.frequency.exponentialRampToValueAtTime(180, now + 0.14);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1450, now);
      filter.Q.setValueAtTime(7.5, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.19, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      main.connect(filter);
      body.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);

      main.start(now);
      body.start(now);
      main.stop(now + 0.14);
      body.stop(now + 0.14);
      return;
    }

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (_) {}
}

// ── Private ───────────────────────────────────────────────────────────────────

function _ctx() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}
