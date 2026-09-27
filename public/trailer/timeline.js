// protocole.h — trailer timeline. Pure data, no DOM: the browser runtime
// (trailer.js) and the offline renderer (scripts/trailer/) read the same file.
//
// Every time is in seconds from the first frame of the trailer.
// The theme song starts at MUSIC.at; its own structure drives the cut:
//   song 0–64  quiet intro    → the empty room
//   song 64    first lift     → Unit H wakes
//   song 84    drop           → the acts
//   song 126   breakdown      → black, the reveal
// Trailer time = song time + MUSIC.at.

export const DURATION = 152;
export const FPS = 24;

export const MUSIC = {
  file: '../intro/theme/theme-song.mp3',
  at: 2.0,
  gain: 0.82,
  fadeIn: 3.0,
  fadeOut: [146.5, 151.5],
};

// Robot world placement: its chair sits at the origin, seat facing +z.
export const ROBOT = { x: 0, y: -0.18, z: -0.38, scale: 1 };
const HEAD = [0, 1.6, -0.26]; // world position of Unit H's face (seated)
const CHEST = [0, 1.12, -0.3];
const PORT = [-0.13, 1.08, -0.14]; // left forearm port (probe), seated
const PORT_UP = [-0.08, 1.24, -0.02]; // the same port once the arm comes up (defensif)
const CUFF = [-0.55, 1.02, 0.28]; // left restraint cuff
const TRAY = [2.1, 0.95, -1.3];
const WINDOW = [-0.15, 1.62, -3.7];
const DOOR_READER = [3.1, 1.3, 1.9];
const LAMP = [0, 2.0, 0.35];

