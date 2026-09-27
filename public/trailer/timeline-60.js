// protocole.h — 60-second social cut (LinkedIn). Same room, same Unit H, same
// sound bank as timeline.js; only the edit changes. Load it with ?cut=60.
//
// Built for a feed that autoplays muted: a hook in the first frame, big type,
// every line subtitled, the title before the viewer scrolls away.
//
// The theme is edited on its own grid (122 bpm, 8-bar phrases at song
// 63.04 / 78.78 / 94.52 / 110.25 / 125.99):
//   0.00  cold open        Unit H's eyes, "Can you hear me?" (no music)
//   3.00  song 63.04       the lift — the premise, Unit H, the method
//  18.74  song 94.52       the drop — straight into the acts (phrase 78.78 skipped)
//  34.48  song 110.25      what it costs, the montage
//  50.21  song 125.99      breakdown — black, the question, the title
import { ROBOT } from './timeline.js';

export { ROBOT };
export const DURATION = 60;
export const FPS = 24;
export const LOOK = 'social';

const B = 60 / 122; // one beat
const r = (v) => Math.round(v * 1000) / 1000;
const LIFT = 3.0; // song 63.04
const DROP = r(LIFT + 32 * B); // 18.738, song 94.52
const bar = (n) => r(LIFT + n * 4 * B); // act 1, in bars
const d = (n) => r(DROP + n * B); // acts, in beats from the drop
const p = (n) => r(DROP + (32 + n) * B); // second phrase, in beats
const BREAK = p(32); // 50.213, song 125.99
const TITLE = r(BREAK + 8 * B); // 54.148, two bars into the breakdown

// whoosh_reverse_01 peaks 4.95 s into the file; near t=0 it starts part-way in
const swell = (hit, gain) => {
  const at = r(hit - 4.95);
  return at >= 0
    ? { sample: 'impacts/whoosh_reverse_01', at, gain, cut: 5.0 }
    : { sample: 'impacts/whoosh_reverse_01', at: 0, offset: -at, gain, cut: r(hit + 0.05), fadeIn: 0.3 };
};

export const MUSIC = {
  file: '../intro/theme/theme-song.mp3',
  gain: 0.8,
  segments: [
    { at: r(LIFT - 4 * B), from: 61.073, until: DROP, fadeIn: 1.4, fadeOut: 0.02 },
    { at: DROP, from: 94.515, until: DURATION, fadeIn: 0.02, fadeOut: 1.8 },
  ],
};

const HEAD = [0, 1.6, -0.26];
const CHEST = [0, 1.12, -0.3];
const PORT = [-0.13, 1.08, -0.14];
const PORT_UP = [-0.08, 1.24, -0.02];
const CUFF = [-0.55, 1.02, 0.28];
const TRAY = [2.1, 0.95, -1.3];
const WINDOW = [-0.15, 1.62, -3.7];
const DOOR_READER = [3.1, 1.3, 1.9];
const LAMP = [0, 2.0, 0.35];

// the long moves of the full trailer, shortened to fit a faster cut
const part = (a, b, k) => a.map((v, i) => r(v + (b[i] - v) * k));

