export const STATES = ['repos', 'eveil', 'intervention', 'jugement'];

export const WAKE_DISTANCE = 1.3;
// must stay below the distance reachable from the far wall, otherwise the room
// can never rearm after a wake-up
export const SLEEP_DISTANCE = 2.0;

// Cues of the wake-up timeline, in seconds from the moment the player steps
// into the treatment zone.
export const CUES = [
  { at: 0.0, name: 'lamp_warmup' },
  { at: 0.85, name: 'restraint_servo' },
  { at: 1.7, name: 'diagnostic_start' },
  { at: 3.4, name: 'vent_shift' },
  { at: 4.8, name: 'glass_thud' },
];
const WAKE_DURATION = 5.8;
const JUDGEMENT_PRESENCE_AT = 2.4;

const CHANNELS = ['lamp', 'cove', 'ambient', 'window', 'diagnostic', 'fan', 'restraint'];

// target level per channel, and the time constant used to reach it
const PROFILES = {
  repos: {
    lamp: [0.06, 1.4],
    cove: [0.35, 1.6],
    ambient: [0.22, 1.6],
    window: [0.04, 1.8],
    diagnostic: [0.0, 0.8],
    fan: [0.25, 2.2],
    restraint: [0.0, 0.5],
  },
  intervention: {
    lamp: [1.0, 0.9],
    cove: [0.5, 1.2],
    ambient: [0.3, 1.2],
    window: [0.1, 1.6],
    diagnostic: [0.35, 0.9],
    fan: [0.7, 1.4],
    restraint: [1.0, 0.45],
  },
  jugement: {
    lamp: [0.9, 1.2],
    cove: [0.006, 1.9],
    ambient: [0.012, 1.9],
    window: [0.85, 2.0],
    diagnostic: [0.15, 1.2],
    fan: [0.12, 2.6],
    restraint: [1.0, 0.45],
  },
};

function wakeProfile(t) {
  const p = {
    lamp: [t >= 0 ? Math.min(1, 0.06 + t / 2.4) : 0.06, 0.7],
    cove: [0.45, 1.4],
    ambient: [0.28, 1.4],
    window: [t >= 4.8 ? 0.34 : 0.05, t >= 4.8 ? 0.25 : 1.6],
    diagnostic: [t >= 1.7 ? 1 : 0, 0.35],
    fan: [t >= 3.4 ? 0.7 : t >= 0 ? 0.45 : 0.25, 1.1],
    restraint: [t >= 0.85 ? 1 : 0, 0.45],
  };
  return p;
}

function approach(current, target, tau, dt) {
  if (tau <= 0) return target;
  const k = 1 - Math.exp(-dt / tau);
  return current + (target - current) * k;
}

export function createSequence(initial = 'repos') {
  const levels = {};
  for (const c of CHANNELS) levels[c] = PROFILES.repos[c][0];
  let state = initial;
  let phase = 0;
  let fired = new Set();
  let armed = true;

  function enter(next) {
    if (next === state) return;
    state = next;
    phase = 0;
    fired = new Set();
  }

  function update(dt, input = {}) {
    const step = Math.min(0.1, Math.max(0, dt));
    const distance = typeof input.distance === 'number' ? input.distance : Infinity;
    const events = [];

    if (state === 'repos') {
      if (distance > SLEEP_DISTANCE) armed = true;
      if (armed && distance <= WAKE_DISTANCE) {
        armed = false;
        enter('eveil');
        events.push('wake');
      }
    }

    phase += step;

    let profile;
    if (state === 'eveil') {
      for (const cue of CUES) {
        if (phase >= cue.at && !fired.has(cue.name)) {
          fired.add(cue.name);
          events.push(cue.name);
        }
      }
      profile = wakeProfile(phase);
      if (phase >= WAKE_DURATION) {
        enter('intervention');
        profile = PROFILES.intervention;
      }
    } else {
      if (state === 'jugement' && phase >= JUDGEMENT_PRESENCE_AT && !fired.has('presence')) {
        fired.add('presence');
        events.push('presence');
      }
      profile = PROFILES[state];
    }

    for (const c of CHANNELS) {
      const [target, tau] = profile[c];
      levels[c] = approach(levels[c], target, tau, step);
    }

    return { state, levels, events };
  }

  return {
    update,
    setState: (next) => {
      if (!STATES.includes(next)) return;
      if (next === 'repos') armed = false;
      enter(next);
    },
    get state() {
      return state;
    },
    get levels() {
      return levels;
    },
  };
}