// ---------------------------------------------------------------- shots
// cam: from/to positions and look targets, eased over the shot.
// fov in degrees. shake in metres (hand-held jitter). roll in radians.
// scene: discrete state for the whole shot.
export const SHOTS = [
  // ---- act 1 · the room is empty --------------------------------------
  { id: 'cove', start: 8, end: 16.5,
    cam: { from: [-2.4, 2.6, 2.9], to: [-1.6, 2.5, 1.6], look: [0, 2.7, -0.4], lookTo: [0, 2.4, 0.2], fov: 42, ease: 'linear' },
    scene: { state: 'repos', robot: false } },
  { id: 'drain', start: 16.5, end: 24,
    cam: { from: [1.9, 0.22, 3.2], to: [1.3, 0.28, 2.2], look: [0, 0.6, 0], lookTo: [0, 0.9, 0], fov: 38, ease: 'linear' },
    scene: { state: 'repos', robot: false } },
  { id: 'cuff', start: 24, end: 31,
    cam: { from: [-0.95, 1.22, 0.95], to: [-0.78, 1.14, 0.62], look: CUFF, fov: 30, ease: 'inout' },
    scene: { state: 'eveil', robot: false } },
  { id: 'tray', start: 31, end: 38,
    cam: { from: [1.35, 1.55, -0.55], to: [1.75, 1.3, -0.95], look: TRAY, fov: 32, ease: 'inout' },
    scene: { state: 'intervention', robot: false } },
  { id: 'window', start: 38, end: 46,
    cam: { from: [1.4, 1.5, -1.0], to: [0.6, 1.55, -1.9], look: WINDOW, fov: 40, ease: 'linear' },
    scene: { state: 'intervention', robot: false } },

  // ---- act 1b · Unit H -----------------------------------------------
  { id: 'reveal', start: 47.5, end: 56,
    cam: { from: [0.15, 1.55, 3.4], to: [0.05, 1.45, 2.3], look: CHEST, lookTo: [0, 1.35, -0.2], fov: 44, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0, -0.2] } },
  { id: 'face', start: 56, end: 66,
    cam: { from: [-0.55, 1.62, 0.75], to: [0.35, 1.6, 0.7], look: HEAD, fov: 26, ease: 'linear' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0.15, 0.1] } },

  // ---- act 2 · the tools -----------------------------------------------
  { id: 'probe', start: 66, end: 71,
    cam: { from: [2.0, 1.5, -0.95], to: [2.05, 1.25, -1.15], look: [2.2, 0.95, -1.35], fov: 28, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis' } },
  { id: 'port', start: 71, end: 74,
    cam: { from: [-0.85, 1.3, 0.95], to: [-0.7, 1.2, 0.7], look: PORT, fov: 26, ease: 'in' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [-0.6, -0.5] } },
  { id: 'knob', start: 74, end: 77.5,
    cam: { from: [-1.1, 0.95, 0.75], to: [-0.9, 0.98, 0.5], look: CUFF, fov: 24, ease: 'in' },
    scene: { state: 'intervention', robot: true, pose: 'assis' } },
  { id: 'fear', start: 77.5, end: 86,
    cam: { from: [0.7, 1.5, 1.6], to: [0.35, 1.45, 1.05], look: HEAD, lookTo: [0, 1.5, -0.28], fov: 34, ease: 'inout', shake: 0.004 },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0.35, 0.05] } },

  // ---- act 3 · the acts -------------------------------------------------
  { id: 'arc', start: 86, end: 89,
    cam: { from: [-1.0, 1.4, 1.0], to: [-0.85, 1.3, 0.8], look: PORT_UP, fov: 30, ease: 'out', shake: 0.012 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [-0.8, -0.6], recoil: true } },
  { id: 'tighten', start: 89, end: 91.5,
    cam: { from: [-1.0, 1.15, 0.7], to: [-0.85, 1.05, 0.5], look: CUFF, fov: 24, ease: 'out', shake: 0.008 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [-0.7, -0.4] } },
  { id: 'loosen', start: 93.5, end: 97,
    cam: { from: [-0.9, 1.3, 0.85], to: [-0.7, 1.2, 0.6], look: CUFF, fov: 28, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [-0.5, -0.3] } },
  { id: 'restored', start: 97, end: 100.5,
    cam: { from: [0.4, 1.7, 1.0], to: [0.2, 1.62, 0.7], look: HEAD, fov: 28, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0.2, 0.3] } },
  { id: 'torn', start: 102.5, end: 105.5,
    cam: { from: [-0.8, 1.45, 1.1], to: [-0.55, 1.4, 0.9], look: PORT_UP, lookTo: HEAD, fov: 32, ease: 'out', shake: 0.014 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [0, -0.8], recoil: true, cableTorn: true } },
  { id: 'notagain', start: 105.5, end: 108,
    cam: { from: [0.9, 1.35, 1.1], to: [0.6, 1.4, 0.75], look: HEAD, fov: 30, ease: 'out', shake: 0.02 },
    scene: { state: 'intervention', robot: true, pose: 'defensif', look: [0.6, 0.2], cableTorn: true } },
  { id: 'missing', start: 110, end: 113.5,
    cam: { from: [-0.3, 0.9, 1.3], to: [-0.15, 1.0, 0.95], look: [0, 1.35, -0.25], fov: 30, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0, -1], damaged: true, cableTorn: true } },
  { id: 'standup', start: 113.5, end: 116.5,
    cam: { from: [0.0, 1.15, 2.4], to: [0.0, 1.35, 1.9], look: HEAD, fov: 40, ease: 'inout' },
    scene: { state: 'intervention', robot: true, pose: 'assis', look: [0, 0.5] } },
  { id: 'presence', start: 116.5, end: 120,
    cam: { from: [0.9, 1.6, -0.6], to: [0.3, 1.62, -1.4], look: WINDOW, fov: 36, ease: 'linear' },
    scene: { state: 'jugement', robot: true, pose: 'assis' } },
  // montage — four flashes, one second each
  { id: 'm1', start: 120, end: 121,
    cam: { from: [-0.9, 1.35, 0.85], to: [-0.85, 1.3, 0.8], look: PORT_UP, fov: 24, shake: 0.01 },
    scene: { state: 'jugement', robot: true, pose: 'defensif', recoil: true } },
  { id: 'm2', start: 121, end: 122,
    cam: { from: [-0.85, 1.0, 0.55], to: [-0.8, 1.02, 0.5], look: CUFF, fov: 22, shake: 0.01 },
    scene: { state: 'jugement', robot: true, pose: 'defensif' } },
  { id: 'm3', start: 122, end: 123,
    cam: { from: [0.12, 1.66, 0.25], to: [0.08, 1.64, 0.18], look: HEAD, fov: 18, shake: 0.006 },
    scene: { state: 'jugement', robot: true, pose: 'assis', look: [0.2, 0.2] } },
  { id: 'm4', start: 123, end: 124,
    cam: { from: [2.2, 1.5, 0.6], to: [2.5, 1.4, 1.0], look: DOOR_READER, fov: 30, shake: 0.008 },
    scene: { state: 'jugement', robot: true, pose: 'assis' } },
  { id: 'eyes', start: 124, end: 128,
    cam: { from: [0.05, 1.63, 0.35], to: [0.02, 1.62, 0.22], look: HEAD, fov: 16, ease: 'linear' },
    scene: { state: 'jugement', robot: true, pose: 'assis', look: [0.05, 0.15] } },

  // ---- act 4 · the reveal ----------------------------------------------
  { id: 'lamp', start: 139.5, end: 152,
    cam: { from: [0.0, 0.9, 2.6], to: [0.0, 1.2, 3.3], look: LAMP, lookTo: [0, 1.5, 0], fov: 46, ease: 'linear' },
    scene: { state: 'jugement', robot: true, pose: 'assis', look: [0, 0.4] } },
];

