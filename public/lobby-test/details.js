import { ROOM } from './movement.js';

const THREE = globalThis.THREE;

const CEIL = ROOM.height;
const TUBULAR = 36;
const RADIAL = 7;

function v3(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

// A sagging cable through the given points. `swayWeight` tells the animation
// how much each ring along the tube may move: 0 at a fixed anchor, 1 at a
// free end.
function makeCable(points, radius, material, swayWeight) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.6);
  const geo = new THREE.TubeGeometry(curve, TUBULAR, radius, RADIAL, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  const base = geo.attributes.position.array.slice();
  const weights = new Float32Array(TUBULAR + 1);
  for (let i = 0; i <= TUBULAR; i++) weights[i] = swayWeight(i / TUBULAR);
  mesh.userData.cable = { base, weights, curve };
  return mesh;
}

const FREE_END = (t) => t * t;
const SLUNG = (t) => Math.sin(Math.PI * t);

// Catenary between two ceiling points, drooping by `sag`.
function slung(ax, az, bx, bz, sag, lift = 0) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const drop = Math.sin(Math.PI * t) * sag;
    pts.push(v3(ax + (bx - ax) * t, CEIL - 0.03 - drop + lift * t, az + (bz - az) * t));
  }
  return pts;
}

// Cut cable hanging from the ceiling with a slight kink.
function dangling(x, z, length, lean = 0.08) {
  return [
    v3(x, CEIL - 0.02, z),
    v3(x + lean * 0.2, CEIL - length * 0.3, z + lean * 0.1),
    v3(x + lean * 0.7, CEIL - length * 0.7, z + lean * 0.4),
    v3(x + lean, CEIL - length, z + lean * 0.6),
  ];
}

function tapeRing(mesh, t, radius, material) {
  const { curve } = mesh.userData.cable;
  const p = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.035, 10), material);
  ring.position.copy(p);
  ring.quaternion.setFromUnitVectors(v3(0, 1, 0), tangent);
  return ring;
}

function copperEnd(mesh, material, radius) {
  const { curve } = mesh.userData.cable;
  const p = curve.getPointAt(1);
  const tangent = curve.getTangentAt(1);
  const strands = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0015, 0.055, 5), material);
    strand.position.set(Math.cos(a) * radius * 0.45, -0.025, Math.sin(a) * radius * 0.45);
    strand.rotation.x = Math.sin(a) * 0.5;
    strand.rotation.z = Math.cos(a) * 0.5;
    strands.add(strand);
  }
  strands.position.copy(p);
  strands.quaternion.setFromUnitVectors(v3(0, -1, 0), tangent);
  return strands;
}

function junctionBox(x, z, mats, open) {
  const g = new THREE.Group();
  g.position.set(x, CEIL - 0.04, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.14), mats.paintedSteel);
  body.castShadow = true;
  g.add(body);
  if (open) {
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.006, 0.14), mats.paintedSteel);
    lid.position.set(0.02, -0.043, 0.09);
    lid.rotation.x = -1.35;
    g.add(lid);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.11), mats.dark);
    inner.position.y = -0.03;
    g.add(inner);
  } else {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 6), mats.steel);
        screw.position.set(sx * 0.07, -0.042, sz * 0.05);
        g.add(screw);
      }
    }
  }
  return g;
}

// Rigid conduit along the ceiling with clamps every 60 cm.
function conduit(ax, az, bx, bz, mats, group) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, len, 10), mats.paintedSteel);
  pipe.position.set((ax + bx) / 2, CEIL - 0.045, (az + bz) / 2);
  pipe.quaternion.setFromUnitVectors(v3(0, 1, 0), v3(dx / len, 0, dz / len));
  pipe.castShadow = true;
  group.add(pipe);
  const clamps = Math.max(1, Math.floor(len / 0.6));
  for (let i = 1; i <= clamps; i++) {
    const t = i / (clamps + 1);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.05), mats.steel);
    clamp.position.set(ax + dx * t, CEIL - 0.03, az + dz * t);
    clamp.rotation.y = -Math.atan2(dz, dx);
    group.add(clamp);
  }
}

function softDot() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const DUST_BOX = { x: 1.1, y0: 0.35, y1: 2.05, z: 1.1, zc: 0.05 };
const DUST_COUNT = 260;

