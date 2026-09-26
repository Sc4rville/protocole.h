import { ROOM_HALF, PLAYER_RADIUS, CHAIR, movePlayer, directionFromKeys } from './movement.js';

const THREE = globalThis.THREE;
const TEST_MODE = new URLSearchParams(location.search).has('test');

const host = document.getElementById('canvas-host');
const overlay = document.getElementById('overlay');
const enterBtn = document.getElementById('enter');
const lightingBtn = document.getElementById('lighting');
const statusEl = document.getElementById('status');
const helpEl = document.getElementById('help');
const telemetry = document.getElementById('telemetry');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
host.appendChild(renderer.domElement);
const canvas = renderer.domElement;
canvas.tabIndex = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9d9d2);
scene.fog = new THREE.Fog(0xd9d9d2, 10, 24);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 50);
camera.position.set(0, 1.6, 3.2);
camera.rotation.order = 'YXZ';
let yaw = 0;
let pitch = -0.08;

const hemi = new THREE.HemisphereLight(0xf5f4ee, 0x9a988f, 0.6);
scene.add(hemi);

const spot = new THREE.SpotLight(0xfffdf4, 1.25, 0, Math.PI / 4.8, 0.5, 1.1);
spot.position.set(0.2, 3.1, 0.6);
spot.target.position.set(0, 0.8, -0.1);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0004;
scene.add(spot, spot.target);

const fill = new THREE.PointLight(0xd8d5cb, 0.3, 0, 2);
fill.position.set(-2.4, 2.3, 2.4);
scene.add(fill);

const LIGHT_MODES = {
  clinique: { spot: 0xfffdf4, intensity: 1.25, hemi: 0.6, fill: 0.3,
              panel: 0xfffdf4, panelEmit: 1.4, bg: 0xd9d9d2 },
  alerte:   { spot: 0xffc9b4, intensity: 0.8, hemi: 0.28, fill: 0.15,
              panel: 0xd8543e, panelEmit: 0.7, bg: 0x8f8d88 },
};
let mode = 'clinique';
const lightFrom = {};
const lightTo = {};
let lightT = 1;
const LIGHT_LERP = 0.3;

const matWall = new THREE.MeshStandardMaterial({ color: 0xe9e8e2, roughness: 0.92 });
const matFloor = new THREE.MeshStandardMaterial({ color: 0xe2e1da, roughness: 0.9 });
const matJoint = new THREE.MeshStandardMaterial({ color: 0xb8b6ac, roughness: 0.8 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.6 });
const matIvory = new THREE.MeshStandardMaterial({ color: 0xeceae2, roughness: 0.55 });
const matCharcoal = new THREE.MeshStandardMaterial({ color: 0x35373b, roughness: 0.5, metalness: 0.35 });
const matCushion = new THREE.MeshStandardMaterial({ color: 0xcfccc0, roughness: 0.95 });
const matPanel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffdf4, emissiveIntensity: 1.4 });

const floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 8), matFloor);
floor.position.y = -0.05;
floor.receiveShadow = true;
scene.add(floor);

function seam(w, d, x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.003, d), matJoint);
  m.position.set(x, 0.002, z);
  scene.add(m);
}
for (const g of [-2, 0, 2]) {
  seam(0.015, 8, g, 0);
  seam(8, 0.015, 0, g);
}
const drain = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 2.6), matDark);
drain.position.set(0, 0.003, 2.25);
scene.add(drain);

const ceiling = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 8), matWall);
ceiling.position.y = 3.25;
scene.add(ceiling);

const panelFrame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 2.4), matDark);
panelFrame.position.set(0.2, 3.19, 0.6);
scene.add(panelFrame);
const lightPanel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 2.2), matPanel);
lightPanel.position.set(0.2, 3.17, 0.6);
scene.add(lightPanel);

function wall(w, h, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), matWall);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  scene.add(m);
}
wall(8, 3.2, 0, 1.6, -4, 0);
wall(8, 3.2, 0, 1.6, 4, 0);
wall(8, 3.2, -4, 1.6, 0, Math.PI / 2);
wall(8, 3.2, 4, 1.6, 0, Math.PI / 2);

function wallJoint(w, h, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.008), matJoint);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
}
for (const wx of [-2.7, 0, 2.7]) wallJoint(0.012, 3.2, wx, 1.6, -3.93, 0);
wallJoint(8, 0.012, 0, 0.55, -3.93, 0);
for (const wz of [-2.7, 0, 2.7]) {
  wallJoint(0.012, 3.2, -3.93, 1.6, wz, Math.PI / 2);
  wallJoint(0.012, 3.2, 3.93, 1.6, wz, Math.PI / 2);
}
wallJoint(0.012, 3.2, 3.93, 1.6, -2.7, Math.PI / 2);

const slitFrame = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.5, 0.04), matWall);
slitFrame.position.set(0, 1.9, -3.91);
scene.add(slitFrame);
const slitInset = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.32, 0.03), matDark);
slitInset.position.set(0, 1.9, -3.88);
scene.add(slitInset);