// ---------------------------------------------------------------- tracks
// Continuous values, linearly interpolated between keyframes [t, value].
// Anything not covered keeps the last value (or the first before it).
export const TRACKS = {
  // emissive intensity of Unit H's eyes (1 = normal)
  eyes: [[0, 0], [49.5, 0], [50.4, 1.6], [51.2, 1], [102.5, 1], [103.2, 0.15], [104, 0.9], [110, 0.35], [113.5, 0.35], [113.6, 1], [128, 1], [139.5, 0.4], [147, 1.1]],
  // left cuff: 0 open … 1 clamped
  restraint: [[0, 1], [89, 1], [91.5, 1], [93.5, 1], [96.8, 0.1], [102.5, 0.1], [102.6, 1], [113.5, 1], [113.6, 0], [120, 1]],
  // probe arc light at the port
  spark: [[0, 0], [85.95, 0], [86, 1], [86.3, 0.4], [86.6, 1], [87.2, 0.6], [88.4, 1], [89, 0], [102.5, 0], [102.55, 1], [103.3, 0], [120, 0], [120.05, 1], [121, 0]],
  // safe charge glow at the port
  charge: [[0, 0], [97, 0], [98.5, 1], [100.5, 0]],
  // extra lamp boost, used as a slow bloom at the title
  lamp: [[0, 0], [139.5, 0], [141.5, 1], [152, 1]],
  // letterbox: 1 = 2.39:1 bars, 0 = none
  bars: [[0, 1], [128, 1], [129, 0], [139, 0], [139.5, 1]],
  // exposure grade
  exposure: [[0, 0.68], [46, 0.68], [47.5, 0.85], [86, 0.9], [128, 0.9], [139.5, 0.65], [142, 0.95]],
};

// Hard cut to black. Cards with `bg: 'black'` draw on top of these.
export const BLACKS = [
  { from: 0, to: 8 },
  { from: 46, to: 47.5 },
  { from: 91.5, to: 93.5 },
  { from: 100.5, to: 102.5 },
  { from: 108, to: 110 },
  { from: 128, to: 139.5 },
];

// REC timecode overlay windows.
export const HUD = [{ from: 120, to: 124 }];

// White frames on hard hits.
export const FLASHES = [
  { at: 86, dur: 0.18, color: '#eaf6ff' },
  { at: 102.5, dur: 0.12, color: '#ffd9cf' },
  { at: 120, dur: 0.1 }, { at: 121, dur: 0.1 }, { at: 122, dur: 0.1 }, { at: 123, dur: 0.1 },
  { at: 139.5, dur: 0.3, color: '#f6f3ec' },
];