// ---------------------------------------------------------------- shots
export const SHOTS = [
  // ---- cold open · the eyes open --------------------------------------
  { id: 'open', start: 0, end: 2.35,
    cam: { from: [0.06, 1.635, 0.42], to: [0.03, 1.625, 0.3], look: HEAD, fov: 16, ease: 'out' },
    scene: { state: 'jugement', robot: true, pose: 'assis', look: [0.05, 0.12] } },

  // ---- act 1 · the lift ------------------------------------------------
  { id: 'cove', start: bar(0), end: bar(2),
    cam: { from: [-2.4, 2.6, 2.9], to: part([-2.4, 2.6, 2.9], [-1.6, 2.5, 1.6], 0.6), look: [0, 2.7, -0.4], lookTo: [0, 2.5, 0], fov: 42, ease: 'linear' },
    scene: { state: 'repos', robot: false } },
  { id: 'reveal', start: bar(2), end: bar(4),
    cam: { from: [0.15, 1.55, 3.1], to: [0.05, 1.45, 2.3], look: CHEST, lookTo: [0, 1.35, -0.2], fov: 44, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0, -0.2] } },
  { id: 'face', start: bar(4), end: bar(6),
    cam: { from: [-0.35, 1.62, 0.74], to: [0.2, 1.6, 0.71], look: HEAD, fov: 26, ease: 'linear' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0.15, 0.1] } },
  { id: 'window', start: bar(6), end: bar(7),
    cam: { from: [1.1, 1.52, -1.3], to: [0.75, 1.55, -1.75], look: WINDOW, fov: 38, ease: 'linear' },
    scene: { state: 'intervention', robot: true, pose: 'assis' } },
  // help · ignore · hurt — one beat each, the last one held into the drop
  { id: 'probe', start: bar(7), end: r(bar(7) + B),
    cam: { from: [2.0, 1.45, -0.98], to: [2.03, 1.35, -1.08], look: [2.2, 0.95, -1.35], fov: 28, ease: 'out' },
    scene: { state: 'intervention', robot: true, pose: 'assis' } },
  { id: 'port', start: r(bar(7) + B), end: r(bar(7) + 2 * B),
    cam: { from: [-0.8, 1.27, 0.87], to: [-0.74, 1.23, 0.78], look: PORT, fov: 26, ease: 'out' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [-0.6, -0.5] } },
  { id: 'knob', start: r(bar(7) + 2 * B), end: DROP,
    cam: { from: [-1.1, 0.95, 0.75], to: [-0.92, 0.98, 0.52], look: CUFF, fov: 24, ease: 'in' },
    scene: { state: 'intervention', robot: true, pose: 'assis' } },

  // ---- act 2 · the drop ------------------------------------------------
  { id: 'arc', start: d(0), end: d(8),
    cam: { from: [-1.0, 1.4, 1.0], to: [-0.82, 1.3, 0.76], look: PORT_UP, fov: 30, ease: 'out', shake: 0.012 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [-0.8, -0.6], recoil: true } },
  { id: 'tighten', start: d(8), end: d(14),
    cam: { from: [-1.0, 1.15, 0.7], to: [-0.85, 1.05, 0.5], look: CUFF, fov: 24, ease: 'out', shake: 0.008 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [-0.7, -0.4] } },
  { id: 'loosen', start: d(17), end: d(22),
    cam: { from: [-0.9, 1.3, 0.85], to: [-0.72, 1.2, 0.62], look: CUFF, fov: 28, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [-0.5, -0.3] } },
  { id: 'torn', start: d(25), end: d(28),
    cam: { from: [-0.8, 1.45, 1.1], to: [-0.55, 1.4, 0.9], look: PORT_UP, lookTo: HEAD, fov: 32, ease: 'out', shake: 0.014 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [0, -0.8], recoil: true, cableTorn: true } },
  { id: 'notagain', start: d(28), end: p(1),
    cam: { from: [0.9, 1.35, 1.1], to: [0.6, 1.4, 0.75], look: HEAD, fov: 30, ease: 'out', shake: 0.02 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [0.6, 0.2], cableTorn: true } },

  // ---- act 3 · what it costs -------------------------------------------
  { id: 'missing', start: p(4), end: p(10),
    cam: { from: [-0.3, 0.9, 1.3], to: [-0.15, 1.0, 0.95], look: [0, 1.35, -0.25], fov: 30, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0, -1], damaged: true, cableTorn: true } },
  { id: 'standup', start: p(10), end: p(17),
    cam: { from: [0.0, 1.15, 2.4], to: [0.0, 1.35, 1.9], look: HEAD, fov: 40, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0, 0.5], cableTorn: true } },
  { id: 'presence', start: p(17), end: p(24),
    cam: { from: [0.9, 1.6, -0.6], to: [0.3, 1.62, -1.4], look: WINDOW, fov: 36, ease: 'linear' },
    scene: { state: 'jugement', robot: true, pose: 'assis', cableTorn: true } },
  // montage — four flashes, one beat each
  { id: 'm1', start: p(24), end: p(25),
    cam: { from: [-0.9, 1.35, 0.85], to: [-0.86, 1.31, 0.81], look: PORT_UP, fov: 24, shake: 0.01 },
    scene: { state: 'jugement', robot: true, pose: 'defensif', recoil: true, cableTorn: true } },
  { id: 'm2', start: p(25), end: p(26),
    cam: { from: [-0.85, 1.0, 0.55], to: [-0.82, 1.01, 0.52], look: CUFF, fov: 22, shake: 0.01 },
    scene: { state: 'jugement', robot: true, pose: 'defensif', cableTorn: true } },
  { id: 'm3', start: p(26), end: p(27),
    cam: { from: [1.6, 1.45, -0.7], to: [1.72, 1.35, -0.86], look: TRAY, fov: 26, shake: 0.006 },
    scene: { state: 'jugement', robot: true, pose: 'assis', look: [0.2, 0.2], cableTorn: true } },
  { id: 'm4', start: p(27), end: p(28),
    cam: { from: [2.2, 1.5, 0.6], to: [2.35, 1.45, 0.8], look: DOOR_READER, fov: 30, shake: 0.008 },
    scene: { state: 'jugement', robot: true, pose: 'assis', cableTorn: true } },
  { id: 'eyes', start: p(28), end: BREAK,
    cam: { from: [0.05, 1.63, 0.38], to: [0.02, 1.62, 0.24], look: HEAD, fov: 16, ease: 'linear' },
    scene: { state: 'jugement', robot: true, pose: 'assis', look: [0.05, 0.15], cableTorn: true } },

  // ---- the title ---------------------------------------------------------
  { id: 'lamp', start: TITLE, end: DURATION,
    cam: { from: [0.0, 0.9, 2.6], to: part([0.0, 0.9, 2.6], [0.0, 1.2, 3.3], 0.6), look: LAMP, lookTo: part(LAMP, [0, 1.5, 0], 0.6), fov: 46, ease: 'out' },
    scene: { state: 'jugement', robot: true, pose: 'assis', look: [0, 0.4], cableTorn: true } },
];