const doorZ = 1.8;
for (const [dx, dz, w, h] of [[-0.45, 0, 0.012, 2.1], [0.45, 0, 0.012, 2.1], [0, 1.05, 0.9, 0.012]]) {
  const j = new THREE.Mesh(new THREE.BoxGeometry(0.008, h, w === 0.9 ? 0.9 : w), matJoint);
  j.position.set(3.93, dz + 1.05, doorZ + dx);
  scene.add(j);
}
const doorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.015, 2.1, 0.9), matWall);
doorPlate.position.set(3.94, 1.05, doorZ);
scene.add(doorPlate);

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function extrudedPanel(w, h, depth, mat) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, Math.min(w, h) * 0.18), {
    depth, bevelEnabled: true, bevelSegments: 2, steps: 1,
    bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 5,
  });
  geo.center();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const chair = new THREE.Group();
const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.8), matCharcoal);
pedestal.position.y = 0.275;
pedestal.castShadow = true;
pedestal.receiveShadow = true;
chair.add(pedestal);

const seatShell = extrudedPanel(0.95, 0.62, 0.09, matIvory);
seatShell.rotation.x = -Math.PI / 2;
seatShell.position.set(0, 0.58, -0.05);
chair.add(seatShell);
const seatCushion = extrudedPanel(0.78, 0.5, 0.06, matCushion);
seatCushion.rotation.x = -Math.PI / 2;
seatCushion.position.set(0, 0.65, -0.05);
chair.add(seatCushion);

const backShell = extrudedPanel(0.95, 1.15, 0.09, matIvory);
backShell.position.set(0, 1.2, -0.62);
backShell.rotation.x = -0.1;
chair.add(backShell);
const backCushion = extrudedPanel(0.78, 0.95, 0.06, matCushion);
backCushion.position.set(0, 1.22, -0.56);
backCushion.rotation.x = -0.1;
chair.add(backCushion);

const headrest = extrudedPanel(0.5, 0.3, 0.07, matIvory);
headrest.position.set(0, 1.78, -0.68);
headrest.rotation.x = -0.15;
chair.add(headrest);
const headPad = extrudedPanel(0.4, 0.22, 0.05, matCushion);
headPad.position.set(0, 1.79, -0.63);
headPad.rotation.x = -0.15;
chair.add(headPad);

const footBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), matCharcoal);
footBar.position.set(0, 0.3, 0.75);
footBar.rotation.x = 0.5;
footBar.castShadow = true;
chair.add(footBar);
const footRest = extrudedPanel(0.55, 0.3, 0.05, matIvory);
footRest.rotation.x = -Math.PI / 2 + 0.15;
footRest.position.set(0, 0.18, 0.9);
chair.add(footRest);

for (const sx of [-1, 1]) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), matCharcoal);
  post.position.set(sx * 0.55, 0.72, 0.05);
  post.castShadow = true;
  chair.add(post);
  const arm = extrudedPanel(0.14, 0.62, 0.07, matIvory);
  arm.rotation.x = -Math.PI / 2;
  arm.position.set(sx * 0.55, 0.9, 0.05);
  chair.add(arm);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 20, Math.PI), matCharcoal);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(sx * 0.55, 0.94, 0.28);
  cuff.castShadow = true;
  chair.add(cuff);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), matDark);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(sx * 0.64, 0.9, 0.28);
  knob.castShadow = true;
  chair.add(knob);
}

const trayArm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), matCharcoal);
trayArm.position.set(-0.6, 0.75, 0.35);
trayArm.castShadow = true;
chair.add(trayArm);
const tray = extrudedPanel(0.55, 0.4, 0.04, matIvory);
tray.rotation.x = -Math.PI / 2;
tray.position.set(-0.35, 0.78, 0.55);
chair.add(tray);

const probeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), matDark);
probeHandle.rotation.z = Math.PI / 2;
probeHandle.position.set(-0.45, 0.82, 0.5);
probeHandle.castShadow = true;
chair.add(probeHandle);
const probeTip = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.002, 0.12, 8), matCharcoal);
probeTip.rotation.z = Math.PI / 2;
probeTip.position.set(-0.32, 0.82, 0.5);
probeTip.castShadow = true;
chair.add(probeTip);

for (const px of [-1, 1]) {
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), matDark);
  handle.rotation.x = Math.PI / 2.4;
  handle.position.set(-0.3 + px * 0.035, 0.82, 0.66);
  handle.castShadow = true;
  chair.add(handle);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), matCharcoal);
  jaw.position.set(-0.3 + px * 0.02, 0.85, 0.58);
  jaw.rotation.x = px * 0.35;
  jaw.castShadow = true;
  chair.add(jaw);
}
const pliersPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10), matCharcoal);
pliersPivot.position.set(-0.3, 0.84, 0.61);
chair.add(pliersPivot);