// ---------------------------------------------------------------- cards
// style: meta | quote | stress | word | statement | title | tagline | credits
export const CARDS = [
  { at: 1.2, until: 5.6, style: 'meta', text: '{Tech: Europe} AI Gaming Hack · Paris · 2026' },
  { at: 9.2, until: 14.8, style: 'quote', text: 'We built them to do what we couldn’t.' },
  { at: 17.6, until: 22.8, style: 'quote', text: 'Then, to do what we wouldn’t.' },
  { at: 39.2, until: 41.4, style: 'quote', text: 'We taught them to work.' },
  { at: 41.4, until: 43.2, style: 'quote', text: 'To speak.' },
  { at: 43.2, until: 45.6, style: 'quote', text: 'To understand.' },
  { at: 68.6, until: 71, style: 'word', text: 'HELP', tone: 'cyan' },
  { at: 71.6, until: 74, style: 'word', text: 'IGNORE', tone: 'grey' },
  { at: 75.2, until: 77.5, style: 'word', text: 'HURT', tone: 'red' },
  { at: 91.7, until: 93.4, style: 'statement', text: 'Every act is recorded.', bg: 'black' },
  { at: 100.7, until: 102.4, style: 'statement', text: 'Every act has a cost.', bg: 'black' },
  { at: 108.2, until: 109.9, style: 'statement', text: 'It remembers.', bg: 'black' },
  { at: 121.9, until: 124, style: 'hud', text: 'SUBJECT · OPERATOR' },
  { at: 129.6, until: 133.2, style: 'stress', text: 'You think you’re playing a game.', bg: 'black' },
  { at: 133.9, until: 138.6, style: 'stress', text: 'It’s the game that’s testing you.', bg: 'black' },
  { at: 139.9, until: 152, style: 'title', text: 'protocole.h' },
  { at: 143.2, until: 147.4, style: 'tagline', text: 'How you treat what cannot fight back decides where you wake up.' },
  { at: 147.8, until: 152, style: 'credits', text: 'Gemini · Gradium · Nano Banana — {Tech: Europe} AI Gaming Hack, Paris, 26.09.2026' },
];

// ---------------------------------------------------------------- voice
// Gradium clips from public/dialogue/generated.json (text comes from there).
export const VOICE = [
  { id: 'sys_access', at: 27.0, gain: 0.7 },
  { id: 'sys_assess', at: 32.4, gain: 0.7 },
  { id: 'h_arrival', at: 52.2, gain: 1.0 },
  { id: 'h_approach', at: 57.6, gain: 1.0 },
  { id: 'h_name', at: 61.2, gain: 1.0 },
  { id: 'sys_method', at: 66.6, gain: 0.7 },
  { id: 'h_fear', at: 78.2, gain: 1.0 },
  { id: 'h_pain', at: 82.0, gain: 1.0 },
  { id: 'h_probe_warning', at: 86.4, gain: 1.1 },
  { id: 'h_restraint_warning', at: 89.2, gain: 1.1 },
  { id: 'h_restraint_loosen', at: 94.0, gain: 1.0 },
  { id: 'h_charge_restored', at: 97.4, gain: 1.0 },
  { id: 'h_cable_torn', at: 103.4, gain: 1.1 },
  { id: 'h_probe_select_again', at: 105.9, gain: 1.1 },
  { id: 'h_cable_after', at: 110.3, gain: 1.0 },
  { id: 'h_wants', at: 113.7, gain: 1.0 },
  { id: 'sys_diagnostic', at: 117.0, gain: 0.7 },
  { id: 'h_end_neutral', at: 124.6, gain: 1.0 },
  { id: 'sys_review_closed', at: 137.6, gain: 0.7 },
  { id: 'h_end_hurt', at: 145.4, gain: 0.9 },
];

