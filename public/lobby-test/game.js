import { createAudio } from './audio.js';
import { buildChair } from './chair.js';
import { animateDetails, buildDetails } from './details.js';
import { applyLevels, buildLighting } from './lighting.js';
import { createMaterials } from './materials.js';
import {
  CHAIR,
  clampToRoom,
  directionFromKeys,
  distanceToChair,
  headBob,
  movePlayer,
  PLAYER_EYE,
  PLAYER_RADIUS,
  ROOM,
} from './movement.js';
import { buildProps } from './props.js';
import { buildRoom } from './room.js';
import { createSequence } from './sequence.js';

const THREE = globalThis.THREE;
const TEST_MODE = new URLSearchParams(location.search).has('test');

const host = document.getElementById('canvas-host');
const overlay = document.getElementById('overlay');
const enterBtn = document.getElementById('enter');
const menuSub = document.getElementById('menu-sub');
const menuHint = document.getElementById('menu-hint');
const soundBtn = document.getElementById('menu-sound');
const restartBtn = document.getElementById('menu-restart');
const stateBtn = document.getElementById('lighting');
const statusEl = document.getElementById('status');
const helpEl = document.getElementById('help');
const cueEl = document.getElementById('cue');
const telemetry = document.getElementById('telemetry');

const STATE_LABELS = {
  repos: 'repos',
  eveil: 'éveil',
  intervention: 'intervention',
  jugement: 'jugement',
};
const CUE_TEXT = {
  wake: 'La salle vous a remarqué.',
  restraint_servo: 'Un verrou se desserre.',
  diagnostic_start: 'Séquence de diagnostic.',
  vent_shift: 'La ventilation change de régime.',
  glass_thud: 'Un choc sourd derrière la vitre.',
  presence: 'Quelque chose s’éclaire derrière la vitre.',
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
host.appendChild(renderer.domElement);
const canvas = renderer.domElement;
canvas.tabIndex = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0b0d);
scene.fog = new THREE.FogExp2(0x1a1b1d, 0.035);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 40);
camera.rotation.order = 'YXZ';
let yaw = 0;
let pitch = -0.05;

const mats = createMaterials(renderer);
const room = buildRoom(scene, mats);
const chair = buildChair(scene, mats);
const props = buildProps(scene, mats);
const rig = buildLighting(scene, mats);
const details = buildDetails(scene, mats, rig);
const refs = {
  restraints: chair.restraints,
  leds: chair.leds,
  wallPanelLeds: room.wallPanelLeds,
  ventBlades: room.ventBlades,
  doorReader: room.doorReader,
  windowFigure: room.windowFigure,
  stationStrip: props.stationStrip,
  probeLed: props.probeLed,
};

const sequence = createSequence();
const audio = createAudio();

let loaded = false;
let entered = false;
let pointerLocked = false;
let dragging = false;
let lastX = 0;
let lastY = 0;
let bobPhase = 0;
let cueTimer = 0;
const keys = new Set();
const pose = { x: 0, z: ROOM.halfZ - 1.0 };

function setStateLabel() {
  stateBtn.textContent = 'État : ' + STATE_LABELS[sequence.state];
}

function showCue(text) {
  cueEl.textContent = text;
  cueEl.hidden = false;
  cueTimer = 3.4;
}

function pause() {
  entered = false;
  keys.clear();
  dragging = false;
  overlay.classList.add('paused');
  menuSub.textContent = 'Pause';
  menuHint.textContent = 'Échap ou clic hors du menu pour reprendre.';
  enterBtn.textContent = 'Reprendre';
  overlay.hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
}

function toggleSound() {
  if (!audio) return;
  const muted = audio.toggleMute();
  statusEl.textContent = muted ? 'Son coupé' : 'Son actif';
  soundBtn.textContent = muted ? 'Son : coupé' : 'Son : actif';
}

function cycleState() {
  const order = ['repos', 'intervention', 'jugement'];
  const current = sequence.state === 'eveil' ? 'repos' : sequence.state;
  sequence.setState(order[(order.indexOf(current) + 1) % order.length]);
  setStateLabel();
}

setStateLabel();

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyL') {
    cycleState();
    return;
  }
  if (e.code === 'KeyM') {
    toggleSound();
    return;
  }
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
    sequence.setState(['repos', 'intervention', 'jugement'][Number(e.code.slice(5)) - 1]);
    setStateLabel();
    return;
  }
  if (e.code === 'Escape') {
    if (entered) pause();
    else if (overlay.classList.contains('paused')) enter();
    return;
  }
  if (!entered) return;
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
document.addEventListener('pointerlockchange', () => {
  const was = pointerLocked;
  pointerLocked = document.pointerLockElement === canvas;
  if (was && !pointerLocked) pause();
});
document.addEventListener('pointerlockerror', () => {
  helpEl.hidden = false;
});