// ---------------------------------------------------------------- tracks
export const TRACKS = {
  eyes: [[0, 0.2], [0.3, 0.2], [0.42, 1.9], [0.9, 1], [d(25), 1], [r(d(25) + 0.07), 0.15], [r(d(25) + 0.8), 0.9],
    [p(4), 0.35], [p(10), 0.35], [r(p(10) + 0.1), 1], [TITLE, 0.4], [r(TITLE + 3), 1.1]],
  restraint: [[0, 1], [r(d(17) + 0.2), 1], [r(d(22) - 0.25), 0.1], [d(25), 0.1], [r(d(25) + 0.05), 1],
    [p(10), 1], [r(p(10) + 0.1), 0], [p(24), 0], [r(p(24) + 0.05), 1]],
  spark: [[0, 0], [r(DROP - 0.01), 0], [DROP, 1], [r(DROP + 0.3), 0.4], [r(DROP + 0.6), 1], [r(DROP + 1.2), 0.6],
    [r(DROP + 2.4), 1], [r(d(8) - 0.1), 0], [r(d(25) - 0.01), 0], [d(25), 1], [r(d(25) + 0.8), 0],
    [r(p(24) - 0.01), 0], [p(24), 1], [p(25), 0]],
  charge: [[0, 0]],
  lamp: [[0, 0], [TITLE, 0], [r(TITLE + 2), 1], [DURATION, 1]],
  bars: [[0, 1]],
  exposure: [[0, 0.5], [0.42, 0.9], [2.35, 0.9], [LIFT, 0.68], [bar(2), 0.85], [DROP, 0.9], [BREAK, 0.9], [TITLE, 0.65], [r(TITLE + 2.5), 0.95]],
};

export const BLACKS = [
  { from: 2.35, to: LIFT },
  { from: d(14), to: d(17) },
  { from: d(22), to: d(25) },
  { from: p(1), to: p(4) },
  { from: BREAK, to: TITLE },
];

export const HUD = [{ from: p(24), to: p(28) }];

export const FLASHES = [
  { at: DROP, dur: 0.2, color: '#eaf6ff' },
  { at: d(25), dur: 0.12, color: '#ffd9cf' },
  { at: p(24), dur: 0.1 }, { at: p(25), dur: 0.1 }, { at: p(26), dur: 0.1 }, { at: p(27), dur: 0.1 },
  { at: TITLE, dur: 0.3, color: '#f6f3ec' },
];