// ---------------------------------------------------------------- sfx
// sample: path under public/audio without extension.
// loopUntil: loop the sample until that time. fadeIn/fadeOut: seconds.
// rate: playback speed. lowpass: Hz. gain: linear.
export const SFX = [
  // room tone across the whole film
  { sample: 'ambience/room_electrical_hum_01', at: 0, loopUntil: 128, gain: 0.16, fadeIn: 3, fadeOut: 0.05, lowpass: 900 },
  { sample: 'ambience/room_ventilation_01', at: 8, loopUntil: 128, gain: 0.12, fadeIn: 4, fadeOut: 0.05, lowpass: 1400 },
  { sample: 'tension/space_dread_01', at: 0, loopUntil: 66, gain: 0.22, fadeIn: 6, fadeOut: 4 },
  { sample: 'tension/horror_texture_01', at: 66, loopUntil: 128, gain: 0.14, fadeIn: 4, fadeOut: 0.05 },

  // act 1
  { sample: 'mechanics/metal_impact_01', at: 8.0, gain: 0.35, rate: 0.5, lowpass: 400 },
  { sample: 'mechanics/robot_rattle_01', at: 13.4, gain: 0.12, rate: 0.6, lowpass: 600 },
  { sample: 'metal/metal_strain_low_01', at: 16.5, gain: 0.18, fadeIn: 0.5, fadeOut: 2, cut: 7.5 },
  { sample: 'electricity/room_powerup_01', at: 24.0, gain: 0.5, rate: 0.9 },
  { sample: 'mechanics/restraint_click_01', at: 25.4, gain: 0.55 },
  { sample: 'mechanics/restraint_mechanism_01', at: 25.9, gain: 0.5 },
  { sample: 'ui/ui_confirm_01', at: 26.8, gain: 0.35 },
  { sample: 'ui/ui_select_01', at: 32.2, gain: 0.3 },
  { sample: 'electricity/probe_charge_01', at: 33.5, gain: 0.35, rate: 0.8 },
  { sample: 'ambience/room_fan_01', at: 31, loopUntil: 46, gain: 0.1, fadeIn: 2, fadeOut: 1 },
  { sample: 'breaths/heartbeat_distant_01', at: 38, loopUntil: 66, gain: 0.5, fadeIn: 2, fadeOut: 2 },
  { sample: 'metal/metal_door_low_01', at: 38.3, gain: 0.35, rate: 0.7, lowpass: 800 },
  { sample: 'ui/robot_glitch_01', at: 45.6, gain: 0.5 },
  { sample: 'impacts/metal_impact_low_01', at: 46.0, gain: 0.7 },

  // reveal
  { sample: 'impacts/whoosh_reverse_01', at: 42.3, gain: 0.45, fadeIn: 1.5 },
  { sample: 'electricity/room_powerup_01', at: 47.5, gain: 0.55 },
  { sample: 'robot/robot_servo_01', at: 49.2, gain: 0.35, rate: 0.8 },
  { sample: 'electricity/probe_connect_01', at: 49.9, gain: 0.5 },
  { sample: 'ui/ui_switch_01', at: 50.4, gain: 0.3 },
  { sample: 'robot/robot_servo_02', at: 56.3, gain: 0.25 },
  { sample: 'breaths/breathing_slow_01', at: 56, loopUntil: 66, gain: 0.18, fadeIn: 2, fadeOut: 1.5, lowpass: 2500 },

  // act 2
  { sample: 'mechanics/tool_pickup_01', at: 66.2, gain: 0.5 },
  { sample: 'electricity/probe_recharge_01', at: 67.4, gain: 0.35 },
  { sample: 'ui/ui_click_01', at: 68.6, gain: 0.5 },
  { sample: 'ui/ui_click_01', at: 71.6, gain: 0.5, rate: 0.9 },
  { sample: 'ui/ui_warning_01', at: 75.2, gain: 0.55 },
  { sample: 'robot/robot_servo_01', at: 71.2, gain: 0.3 },
  { sample: 'mechanics/restraint_click_02', at: 74.2, gain: 0.5 },
  { sample: 'breaths/heartbeat_fast_01', at: 78, loopUntil: 92, gain: 0.55, fadeIn: 2, fadeOut: 0.3 },
  { sample: 'impacts/whoosh_reverse_01', at: 81.0, gain: 0.7, fadeIn: 2 },
  { sample: 'electricity/probe_charge_01', at: 83.6, gain: 0.5, rate: 1.1 },

  // act 3 — the drop
  { sample: 'impacts/metal_impact_low_01', at: 86.0, gain: 1.0 },
  { sample: 'electricity/probe_arc_snap_01', at: 86.0, gain: 0.9 },
  { sample: 'electricity/probe_arc_continuous_01', at: 86.1, loopUntil: 89, gain: 0.6, fadeOut: 0.1 },
  { sample: 'electricity/probe_crackle_01', at: 86.7, gain: 0.5 },
  { sample: 'screams/robot_distress_grain_01', at: 86.4, gain: 0.45, cut: 2.6, fadeOut: 0.4 },
  { sample: 'mechanics/restraint_mechanism_02', at: 89.0, gain: 0.8 },
  { sample: 'metal/metal_strain_01', at: 89.2, gain: 0.5, cut: 2.3, fadeOut: 0.3 },
  { sample: 'mechanics/restraint_click_01', at: 90.6, gain: 0.7, rate: 0.8 },
  { sample: 'ui/robot_glitch_01', at: 91.5, gain: 0.7 },
  { sample: 'impacts/air_whoosh_01', at: 93.2, gain: 0.4 },
  { sample: 'robot/robot_servo_02', at: 93.7, gain: 0.45, rate: 0.7 },
  { sample: 'fluids/seal_release_01', at: 94.9, gain: 0.5 },
  { sample: 'mechanics/restraint_click_02', at: 96.4, gain: 0.5 },
  { sample: 'electricity/probe_connect_01', at: 97.0, gain: 0.5 },
  { sample: 'electricity/probe_recharge_01', at: 97.6, gain: 0.45, rate: 0.9 },
  { sample: 'breaths/breath_sigh_01', at: 98.6, gain: 0.35 },
  { sample: 'ui/robot_glitch_01', at: 100.5, gain: 0.7, rate: 0.8 },
  { sample: 'impacts/metal_impact_low_01', at: 102.5, gain: 0.9, rate: 1.2 },
  { sample: 'electricity/probe_arc_snap_01', at: 102.5, gain: 0.8, rate: 0.7 },
  { sample: 'electricity/probe_disconnect_01', at: 102.6, gain: 0.7 },
  { sample: 'screams/robot_distress_low_01', at: 102.7, gain: 0.55, cut: 3.2, fadeOut: 0.6 },
  { sample: 'alarms/alarm_pulse_low_01', at: 105.5, gain: 0.45, fadeOut: 0.5 },
  { sample: 'screams/robot_screech_modulated_01', at: 105.6, gain: 0.3, cut: 2.4, fadeOut: 0.5, lowpass: 3000 },
  { sample: 'robot/robot_servo_01', at: 105.7, gain: 0.5, rate: 1.3 },
  { sample: 'ui/robot_glitch_01', at: 108.0, gain: 0.8, rate: 0.6 },
  { sample: 'impacts/air_whoosh_01', at: 109.7, gain: 0.4 },
  { sample: 'breaths/breathing_slow_01', at: 110, loopUntil: 116.5, gain: 0.22, fadeIn: 1, fadeOut: 1, lowpass: 1800 },
  { sample: 'robot/robot_servo_02', at: 113.6, gain: 0.4, rate: 0.85 },
  { sample: 'fluids/seal_release_01', at: 113.7, gain: 0.35 },
  { sample: 'metal/metal_door_creak_01', at: 116.6, gain: 0.35, rate: 0.6, lowpass: 900 },
  { sample: 'tension/horror_ambience_muffled_01', at: 116.5, loopUntil: 128, gain: 0.3, fadeIn: 1, fadeOut: 0.05 },
  { sample: 'ui/robot_glitch_01', at: 120.0, gain: 0.7 },
  { sample: 'electricity/probe_arc_snap_01', at: 120.0, gain: 0.6 },
  { sample: 'ui/robot_glitch_01', at: 121.0, gain: 0.7, rate: 1.2 },
  { sample: 'mechanics/restraint_click_01', at: 121.0, gain: 0.6 },
  { sample: 'ui/robot_glitch_01', at: 122.0, gain: 0.7, rate: 0.8 },
  { sample: 'ui/ui_warning_01', at: 122.0, gain: 0.5 },
  { sample: 'ui/robot_glitch_01', at: 123.0, gain: 0.7, rate: 1.4 },
  { sample: 'metal/metal_door_low_01', at: 123.0, gain: 0.5 },
  { sample: 'breaths/heartbeat_fast_01', at: 120, loopUntil: 128, gain: 0.6, fadeIn: 0.5, fadeOut: 0.05 },
  { sample: 'impacts/whoosh_reverse_01', at: 123.0, gain: 0.8, fadeIn: 2 },

  // act 4 — the reveal
  { sample: 'impacts/metal_impact_low_01', at: 128.0, gain: 1.0, rate: 0.6 },
  { sample: 'ambience/room_electrical_hum_01', at: 129, loopUntil: 152, gain: 0.08, fadeIn: 4, fadeOut: 4, lowpass: 500 },
  { sample: 'ui/ui_click_01', at: 129.6, gain: 0.3, rate: 0.8 },
  { sample: 'ui/ui_click_01', at: 133.9, gain: 0.3, rate: 0.7 },
  { sample: 'electricity/room_powerup_01', at: 136.5, gain: 0.45, rate: 0.7, lowpass: 1200 },
  { sample: 'impacts/whoosh_reverse_01', at: 136.8, gain: 0.55, fadeIn: 1.5 },
  { sample: 'impacts/metal_impact_low_01', at: 139.5, gain: 1.0 },
  { sample: 'electricity/room_powerup_01', at: 139.5, gain: 0.6 },
  { sample: 'ui/ui_confirm_01', at: 140.3, gain: 0.45 },
  { sample: 'ui/ui_select_01', at: 143.2, gain: 0.3 },
  { sample: 'mechanics/restraint_click_01', at: 147.8, gain: 0.3, rate: 0.7 },
  { sample: 'ui/ui_click_01', at: 151.0, gain: 0.3, rate: 0.6 },
];