function enter() {
  entered = true;
  overlay.hidden = true;
  enterBtn.blur();
  canvas.focus();
  if (audio) audio.start();
  const req = canvas.requestPointerLock?.();
  if (req?.catch) req.catch(() => (helpEl.hidden = false));
}

enterBtn.addEventListener('click', enter);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) enter();
});
soundBtn.addEventListener('click', toggleSound);
restartBtn.addEventListener('click', () => location.reload());

stateBtn.addEventListener('click', cycleState);

document.addEventListener('mousemove', (e) => {
  if (pointerLocked) {
    yaw += -e.movementX * 0.002;
    pitch = Math.min(1.25, Math.max(-1.25, pitch - e.movementY * 0.002));
  } else if (dragging) {
    yaw += -(e.clientX - lastX) * 0.002;
    pitch = Math.min(1.25, Math.max(-1.25, pitch - (e.clientY - lastY) * 0.002));
    lastX = e.clientX;
    lastY = e.clientY;
  }
});
canvas.addEventListener('pointerdown', (e) => {
  canvas.focus();
  if (!pointerLocked && entered) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  }
});
function endDrag(e) {
  dragging = false;
  if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => (dragging = false));
canvas.addEventListener('lostpointercapture', () => (dragging = false));

function setPose(x, z, newYaw) {
  const clamped = clampToRoom(x, z);
  const ex = {
    minX: CHAIR.minX - PLAYER_RADIUS,
    maxX: CHAIR.maxX + PLAYER_RADIUS,
    minZ: CHAIR.minZ - PLAYER_RADIUS,
    maxZ: CHAIR.maxZ + PLAYER_RADIUS,
  };
  if (clamped.x > ex.minX && clamped.x < ex.maxX && clamped.z > ex.minZ && clamped.z < ex.maxZ) {
    clamped.z = ex.maxZ;
  }
  pose.x = clamped.x;
  pose.z = clamped.z;
  if (typeof newYaw === 'number') yaw = newYaw;
}

if (TEST_MODE) {
  window.__lobbyTest = {
    getState: () => ({ x: pose.x, z: pose.z, loaded, state: sequence.state, entered }),
    setPose,
    setPitch: (p) => {
      pitch = Math.min(1.25, Math.max(-1.25, p));
    },
    setState: (name) => {
      sequence.setState(name);
      setStateLabel();
    },
    levels: () => ({ ...sequence.levels }),
    pause,
    debug: { scene, rig, mats, room, chair, props, details },
  };
}

const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.1, clock.getDelta());
  const active = entered && document.hasFocus() && !document.hidden;
  if (active) elapsed += dt;
  let moving = 0;
  if (active) {
    const dir = directionFromKeys(keys, yaw);
    moving = Math.hypot(dir.x, dir.z) > 0 ? 1 : 0;
    const p = movePlayer(pose, dir, dt);
    moving = Math.hypot(p.x - pose.x, p.z - pose.z) > 1e-5 ? 1 : 0;
    pose.x = p.x;
    pose.z = p.z;
  }

  const previousState = sequence.state;
  const frame = sequence.update(active ? dt : 0, { distance: distanceToChair(pose.x, pose.z) });
  if (frame.state !== previousState) setStateLabel();
  for (const event of frame.events) {
    if (audio) audio.cue(event);
    if (CUE_TEXT[event]) showCue(CUE_TEXT[event]);
  }
  if (audio) audio.setLevels(frame.levels);
  applyLevels(rig, mats, refs, frame.levels, elapsed, active ? dt : 0);
  if (active) {
    for (const event of animateDetails(details, rig, mats, refs, frame.levels, elapsed, dt)) {
      if (audio) audio.cue(event);
    }
  }

  bobPhase += dt * 7.5 * moving;
  const bob = headBob(bobPhase, moving);
  camera.position.set(pose.x, PLAYER_EYE + bob.y, pose.z);
  camera.rotation.set(pitch, yaw, bob.roll);

  if (cueTimer > 0) {
    cueTimer -= dt;
    if (cueTimer <= 0) cueEl.hidden = true;
  }

  telemetry.dataset.x = pose.x.toFixed(3);
  telemetry.dataset.z = pose.z.toFixed(3);
  telemetry.dataset.loaded = String(loaded);
  telemetry.dataset.mode = frame.state;
  telemetry.dataset.state = frame.state;
  telemetry.dataset.distance = distanceToChair(pose.x, pose.z).toFixed(3);
  telemetry.dataset.lamp = frame.levels.lamp.toFixed(3);
  telemetry.dataset.entered = String(entered);

  renderer.render(scene, camera);
}

loaded = true;
statusEl.textContent = 'Cellule active · robot final en attente';
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