scene.add(chair);

let loaded = false;
let entered = false;
let pointerLocked = false;
let dragging = false;
let lastX = 0, lastY = 0;
const keys = new Set();
const pose = { x: 0, z: 3.2 };

function pause() {
  entered = false;
  keys.clear();
  dragging = false;
  overlay.hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
}

function snapshot() {
  return {
    spot: spot.color.getHex(), intensity: spot.intensity, hemi: hemi.intensity,
    fill: fill.intensity, panel: matPanel.emissive.getHex(),
    panelEmit: matPanel.emissiveIntensity, bg: scene.background.getHex(),
  };
}
function applyTarget(m) {
  const p = LIGHT_MODES[m];
  lightTo.spot = p.spot; lightTo.intensity = p.intensity; lightTo.hemi = p.hemi;
  lightTo.fill = p.fill; lightTo.panel = p.panel; lightTo.panelEmit = p.panelEmit;
  lightTo.bg = p.bg;
}
function applyMode(m) {
  if (m === mode) return;
  mode = m;
  Object.assign(lightFrom, snapshot());
  applyTarget(m);
  lightT = 0;
  lightingBtn.textContent = 'Éclairage : ' + m;
}
function toggleLighting() { applyMode(mode === 'clinique' ? 'alerte' : 'clinique'); }
applyTarget('clinique');

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyL') { toggleLighting(); return; }
  if (e.code === 'Escape') { pause(); return; }
  if (!entered) return;
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
document.addEventListener('pointerlockchange', () => {
  const was = pointerLocked;
  pointerLocked = document.pointerLockElement === canvas;
  if (was && !pointerLocked) pause();
});
document.addEventListener('pointerlockerror', () => {
  helpEl.hidden = false;
});

enterBtn.addEventListener('click', () => {
  entered = true;
  overlay.hidden = true;
  enterBtn.blur();
  canvas.focus();
  const req = canvas.requestPointerLock && canvas.requestPointerLock();
  if (req && req.catch) req.catch(() => { helpEl.hidden = false; });
});

lightingBtn.addEventListener('click', toggleLighting);

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
  if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('lostpointercapture', () => { dragging = false; });

function setPose(x, z, newYaw) {
  let p = movePlayer({ x, z }, { x: 0, z: 0 }, 0);
  const lim = ROOM_HALF - PLAYER_RADIUS;
  p.x = Math.min(lim, Math.max(-lim, p.x));
  p.z = Math.min(lim, Math.max(-lim, p.z));
  const ex = { minX: CHAIR.minX - PLAYER_RADIUS, maxX: CHAIR.maxX + PLAYER_RADIUS,
               minZ: CHAIR.minZ - PLAYER_RADIUS, maxZ: CHAIR.maxZ + PLAYER_RADIUS };
  if (p.x > ex.minX && p.x < ex.maxX && p.z > ex.minZ && p.z < ex.maxZ) {
    p.z = ex.maxZ;
  }
  pose.x = p.x;
  pose.z = p.z;
  if (typeof newYaw === 'number') yaw = newYaw;
}

if (TEST_MODE) {
  window.__lobbyTest = {
    getState: () => ({ x: pose.x, z: pose.z, loaded, mode, entered }),
    setPose,
    pause,
  };
}

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  if (entered && document.hasFocus() && !document.hidden) {
    const dir = directionFromKeys(keys, yaw);
    const p = movePlayer(pose, dir, dt);
    pose.x = p.x;
    pose.z = p.z;
  }
  camera.position.x = pose.x;
  camera.position.z = pose.z;
  camera.rotation.set(pitch, yaw, 0);
  if (lightT < 1) {
    lightT = Math.min(1, lightT + dt / LIGHT_LERP);
    const k = lightT;
    const cl = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
    spot.color.setHex(cl(lightFrom.spot, lightTo.spot));
    spot.intensity = lightFrom.intensity + (lightTo.intensity - lightFrom.intensity) * k;
    hemi.intensity = lightFrom.hemi + (lightTo.hemi - lightFrom.hemi) * k;
    fill.intensity = lightFrom.fill + (lightTo.fill - lightFrom.fill) * k;
    matPanel.emissive.setHex(cl(lightFrom.panel, lightTo.panel));
    matPanel.emissiveIntensity = lightFrom.panelEmit + (lightTo.panelEmit - lightFrom.panelEmit) * k;
    scene.background.setHex(cl(lightFrom.bg, lightTo.bg));
    scene.fog.color.setHex(cl(lightFrom.bg, lightTo.bg));
  }
  telemetry.dataset.x = pose.x.toFixed(3);
  telemetry.dataset.z = pose.z.toFixed(3);
  telemetry.dataset.loaded = String(loaded);
  telemetry.dataset.mode = mode;
  telemetry.dataset.entered = String(entered);
  renderer.render(scene, camera);
}
loaded = true;
statusEl.textContent = 'Salle chargée · robot final en attente';
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
