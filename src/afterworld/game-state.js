export const LANES = [-2.6, 0, 2.6];

export const HELL = {
  length: 380,
  speed: 12,
  checkpoints: [0, 140, 270],
  obstacles: [
    { id: 'learn-jump', kind: 'hurdle', distance: 32, lanes: [0, 1, 2] },
    { id: 'learn-slide', kind: 'overhead', distance: 63, lanes: [0, 1, 2] },
    { id: 'choose-left', kind: 'block', distance: 94, lanes: [1, 2] },
    { id: 'rhythm-jump', kind: 'hurdle', distance: 116, lanes: [0, 1, 2] },
    { id: 'shift-right', kind: 'block', distance: 165, lanes: [0, 1] },
    { id: 'press-one', kind: 'press', distance: 191, lanes: [1] },
    { id: 'rhythm-slide', kind: 'overhead', distance: 210, lanes: [0, 1, 2] },
    { id: 'rhythm-block', kind: 'block', distance: 240, lanes: [1, 2] },
    { id: 'last-jump', kind: 'hurdle', distance: 294, lanes: [0, 1, 2] },
    { id: 'last-slide', kind: 'overhead', distance: 324, lanes: [0, 1, 2] },
    { id: 'press-two', kind: 'press', distance: 348, lanes: [0, 1] },
  ],
};

export const HEAVEN = {
  islands: [
    { id: 'arrival', x: 0, z: 0, y: 0, width: 14, length: 28, pad: [-3, 0, -10], spawn: [0, 1.4, 7] },
    { id: 'garden', x: -6, z: -43, y: 1, width: 13, length: 20, pad: [-6, 1, -49], spawn: [-6, 2.4, -38] },
    { id: 'canopy', x: 6, z: -83, y: 3, width: 13, length: 20, pad: [6, 3, -89], spawn: [6, 4.4, -78] },
    { id: 'terrace', x: -5, z: -123, y: 2, width: 13, length: 20, pad: [-5, 2, -129], spawn: [-5, 3.4, -118] },
    { id: 'exit', x: 0, z: -165, y: 0, width: 18, length: 30, pad: null, spawn: [0, 1.4, -156] },
  ],
  exit: [0, 0, -175],
};

export function clamp(n, low, high) {
  return Math.min(high, Math.max(low, n));
}

export function advanceFlight(flight, input, delta) {
  const dt = Math.min(Math.max(delta, 0), 1 / 30);
  const desired = input.dive ? -0.6 : input.flare ? 0.38 : -0.12;
  const pitch = flight.pitch + (desired - flight.pitch) * (1 - Math.exp(-4 * dt));
  const speed = clamp(flight.speed + (-9.81 * Math.sin(pitch) - 0.012 * flight.speed * flight.speed) * dt, 3.5, 24);
  const stall = Math.max(0, 7 - speed) * 0.9;
  const vx = flight.vx + ((input.steer ?? 0) * 7 - flight.vx) * (1 - Math.exp(-5 * dt));
  return { speed, pitch, vx, vy: Math.sin(pitch) * speed - 0.8 - stall, vz: -Math.cos(pitch) * speed };
}

export function pressPhase(time, offset = 0) {
  const phase = ((time + offset) % 3.8 + 3.8) % 3.8;
  return phase < 1.5 ? 'open' : phase < 2.2 ? 'warning' : phase < 2.8 ? 'closed' : 'opening';
}

export function createRun(mode) {
  return {
    mode,
    status: 'ready',
    elapsed: 0,
    checkpoint: 0,
    energy: 0,
    combo: 0,
    deaths: 0,
    lane: 1,
    collected: new Set(),
    armedPads: new Set(),
    events: [],
    finish: false,
    sliding: false,
    gliding: false,
    flightSpeed: 0,
    flight: { speed: 9, pitch: -0.12, vx: 0, vy: -1.88, vz: -8.94 },
    jumpBuffer: 0,
    coyote: 0,
    jumpHeld: false,
    jumpCut: false,
    slideLeft: 0,
    slideCooldown: 0,
    laneCooldown: 0,
    previousY: 0,
    previousZ: 0,
    grounded: true,
    previousGrounded: false,
    motion: 'idle',
    jumpSent: false,
    jumpPressTime: -100,
    checkpointEnergy: 0,
    checkpointCollected: new Set(),
    lastImpact: 0,
    warningPhases: new Set(),
    pressOccupancy: new Set(),
    hitLabel: '',
  };
}

export function restartRun(run, mode = run?.mode || 'hell') {
  return createRun(mode);
}

export function collectEnergy(run, id) {
  if (run.collected.has(id)) return false;
  run.collected.add(id);
  run.energy += 1;
  run.combo += 1;
  run.events.push({ type: 'collect', id, energy: run.energy });
  return true;
}

export function armPad(run, id) {
  if (run.armedPads.has(id)) return false;
  run.armedPads.add(id);
  return true;
}

export function triggerPad(run, id, { heightAboveSurface, grounded, fromAbove }) {
  if (!grounded || !fromAbove || heightAboveSurface < 0.25) return false;
  return armPad(run, id);
}

export function disarmPad(run, id) {
  run.armedPads.delete(id);
}

export function landAtIsland(run, islandIndex, cameFromAbove) {
  if (!cameFromAbove || islandIndex <= run.checkpoint) return false;
  run.checkpoint = islandIndex;
  run.checkpointEnergy = run.energy;
  run.checkpointCollected = new Set(run.collected);
  run.events.push({ type: 'checkpoint', id: HEAVEN.islands[islandIndex].id });
  return true;
}

export function resumeFromCheckpoint(run) {
  if (run.mode === 'hell') return run.checkpoint || 0;
  run.energy = run.checkpointEnergy;
  run.combo = 0;
  run.collected = new Set(run.checkpointCollected);
  return HEAVEN.islands[run.checkpoint].spawn;
}