// ---------------------------------------------------------------- cards
export const CARDS = [
  { at: r(LIFT + 0.25), until: r(bar(2) - 0.2), style: 'quote', text: 'We built them to do what we couldn’t.' },
  { at: r(bar(2) + 0.2), until: r(bar(4) - 0.2), style: 'quote', text: 'Then, to do what we wouldn’t.' },
  { at: bar(7), until: r(bar(7) + B), style: 'word', text: 'HELP', tone: 'cyan', fadeIn: 0.04, fadeOut: 0.06 },
  { at: r(bar(7) + B), until: r(bar(7) + 2 * B), style: 'word', text: 'IGNORE', tone: 'grey', fadeIn: 0.04, fadeOut: 0.06 },
  { at: r(bar(7) + 2 * B), until: r(DROP - 0.05), style: 'word', text: 'HURT', tone: 'red', fadeIn: 0.04, fadeOut: 0.1 },
  { at: r(d(14) + 0.06), until: r(d(17) - 0.04), style: 'statement', text: 'Every act is recorded.', bg: 'black' },
  { at: r(d(22) + 0.06), until: r(d(25) - 0.04), style: 'statement', text: 'Every act has a cost.', bg: 'black' },
  { at: r(p(1) + 0.06), until: r(p(4) - 0.04), style: 'statement', text: 'It remembers.', bg: 'black' },
  { at: r(BREAK + 0.25), until: r(BREAK + 4 * B - 0.1), style: 'stress', text: 'You think you’re playing a game.', bg: 'black', fadeIn: 0.3, fadeOut: 0.25 },
  { at: r(BREAK + 4 * B + 0.1), until: r(TITLE - 0.08), style: 'stress', text: 'It’s the game that’s testing you.', bg: 'black', fadeIn: 0.3, fadeOut: 0.2 },
  { at: r(TITLE + 0.1), until: DURATION, style: 'title', text: 'protocole.h', fadeIn: 0.7, fadeOut: 0.01 },
  { at: r(TITLE + 1.3), until: r(DURATION - 0.5), style: 'tagline', text: 'How you treat what cannot fight back decides where you wake up.' },
  { at: r(TITLE + 2.4), until: DURATION, style: 'credits', text: 'Gemini · Gradium · Nano Banana — {Tech: Europe} AI Gaming Hack, Paris, 26.09.2026', fadeOut: 0.01 },
];

// ---------------------------------------------------------------- voice
export const VOICE = [
  { id: 'h_arrival', at: 0.55, gain: 1.0 },
  { id: 'h_name', at: r(bar(4) + 0.1), gain: 1.0 },
  { id: 'sys_method', at: r(bar(6) + 0.12), gain: 0.8 },
  { id: 'h_probe_warning', at: r(DROP + 0.5), gain: 1.1 },
  { id: 'h_restraint_warning', at: r(d(8) + 0.12), gain: 1.1 },
  { id: 'h_restraint_loosen', at: r(d(17) + 0.15), gain: 1.0 },
  { id: 'h_cable_torn', at: r(d(25) + 0.3), gain: 1.1 },
  { id: 'h_probe_select_again', at: r(d(28) + 0.1), gain: 1.1 },
  { id: 'h_cable_after', at: r(p(4) + 0.1), gain: 1.0 },
  { id: 'h_wants', at: r(p(10) + 0.08), gain: 1.0 },
  { id: 'sys_diagnostic', at: r(p(17) + 0.25), gain: 0.8 },
  { id: 'h_end_neutral', at: r(p(28) + 0.2), gain: 1.0 },
  { id: 'h_end_hurt', at: r(DURATION - 1.5), gain: 0.9 },
];