function buildDust(scene, sprite) {
  const positions = new Float32Array(DUST_COUNT * 3);
  const velocity = new Float32Array(DUST_COUNT * 3);
  const phase = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2 * DUST_BOX.x;
    positions[i * 3 + 1] = DUST_BOX.y0 + Math.random() * (DUST_BOX.y1 - DUST_BOX.y0);
    positions[i * 3 + 2] = DUST_BOX.zc + (Math.random() - 0.5) * 2 * DUST_BOX.z;
    velocity[i * 3] = (Math.random() - 0.5) * 0.03;
    velocity[i * 3 + 1] = -0.004 - Math.random() * 0.012;
    velocity[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff2dc, size: 0.014, map: sprite, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return { points, velocity, phase };
}

const SPARK_COUNT = 48;

function buildSparks(scene, sprite, origin) {
  const positions = new Float32Array(SPARK_COUNT * 3);
  const colors = new Float32Array(SPARK_COUNT * 3);
  const velocity = new Float32Array(SPARK_COUNT * 3);
  const life = new Float32Array(SPARK_COUNT);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.03, map: sprite, transparent: true, vertexColors: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  const light = new THREE.PointLight(0xa9d4ff, 0, 3.2, 2);
  light.position.copy(origin);
  scene.add(light);
  return { points, velocity, life, light, origin: origin.clone(), tip: origin.clone() };
}

export function buildDetails(scene, mats, rig) {
  const group = new THREE.Group();
  const cables = [];

  const mount = { x: 0, z: -0.15 };

  // Junction boxes and rigid conduit feeding the lamp; one box was opened
  // and never closed again.
  const boxA = { x: 0.95, z: -1.0 };
  const boxB = { x: -0.9, z: 0.8 };
  const boxC = { x: 1.4, z: 1.2 };
  group.add(junctionBox(boxA.x, boxA.z, mats, true));
  group.add(junctionBox(boxB.x, boxB.z, mats, false));
  group.add(junctionBox(boxC.x, boxC.z, mats, false));
  conduit(boxC.x, boxC.z, boxA.x + 0.09, boxA.z + 0.02, mats, group);
  conduit(boxB.x, boxB.z, -ROOM.halfX + 0.42, 0.8, mats, group);
  conduit(boxA.x, boxA.z, ROOM.halfX - 0.3, -1.0, mats, group);

  // Slung feeds from the boxes to the lamp mount.
  const feedA = makeCable(slung(boxA.x - 0.06, boxA.z + 0.04, mount.x + 0.13, mount.z - 0.06, 0.42), 0.013, mats.rubber, SLUNG);
  const feedA2 = makeCable(slung(boxA.x - 0.04, boxA.z + 0.08, mount.x + 0.1, mount.z - 0.02, 0.5), 0.009, mats.rubberBlue, SLUNG);
  const feedB = makeCable(slung(boxB.x + 0.07, boxB.z - 0.05, mount.x - 0.12, mount.z + 0.06, 0.58), 0.013, mats.rubber, SLUNG);
  const feedB2 = makeCable(slung(boxB.x + 0.09, boxB.z - 0.02, mount.x - 0.1, mount.z + 0.1, 0.5), 0.009, mats.rubberGrey, SLUNG);
  cables.push(feedA, feedA2, feedB, feedB2);
  for (const c of [feedA, feedB]) {
    group.add(tapeRing(c, 0.3, 0.02, mats.tape));
    group.add(tapeRing(c, 0.72, 0.02, mats.tape));
  }

  // Cut cable near the lamp, still live: copper showing, sparks now and then.
  const live = makeCable(dangling(0.72, -0.62, 0.78, 0.09), 0.012, mats.rubber, FREE_END);
  cables.push(live);
  group.add(tapeRing(live, 0.55, 0.018, mats.warningTape));
  group.add(copperEnd(live, mats.copper, 0.012));
  const liveTip = live.userData.cable.curve.getPointAt(1);

  // Dead cable by the vent, taped off and left there.
  const dead = makeCable(dangling(-2.05, 1.35, 1.15, 0.12), 0.014, mats.rubber, FREE_END);
  cables.push(dead);
  group.add(tapeRing(dead, 0.96, 0.02, mats.warningTape));
  group.add(tapeRing(dead, 0.9, 0.02, mats.warningTape));

  // A long one slung right across the room towards the door: someone ran a
  // temporary line and it stayed.
  const across = makeCable(slung(boxB.x - 0.05, boxB.z + 0.06, ROOM.halfX - 0.25, 1.35, 0.72), 0.011, mats.rubberGrey, SLUNG);
  cables.push(across);
  group.add(tapeRing(across, 0.5, 0.017, mats.tape));

  // Power to the head, running down beside the arm and moving with the lamp.
  const lampFeed = makeCable([
    v3(0.11, -0.03, -0.02), v3(0.14, -0.28, 0.02), v3(0.12, -0.56, 0.14), v3(0.2, -0.8, 0.33), v3(0.26, -0.97, 0.42),
  ], 0.011, mats.rubber, () => 0);
  const lampFeed2 = makeCable([
    v3(-0.1, -0.03, 0.0), v3(-0.13, -0.3, 0.06), v3(-0.16, -0.58, 0.18), v3(-0.24, -0.82, 0.36), v3(-0.28, -0.97, 0.44),
  ], 0.008, mats.rubberGrey, () => 0);
  rig.lamp.add(lampFeed, lampFeed2);
  rig.lamp.add(tapeRing(lampFeed, 0.42, 0.017, mats.tape));
  rig.lamp.add(tapeRing(lampFeed2, 0.4, 0.014, mats.tape));

  for (const c of cables) group.add(c);
  scene.add(group);

  const sprite = softDot();
  const dust = buildDust(scene, sprite);
  const sparks = buildSparks(scene, sprite, liveTip);

  return {
    group,
    cables,
    dust,
    sparks,
    live,
    liveTip,
    sparkTimer: 4 + Math.random() * 5,
    sparkBurst: 0,
    stutterTimer: 7 + Math.random() * 9,
    stutter: 0,
    wind: { x: 0, z: 0 },
  };
}

const tmp = new THREE.Vector3();

function swayCables(details, time, levels) {
  const gust = 0.3 + levels.fan * 1.2;
  for (const cable of details.cables) {
    const { base, weights } = cable.userData.cable;
    const arr = cable.geometry.attributes.position.array;
    const seed = cable.id * 0.37;
    for (let i = 0; i <= TUBULAR; i++) {
      const w = weights[i];
      if (w === 0) continue;
      const dx = (Math.sin(time * 0.9 + seed) * 0.022 + Math.sin(time * 2.3 + seed * 1.7) * 0.006) * gust * w;
      const dz = (Math.cos(time * 0.7 + seed * 0.6) * 0.018 + Math.sin(time * 1.9 + seed) * 0.005) * gust * w;
      const dy = -(Math.abs(dx) + Math.abs(dz)) * 0.35 * w;
      for (let j = 0; j <= RADIAL; j++) {
        const k = (i * (RADIAL + 1) + j) * 3;
        arr[k] = base[k] + dx;
        arr[k + 1] = base[k + 1] + dy;
        arr[k + 2] = base[k + 2] + dz;
      }
    }
    cable.geometry.attributes.position.needsUpdate = true;
  }
  // the live cable's tip follows its last ring
  const live = details.live.userData.cable;
  const arr = details.live.geometry.attributes.position.array;
  const k = TUBULAR * (RADIAL + 1) * 3;
  const b = TUBULAR * (RADIAL + 1) * 3;
  details.sparks.tip.set(
    details.liveTip.x + (arr[k] - live.base[b]),
    details.liveTip.y + (arr[k + 1] - live.base[b + 1]),
    details.liveTip.z + (arr[k + 2] - live.base[b + 2]),
  );
}

function driftDust(details, dt, levels, time) {
  const { points, velocity, phase } = details.dust;
  const arr = points.geometry.attributes.position.array;
  const lift = levels.fan * 0.01;
  for (let i = 0; i < DUST_COUNT; i++) {
    const k = i * 3;
    arr[k] += (velocity[k] + Math.sin(time * 0.6 + phase[i]) * 0.012) * dt;
    arr[k + 1] += (velocity[k + 1] + lift + Math.sin(time * 0.4 + phase[i] * 1.3) * 0.004) * dt;
    arr[k + 2] += (velocity[k + 2] + Math.cos(time * 0.5 + phase[i]) * 0.012) * dt;
    if (arr[k + 1] < DUST_BOX.y0) arr[k + 1] = DUST_BOX.y1;
    if (arr[k + 1] > DUST_BOX.y1) arr[k + 1] = DUST_BOX.y0;
    if (arr[k] > DUST_BOX.x) arr[k] = -DUST_BOX.x;
    if (arr[k] < -DUST_BOX.x) arr[k] = DUST_BOX.x;
    if (arr[k + 2] > DUST_BOX.zc + DUST_BOX.z) arr[k + 2] = DUST_BOX.zc - DUST_BOX.z;
    if (arr[k + 2] < DUST_BOX.zc - DUST_BOX.z) arr[k + 2] = DUST_BOX.zc + DUST_BOX.z;
  }
  points.geometry.attributes.position.needsUpdate = true;
  // motes are only visible inside the beam
  points.material.opacity = Math.max(0, levels.lamp - 0.12) * 0.55 + levels.cove * 0.05;
}

function emitSparks(details, count) {
  const { points, velocity, life, tip } = details.sparks;
  const arr = points.geometry.attributes.position.array;
  let spawned = 0;
  for (let i = 0; i < SPARK_COUNT && spawned < count; i++) {
    if (life[i] > 0) continue;
    const k = i * 3;
    arr[k] = tip.x;
    arr[k + 1] = tip.y;
    arr[k + 2] = tip.z;
    tmp.set(Math.random() - 0.5, -Math.random() * 0.6 - 0.1, Math.random() - 0.5).normalize();
    const speed = 0.6 + Math.random() * 1.6;
    velocity[k] = tmp.x * speed;
    velocity[k + 1] = tmp.y * speed;
    velocity[k + 2] = tmp.z * speed;
    life[i] = 0.25 + Math.random() * 0.45;
    spawned++;
  }
  points.visible = true;
}

function updateSparks(details, dt) {
  const { points, velocity, life } = details.sparks;
  const arr = points.geometry.attributes.position.array;
  const col = points.geometry.attributes.color.array;
  let alive = 0;
  for (let i = 0; i < SPARK_COUNT; i++) {
    const k = i * 3;
    if (life[i] <= 0) {
      col[k] = col[k + 1] = col[k + 2] = 0;
      continue;
    }
    life[i] -= dt;
    velocity[k + 1] -= 6.5 * dt;
    arr[k] += velocity[k] * dt;
    arr[k + 1] += velocity[k + 1] * dt;
    arr[k + 2] += velocity[k + 2] * dt;
    if (arr[k + 1] < 0.005) {
      arr[k + 1] = 0.005;
      velocity[k + 1] *= -0.3;
      velocity[k] *= 0.6;
      velocity[k + 2] *= 0.6;
    }
    const f = Math.min(1, life[i] * 4);
    col[k] = 1.0 * f;
    col[k + 1] = 0.85 * f;
    col[k + 2] = 0.55 * f;
    alive++;
  }
  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate = true;
  points.visible = alive > 0;
}

// Runs after applyLevels: everything here only nudges what the lighting rig
// already set for this frame. Returns the names of the cues that fired.
export function animateDetails(details, rig, mats, refs, levels, time, dt) {
  const events = [];

  swayCables(details, time, levels);
  driftDust(details, dt, levels, time);

  // the whole lamp hangs from one mount and drifts with the air
  rig.lamp.rotation.z = Math.sin(time * 0.53) * 0.007 + Math.sin(time * 1.31) * 0.0025;
  rig.lamp.rotation.x = Math.cos(time * 0.47) * 0.006 + Math.sin(time * 1.13) * 0.002;
  rig.head.rotation.z = Math.sin(time * 0.8 + 1) * 0.004;

  // gas-discharge head: occasional stutter when it is running
  details.stutterTimer -= dt;
  if (details.stutterTimer <= 0 && levels.lamp > 0.5) {
    details.stutter = 0.18 + Math.random() * 0.25;
    details.stutterTimer = 6 + Math.random() * 14;
    events.push('lamp_stutter');
  }
  if (details.stutter > 0) {
    details.stutter -= dt;
    const dip = 0.55 + Math.abs(Math.sin(time * 61)) * 0.45;
    rig.spot.intensity *= dip;
    for (const mat of rig.lensMaterials) mat.emissiveIntensity *= dip;
    rig.beam.material.opacity *= dip;
  }

  // the cove strips are on a tired ballast
  mats.cove.emissiveIntensity *= 1 + Math.sin(time * 37) * 0.012 + Math.sin(time * 5.1) * 0.02;

  // cut cable: live whenever the room has power
  const power = Math.max(levels.lamp, levels.cove * 1.5, 0.15);
  details.sparkTimer -= dt;
  if (details.sparkTimer <= 0) {
    details.sparkBurst = 0.12 + Math.random() * 0.3;
    details.sparkTimer = (3 + Math.random() * 9) / power;
    emitSparks(details, 10 + Math.floor(Math.random() * 18));
    events.push('spark');
  }
  if (details.sparkBurst > 0) {
    details.sparkBurst -= dt;
    if (Math.random() < 0.35) emitSparks(details, 2);
    details.sparks.light.intensity = 1.2 + Math.random() * 2.6;
    details.sparks.light.position.copy(details.sparks.tip);
  } else {
    details.sparks.light.intensity *= Math.max(0, 1 - dt * 18);
  }
  updateSparks(details, dt);

  // standby heartbeat on the wall panel, and the badge reader waiting for a card
  const standby = Math.max(0, 1 - levels.diagnostic * 3) * levels.cove;
  const beat = Math.pow(Math.max(0, Math.sin(time * 1.6)), 12);
  if (refs.wallPanelLeds[0]) refs.wallPanelLeds[0].material.emissiveIntensity += standby * beat * 1.4;
  if (refs.doorReader) {
    refs.doorReader.material.emissiveIntensity = 0.2 + (Math.sin(time * 2.2) > 0.92 ? 2.2 : 0.4) * levels.cove;
  }

  return events;
}
