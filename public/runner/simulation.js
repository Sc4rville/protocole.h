export const LANES = [-3.2, 0, 3.2];
export const STEP = 1 / 60;
export const RULES = {
  hell: { speed: 23, length: 920, gravity: 36, jumpSpeed: 18 },
  heaven: { speed: 18, length: 720, gravity: 36, jumpSpeed: 18 },
};

const HELL_OBSTACLES = [
  { at: 70, lane: 1, kind: 'barrier' },
  { at: 145, lane: 1, kind: 'overhead' },
  { at: 220, lane: 0, kind: 'block' },
  { at: 220, lane: 2, kind: 'block' },
  { at: 285, lane: 1, kind: 'barrier' },
  { at: 355, lane: 0, kind: 'overhead' },
  { at: 355, lane: 1, kind: 'block' },
  { at: 465, lane: 2, kind: 'barrier' },
  { at: 465, lane: 1, kind: 'overhead' },
  { at: 560, lane: 1, kind: 'press' },
  { at: 650, lane: 0, kind: 'block' },
  { at: 650, lane: 1, kind: 'barrier' },
  { at: 740, lane: 2, kind: 'overhead' },
  { at: 820, lane: 1, kind: 'barrier' },
  { at: 820, lane: 0, kind: 'block' },
];

const HELL_CHECKPOINT = 400;

const HEAVEN_ISLANDS = [
  [0, 110],
  [155, 255],
  [305, 415],
  [465, 575],
  [625, 740],
];

const HEAVEN_PADS = [95, 240, 400, 560];

const HEAVEN_ENERGY = [
  { id: 'e0', at: 125, lane: 1, y: 4 },
  { id: 'e1', at: 135, lane: 1, y: 4 },
  { id: 'e2', at: 145, lane: 1, y: 4 },
  { id: 'e3', at: 270, lane: 1, y: 4 },
  { id: 'e4', at: 280, lane: 1, y: 4 },
  { id: 'e5', at: 290, lane: 1, y: 4 },
  { id: 'e6', at: 272, lane: 0, y: 4 },
  { id: 'e7', at: 282, lane: 0, y: 4 },
  { id: 'e8', at: 292, lane: 0, y: 4 },
  { id: 'e9', at: 430, lane: 1, y: 4 },
  { id: 'e10', at: 440, lane: 1, y: 4 },
  { id: 'e11', at: 450, lane: 1, y: 4 },
  { id: 'e12', at: 432, lane: 2, y: 4 },
  { id: 'e13', at: 442, lane: 2, y: 4 },
  { id: 'e14', at: 452, lane: 2, y: 4 },
  { id: 'e15', at: 590, lane: 1, y: 4 },
  { id: 'e16', at: 600, lane: 1, y: 4 },
  { id: 'e17', at: 610, lane: 1, y: 4 },
];

const HEAVEN_CHECKPOINTS = [155, 305, 465, 625];
const PRESS = { period: 3.6, lethalFrom: 2.4 };

export function getCourse(mode) {
  if (mode === 'hell') {
    return {
      length: RULES.hell.length,
      obstacles: HELL_OBSTACLES,
      checkpoint: HELL_CHECKPOINT,
      press: PRESS,
    };
  }
  return {
    length: RULES.heaven.length,
    islands: HEAVEN_ISLANDS,
    pads: HEAVEN_PADS,
    energy: HEAVEN_ENERGY,
    checkpoints: HEAVEN_CHECKPOINTS,
  };
}

export function getSurface(mode, distance, lane) {
  if (mode === 'hell') {
    return 0;
  }
  for (const [start, end] of HEAVEN_ISLANDS) {
    if (distance >= start && distance <= end) {
      return 0;
    }
  }
  return null;
}

function saveCheckpoint(state, respawnDistance) {
  state.checkpoint = respawnDistance;
  state.savedCheckpoint = {
    distance: respawnDistance,
    energy: state.energy,
    combo: state.combo,
    bestCombo: state.bestCombo,
    consumed: [...state.consumed],
  };
}

export function createRun(mode) {
  return {
    mode,
    status: 'ready',
    distance: 0,
    elapsed: 0,
    x: LANES[1],
    lane: 1,
    y: 0,
    vy: 0,
    slideLeft: 0,
    shield: false,
    deaths: 0,
    checkpoint: 0,
    energy: 0,
    combo: 0,
    bestCombo: 0,
    gliding: false,
    grounded: true,
    bounceFlash: 0,
    heldJump: false,
    jumpBuffer: 0,
    lastBounce: 0,
    deadTimer: 0,
    consumed: new Set(),
    savedCheckpoint: { distance: 8, energy: 0, combo: 0, bestCombo: 0, consumed: [] },
  };
}