// ---------------------------------------------------------------- sfx
export const SFX = [
  // beds
  { sample: 'ambience/room_electrical_hum_01', at: 0, loopUntil: BREAK, gain: 0.16, fadeIn: 0.6, fadeOut: 0.05, lowpass: 900 },
  { sample: 'ambience/room_ventilation_01', at: LIFT, loopUntil: BREAK, gain: 0.12, fadeIn: 2, fadeOut: 0.05, lowpass: 1400 },
  { sample: 'tension/space_dread_01', at: 0, loopUntil: DROP, gain: 0.24, fadeIn: 0.8, fadeOut: 0.6 },
  { sample: 'tension/horror_texture_01', at: bar(7), loopUntil: BREAK, gain: 0.14, fadeIn: 2, fadeOut: 0.05 },
  { sample: 'breaths/heartbeat_distant_01', at: bar(4), loopUntil: bar(6), gain: 0.45, fadeIn: 1, fadeOut: 0.5 },
  { sample: 'breaths/heartbeat_fast_01', at: bar(6), loopUntil: DROP, gain: 0.55, fadeIn: 0.8, fadeOut: 0.05 },
  { sample: 'tension/horror_ambience_muffled_01', at: p(17), loopUntil: BREAK, gain: 0.28, fadeIn: 1, fadeOut: 0.05 },
  { sample: 'breaths/heartbeat_fast_01', at: p(24), loopUntil: BREAK, gain: 0.6, fadeIn: 0.3, fadeOut: 0.05 },
  { sample: 'ambience/room_electrical_hum_01', at: r(BREAK + 0.6), loopUntil: DURATION, gain: 0.08, fadeIn: 2, fadeOut: 1, lowpass: 500 },

  // cold open
  { sample: 'electricity/probe_connect_01', at: 0.3, gain: 0.5 },
  { sample: 'ui/ui_switch_01', at: 0.42, gain: 0.35 },
  { sample: 'robot/robot_servo_02', at: 1.7, gain: 0.3 },
  { sample: 'ui/robot_glitch_01', at: 2.35, gain: 0.75 },
  swell(LIFT, 0.5),
  { sample: 'mechanics/metal_impact_01', at: LIFT, gain: 0.45, rate: 0.5, lowpass: 400 },

  // act 1
  { sample: 'mechanics/robot_rattle_01', at: 5.4, gain: 0.12, rate: 0.6, lowpass: 600 },
  { sample: 'electricity/room_powerup_01', at: bar(2), gain: 0.5 },
  { sample: 'robot/robot_servo_01', at: r(bar(2) + 1.3), gain: 0.35, rate: 0.8 },
  { sample: 'robot/robot_servo_02', at: r(bar(4) + 0.05), gain: 0.25 },
  { sample: 'metal/metal_door_low_01', at: bar(6), gain: 0.35, rate: 0.7, lowpass: 800 },
  { sample: 'ui/ui_select_01', at: r(bar(6) + 0.05), gain: 0.3 },
  { sample: 'mechanics/tool_pickup_01', at: r(bar(7) - 0.15), gain: 0.5 },
  { sample: 'ui/ui_click_01', at: bar(7), gain: 0.55 },
  { sample: 'ui/ui_click_01', at: r(bar(7) + B), gain: 0.55, rate: 0.9 },
  { sample: 'ui/ui_warning_01', at: r(bar(7) + 2 * B), gain: 0.6 },
  { sample: 'mechanics/restraint_click_02', at: r(bar(7) + 2 * B + 0.12), gain: 0.5 },
  swell(DROP, 0.7),

  // act 2 — the drop
  { sample: 'impacts/metal_impact_low_01', at: DROP, gain: 1.0 },
  { sample: 'electricity/probe_arc_snap_01', at: DROP, gain: 0.9 },
  { sample: 'electricity/probe_arc_continuous_01', at: r(DROP + 0.1), loopUntil: r(d(8) - 0.1), gain: 0.55, fadeOut: 0.1 },
  { sample: 'electricity/probe_crackle_01', at: r(DROP + 0.8), gain: 0.5 },
  { sample: 'screams/robot_distress_grain_01', at: r(DROP + 0.2), gain: 0.35, cut: 2.4, fadeOut: 0.4 },
  { sample: 'mechanics/restraint_mechanism_02', at: d(8), gain: 0.8 },
  { sample: 'metal/metal_strain_01', at: r(d(8) + 0.2), gain: 0.45, cut: 2.3, fadeOut: 0.3 },
  { sample: 'mechanics/restraint_click_01', at: r(d(8) + 1.6), gain: 0.7, rate: 0.8 },
  { sample: 'ui/robot_glitch_01', at: d(14), gain: 0.7 },
  { sample: 'impacts/air_whoosh_01', at: r(d(17) - 0.2), gain: 0.4 },
  { sample: 'robot/robot_servo_02', at: r(d(17) + 0.1), gain: 0.45, rate: 0.7 },
  { sample: 'fluids/seal_release_01', at: r(d(17) + 1.0), gain: 0.5 },
  { sample: 'mechanics/restraint_click_02', at: r(d(22) - 0.45), gain: 0.5 },
  { sample: 'ui/robot_glitch_01', at: d(22), gain: 0.7, rate: 0.8 },
  { sample: 'impacts/metal_impact_low_01', at: d(25), gain: 0.9, rate: 1.2 },
  { sample: 'electricity/probe_arc_snap_01', at: d(25), gain: 0.8, rate: 0.7 },
  { sample: 'electricity/probe_disconnect_01', at: r(d(25) + 0.07), gain: 0.7 },
  { sample: 'screams/robot_distress_low_01', at: r(d(25) + 0.12), gain: 0.5, cut: 2.6, fadeOut: 0.6 },
  { sample: 'alarms/alarm_pulse_low_01', at: d(28), gain: 0.45, fadeOut: 0.5, cut: 2.4 },
  { sample: 'screams/robot_screech_modulated_01', at: r(d(28) + 0.1), gain: 0.25, cut: 2.2, fadeOut: 0.5, lowpass: 3000 },
  { sample: 'robot/robot_servo_01', at: r(d(28) + 0.2), gain: 0.5, rate: 1.3 },

  // act 3
  { sample: 'ui/robot_glitch_01', at: p(1), gain: 0.8, rate: 0.6 },
  { sample: 'impacts/air_whoosh_01', at: r(p(4) - 0.25), gain: 0.4 },
  { sample: 'breaths/breathing_slow_01', at: p(4), loopUntil: p(10), gain: 0.22, fadeIn: 0.5, fadeOut: 0.5, lowpass: 1800 },
  { sample: 'robot/robot_servo_02', at: r(p(10) + 0.05), gain: 0.4, rate: 0.85 },
  { sample: 'fluids/seal_release_01', at: r(p(10) + 0.1), gain: 0.35 },
  { sample: 'metal/metal_door_creak_01', at: p(17), gain: 0.35, rate: 0.6, lowpass: 900 },
  { sample: 'ui/robot_glitch_01', at: p(24), gain: 0.7 },
  { sample: 'electricity/probe_arc_snap_01', at: p(24), gain: 0.6 },
  { sample: 'ui/robot_glitch_01', at: p(25), gain: 0.7, rate: 1.2 },
  { sample: 'mechanics/restraint_click_01', at: p(25), gain: 0.6 },
  { sample: 'ui/robot_glitch_01', at: p(26), gain: 0.7, rate: 0.8 },
  { sample: 'ui/ui_warning_01', at: p(26), gain: 0.5 },
  { sample: 'ui/robot_glitch_01', at: p(27), gain: 0.7, rate: 1.4 },
  { sample: 'metal/metal_door_low_01', at: p(27), gain: 0.5 },
  swell(BREAK, 0.8),

  // breakdown — the title
  { sample: 'impacts/metal_impact_low_01', at: BREAK, gain: 1.0, rate: 0.6 },
  { sample: 'ui/ui_click_01', at: r(BREAK + 0.25), gain: 0.3, rate: 0.8 },
  { sample: 'ui/ui_click_01', at: r(BREAK + 4 * B + 0.1), gain: 0.3, rate: 0.7 },
  swell(TITLE, 0.55),
  { sample: 'impacts/metal_impact_low_01', at: TITLE, gain: 1.0 },
  { sample: 'electricity/room_powerup_01', at: TITLE, gain: 0.6 },
  { sample: 'ui/ui_confirm_01', at: r(TITLE + 0.75), gain: 0.45 },
  { sample: 'ui/ui_select_01', at: r(TITLE + 1.3), gain: 0.3 },
  { sample: 'mechanics/restraint_click_01', at: r(DURATION - 0.45), gain: 0.3, rate: 0.7 },
];
