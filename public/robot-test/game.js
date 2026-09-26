import { createMaterials } from '../lobby-test/materials.js';
import { buildRobot, createRobotMaterials } from './robot.js';

const THREE = globalThis.THREE;
const TEST_MODE = new URLSearchParams(location.search).has('test');

const host = document.getElementById('canvas-host');
const statusEl = document.getElementById('status');
const telemetry = document.getElementById('telemetry');
const poseButtons = [...document.querySelectorAll('[data-pose]')];
const turnBtn = document.getElementById('turn');
const cellBtn = document.getElementById('cell');
const wireBtn = document.getElementById('wire');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
host.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 40);
const orbit = { yaw: 0.55, pitch: 0.12, dist: 3.6, targetY: 1.0 };

// Same environment map as the white cell so metals and dark resin read the same in both scenes.
const cellMats = createMaterials(renderer);
const mats = createRobotMaterials(cellMats.envMap);
const robot = buildRobot(mats);
scene.add(robot.group);

// Two backdrops: neutral photo-studio gray (matches the reference sheet) and the cell's white light.
const STUDIO = { bg: 0xc9c9c7, floor: 0xbdbdbb, hemiSky: 0xf0f0ee, hemiGround: 0x6f6f6c, key: 0xfff4e6, fill: 0xd6e2f0 };
const CELL = { bg: 0xe9e8e2, floor: 0xdedcd4, hemiSky: 0xeff0ec, hemiGround: 0x8e8c86, key: 0xfff3e0, fill: 0xdce6f0 };

const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: STUDIO.floor, roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const hemi = new THREE.HemisphereLight(STUDIO.hemiSky, STUDIO.hemiGround, 0.4);
scene.add(hemi);

const key = new THREE.SpotLight(STUDIO.key, 1.6, 12, Math.PI / 5, 0.6, 1.2);
key.position.set(1.8, 3.6, 2.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.01;
key.target.position.set(0, 1.0, 0);
scene.add(key, key.target);

const fill = new THREE.DirectionalLight(STUDIO.fill, 0.55);
fill.position.set(-2.5, 2.0, 1.0);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.7);
rim.position.set(-0.5, 2.5, -3);
scene.add(rim);

let cellLight = false;
function applyBackdrop() {
  const p = cellLight ? CELL : STUDIO;
  scene.background = new THREE.Color(p.bg);
  floor.material.color.setHex(p.floor);
  hemi.color.setHex(p.hemiSky);
  hemi.groundColor.setHex(p.hemiGround);
  key.color.setHex(p.key);
  fill.color.setHex(p.fill);
  hemi.intensity = cellLight ? 0.6 : 0.4;
  key.intensity = cellLight ? 1.1 : 1.6;
  rim.intensity = cellLight ? 0.3 : 0.7;
  document.body.style.background = '#' + p.bg.toString(16).padStart(6, '0');
  cellBtn.setAttribute('aria-pressed', String(cellLight));
}
applyBackdrop();

let autoTurn = !TEST_MODE;
let wire = false;
let dragging = false;
let lastX = 0;
let lastY = 0;

function setPose(name) {
  if (!robot.setPose(name)) return;
  for (const b of poseButtons) b.setAttribute('aria-pressed', String(b.dataset.pose === name));
  statusEl.textContent = 'Pose : ' + name + ' · ' + robot.meshCount + ' pièces';
}

function setWire(on) {
  wire = on;
  robot.group.traverse((o) => {
    if (o.isMesh) o.material.wireframe = on;
  });
  wireBtn.setAttribute('aria-pressed', String(on));
}

function setTurn(on) {
  autoTurn = on;
  turnBtn.setAttribute('aria-pressed', String(on));
}

for (const b of poseButtons) b.addEventListener('click', () => setPose(b.dataset.pose));
turnBtn.addEventListener('click', () => setTurn(!autoTurn));
wireBtn.addEventListener('click', () => setWire(!wire));
cellBtn.addEventListener('click', () => {
  cellLight = !cellLight;
  applyBackdrop();
});

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') setPose(robot.poses[Number(e.code.slice(5)) - 1]);
  else if (e.code === 'KeyA') setTurn(!autoTurn);
  else if (e.code === 'KeyW') setWire(!wire);
  else if (e.code === 'KeyC') {
    cellLight = !cellLight;
    applyBackdrop();
  }
});

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  robot.lookAt((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  if (!dragging) return;
  orbit.yaw -= (e.clientX - lastX) * 0.006;
  orbit.pitch = Math.min(1.2, Math.max(-0.35, orbit.pitch + (e.clientY - lastY) * 0.005));
  lastX = e.clientX;
  lastY = e.clientY;
  if (autoTurn) setTurn(false);
});
const endDrag = () => (dragging = false);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbit.dist = Math.min(7, Math.max(0.6, orbit.dist * (1 + e.deltaY * 0.001)));
  orbit.targetY = orbit.dist < 1.6 ? 1.55 : 1.0;
}, { passive: false });

if (TEST_MODE) {
  window.__robotTest = {
    setPose,
    setOrbit: (yaw, pitch, dist, targetY) => Object.assign(orbit, { yaw, pitch, dist, targetY: targetY ?? orbit.targetY }),
    setTurn,
    setCellLight: (on) => {
      cellLight = on;
      applyBackdrop();
    },
    robot,
    debug: { scene, mats, camera },
  };
}

const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  if (autoTurn) orbit.yaw += dt * 0.35;
  robot.update(dt, elapsed);

  // keep the camera above the floor whatever the pitch/distance combination
  const minPitch = Math.asin(Math.min(0.99, Math.max(-0.99, (0.15 - orbit.targetY) / orbit.dist)));
  orbit.pitch = Math.max(minPitch, orbit.pitch);
  camera.position.set(
    Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
    orbit.targetY + Math.sin(orbit.pitch) * orbit.dist,
    Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
  );
  camera.lookAt(0, orbit.targetY, 0);

  telemetry.dataset.loaded = 'true';
  telemetry.dataset.pose = robot.pose;
  telemetry.dataset.meshes = String(robot.meshCount);
  telemetry.dataset.headY = String(robot.joints.head.getWorldPosition(new THREE.Vector3()).y.toFixed(3));
  renderer.render(scene, camera);
}

setPose('debout');
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