export function restartRun(state, fromCheckpoint = false) {
  const snap = fromCheckpoint ? state.savedCheckpoint : null;
  state.distance = snap ? snap.distance : 0;
  state.x = LANES[1];
  state.lane = 1;
  state.y = 0;
  state.vy = 0;
  state.slideLeft = 0;
  state.gliding = false;
  state.grounded = true;
  state.bounceFlash = 0;
  state.heldJump = false;
  state.jumpBuffer = 0;
  state.lastBounce = 0;
  state.deadTimer = 0;
  state.elapsed = 0;
  state.shield = false;
  if (snap) {
    state.energy = snap.energy;
    state.combo = state.mode === 'heaven' ? 0 : snap.combo;
    state.bestCombo = snap.bestCombo;
    state.consumed = new Set(snap.consumed);
    state.checkpoint = snap.distance;
  } else {
    state.deaths = 0;
    state.checkpoint = 0;
    state.energy = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.consumed = new Set();
    state.savedCheckpoint = {
      distance: 8,
      energy: 0,
      combo: 0,
      bestCombo: 0,
      consumed: [],
    };
  }
  state.status = 'running';
}

function die(state) {
  state.status = 'dead';
  if (state.mode === 'hell') {
    state.deaths += 1;
  }
  state.deadTimer = state.mode === 'heaven' ? 0.35 : 0;
}

export function stepRun(state, input, dt) {
  if (state.status === 'dead') {
    if (state.mode === 'heaven') {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) {
        restartRun(state, true);
      }
    }
    return;
  }
  if (state.status !== 'running') {
    return;
  }

  const rules = RULES[state.mode];
  const prev = state.distance;
  state.distance += rules.speed * dt;
  state.elapsed += dt;

  if (input.left && state.lane > 0) {
    state.lane -= 1;
  }
  if (input.right && state.lane < 2) {
    state.lane += 1;
  }
  state.x += (LANES[state.lane] - state.x) * (1 - Math.exp(-18 * dt));

  if (input.jump) {
    state.jumpBuffer = 0.1;
  } else {
    state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
  }

  if (
    input.slide &&
    state.mode === 'hell' &&
    state.grounded &&
    state.slideLeft <= 0
  ) {
    state.slideLeft = 0.65;
  }
  state.slideLeft = Math.max(0, state.slideLeft - dt);

  const surface = getSurface(state.mode, state.distance, state.lane);

  if (state.grounded) {
    if (surface === null) {
      state.grounded = false;
    } else if (state.jumpBuffer > 0) {
      state.vy = rules.jumpSpeed;
      state.grounded = false;
      state.jumpBuffer = 0;
    }
  }

  if (!state.grounded) {
    const glide = state.mode === 'heaven' && input.heldJump && state.vy < 0;
    state.gliding = glide;
    state.vy -= (glide ? 8 : rules.gravity) * dt;
    if (glide) {
      state.vy = Math.max(state.vy, -1.8);
    }
    const previousY = state.y;
    state.y += state.vy * dt;
    if (
      surface !== null &&
      previousY >= 0 &&
      state.y <= 0 &&
      state.vy <= 0
    ) {
      state.y = 0;
      state.vy = 0;
      state.grounded = true;
      state.gliding = false;
    }
  } else {
    state.gliding = false;
  }

  state.bounceFlash = Math.max(0, state.bounceFlash - dt);

  if (state.mode === 'heaven') {
    for (const pad of HEAVEN_PADS) {
      if (
        prev < pad &&
        state.distance >= pad &&
        state.y >= 0 &&
        state.y < 1 &&
        state.vy <= 0
      ) {
        state.vy = 21;
        state.grounded = false;
        state.bounceFlash = 0.25;
        state.lastBounce = pad;
        const key = `pad:${pad}`;
        if (!state.consumed.has(key)) {
          state.consumed.add(key);
          state.energy += 1;
        }
      }
    }

    for (const start of HEAVEN_CHECKPOINTS) {
      if (prev < start && state.distance >= start && state.y >= 0) {
        saveCheckpoint(state, start + 8);
      }
    }

    for (const p of HEAVEN_ENERGY) {
      if (
        !state.consumed.has(p.id) &&
        prev <= p.at + 1.5 &&
        state.distance >= p.at - 1.5 &&
        Math.abs(state.x - LANES[p.lane]) < 1.5 &&
        Math.abs(state.y + 1.1 - p.y) < 1.5
      ) {
        state.consumed.add(p.id);
        state.energy += 1;
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
      }
    }

    if (state.y < -10) {
      die(state);
      return;
    }
  } else {
    if (prev < HELL_CHECKPOINT && state.distance >= HELL_CHECKPOINT) {
      saveCheckpoint(state, HELL_CHECKPOINT);
    }

    for (const ob of HELL_OBSTACLES) {
      if (prev <= ob.at + 1 && state.distance >= ob.at - 1) {
        if (Math.abs(state.x - LANES[ob.lane]) < 0.9) {
          const height = state.slideLeft > 0 ? 0.7 : 2.2;
          let hit = false;
          if (ob.kind === 'barrier' && state.y < 1.25) {
            hit = true;
          } else if (
            ob.kind === 'overhead' &&
            state.y + height > 1.15 &&
            state.y < 3.0
          ) {
            hit = true;
          } else if (ob.kind === 'block' && state.y < 6) {
            hit = true;
          } else if (
            ob.kind === 'press' &&
            state.elapsed % PRESS.period >= PRESS.lethalFrom
          ) {
            hit = true;
          }
          if (hit) {
            die(state);
            return;
          }
        }
      }
    }
  }

  if (
    state.distance >= rules.length &&
    (state.mode === 'hell' || (surface !== null && state.y >= 0))
  ) {
    state.status = 'won';
  }
}
