import { PROPS } from './movement.js';

const THREE = globalThis.THREE;

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function roundedBox(w, h, d, r, mat) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 6 });
  geo.center();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Mayo stand from reference 17-plateau-outils: rimmed tray on a single steel
// column, castor base. Tools are separate meshes so they can be picked later.
function buildToolTray(group, mats) {
  const spec = PROPS.tray;
  const tray = new THREE.Group();
  tray.position.set(spec.x, 0, spec.z);
  tray.rotation.y = spec.yaw;

  const base = new THREE.Group();
  for (const sx of [-1, 1]) {
    base.add(mesh(new THREE.BoxGeometry(0.05, 0.035, 0.46), mats.steel, sx * 0.19, 0.06, 0));
    base.add(mesh(new THREE.BoxGeometry(0.42, 0.035, 0.05), mats.steel, 0, 0.06, sx * 0.205));
    for (const sz of [-1, 1]) {
      const wheel = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14), mats.rubber, sx * 0.19, 0.04, sz * 0.2);
      wheel.rotation.z = Math.PI / 2;
      base.add(wheel);
    }
  }
  tray.add(base);
  tray.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.86, 16), mats.steel, 0, 0.5, 0));
  tray.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.14, 16), mats.charcoal, 0, 0.95, 0));

  const top = 1.02;
  const plate = roundedBox(0.62, 0.44, 0.018, 0.04, mats.shell);
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = top;
  tray.add(plate);
  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rimShape(0.62, 0.44, 0.03), { depth: 0.035, bevelEnabled: false }),
    mats.charcoal,
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = top + 0.008;
  rim.castShadow = true;
  tray.add(rim);

  // pliers, probe, a coiled cable: what the operator will reach for
  const pliers = new THREE.Group();
  pliers.position.set(-0.14, top + 0.02, 0.05);
  pliers.rotation.y = 0.5;
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.024, 0.014, 0.19), mats.gunmetal, s * 0.014, 0, 0);
    arm.rotation.y = s * 0.14;
    pliers.add(arm);
    pliers.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.07), mats.steel, s * 0.008, 0, -0.12));
  }
  tray.add(pliers);

  const probe = new THREE.Group();
  probe.position.set(0.12, top + 0.024, -0.05);
  probe.rotation.y = -0.35;
  const handle = mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 12), mats.dark, 0, 0, 0);
  handle.rotation.x = Math.PI / 2;
  const tip = mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.11, 8), mats.steel, 0, 0, 0.15);
  tip.rotation.x = Math.PI / 2;
  const probeLed = mesh(new THREE.BoxGeometry(0.02, 0.006, 0.035), mats.cyanStrip.clone(), 0, 0.017, -0.03);
  probe.add(handle, tip, probeLed);
  tray.add(probe);

  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 8, 32), mats.rubber);
  coil.position.set(0.15, top + 0.018, 0.12);
  coil.rotation.x = Math.PI / 2;
  coil.castShadow = true;
  tray.add(coil);

  group.add(tray);
  return { tray, probeLed, probe, pliers };
}

function rimShape(w, h, t) {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2, -h / 2);
  outer.lineTo(w / 2, -h / 2);
  outer.lineTo(w / 2, h / 2);
  outer.lineTo(-w / 2, h / 2);
  outer.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-w / 2 + t, -h / 2 + t);
  inner.lineTo(w / 2 - t, -h / 2 + t);
  inner.lineTo(w / 2 - t, h / 2 - t);
  inner.lineTo(-w / 2 + t, h / 2 - t);
  inner.closePath();
  outer.holes.push(inner);
  return outer;
}

// Energy station from reference 19-station-energie: white segmented column,
// dark seams, cyan status strip and a round port. Feeds the chair; the cable
// runs along the floor so the two read as one installation.
function buildEnergyStation(group, mats) {
  const spec = PROPS.station;
  const station = new THREE.Group();
  station.position.set(spec.x, 0, spec.z);
  station.rotation.y = spec.yaw;

  const plinth = roundedBox(0.7, 0.62, 0.08, 0.05, mats.charcoal);
  plinth.rotation.x = -Math.PI / 2;
  plinth.position.y = 0.04;
  station.add(plinth);
  const bodyW = 0.56;
  const bodyD = 0.5;
  const bodyH = 1.32;
  const body = roundedBox(bodyW, bodyH, bodyD, 0.07, mats.shell);
  body.position.y = 0.08 + bodyH / 2;
  station.add(body);
  // horizontal and vertical seams split the shell into panels
  for (const y of [0.52, 0.98]) {
    station.add(mesh(new THREE.BoxGeometry(bodyW + 0.004, 0.02, bodyD + 0.004), mats.dark, 0, y, 0));
  }
  station.add(mesh(new THREE.BoxGeometry(0.02, bodyH + 0.004, bodyD + 0.004), mats.dark, 0, 0.08 + bodyH / 2, 0));
  const cap = roundedBox(bodyW - 0.06, bodyD - 0.06, 0.05, 0.05, mats.charcoal);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = 0.08 + bodyH + 0.02;
  station.add(cap);

  const front = bodyD / 2 + 0.006;
  const strip = mesh(new THREE.BoxGeometry(0.035, 0.32, 0.012), mats.cyanStrip.clone(), 0.14, 1.1, front);
  station.add(strip);
  const portY = 0.72;
  for (const [geo, mat, dz] of [
    [new THREE.CylinderGeometry(0.11, 0.11, 0.03, 28), mats.charcoal, 0],
    [new THREE.CylinderGeometry(0.05, 0.05, 0.04, 20), mats.dark, 0.01],
    [new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12), mats.steel, 0.02],
  ]) {
    const part = mesh(geo, mat, 0, portY, front + dz);
    part.rotation.x = Math.PI / 2;
    station.add(part);
  }
  station.add(mesh(new THREE.TorusGeometry(0.095, 0.012, 10, 32), mats.steel, 0, portY, front + 0.015));

  const vents = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    vents.add(mesh(new THREE.BoxGeometry(0.03, 0.012, 0.014), mats.dark, -0.15 + i * 0.06, 0.16, front));
  }
  station.add(vents);

  // floor cable from the port to the chair base
  const from = new THREE.Vector3(0, 0.03, front + 0.05);
  const toWorld = new THREE.Vector3(0, 0.03, 0);
  station.updateMatrixWorld(true);
  const toLocal = station.worldToLocal(toWorld.clone());
  const mid = from.clone().lerp(toLocal, 0.5);
  mid.y = 0.03;
  mid.x += 0.35;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, portY - 0.05, front + 0.05),
    new THREE.Vector3(0, 0.25, front + 0.22),
    from,
    mid,
    toLocal,
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.022, 10, false), mats.rubber);
  cable.castShadow = true;
  station.add(cable);

  group.add(station);
  return { station, stationStrip: strip };
}

// Linear floor channel seen in reference 10-decor-vide: a long stainless
// gutter with a slotted grate, running from the treatment zone to the wall.
function buildDrainChannel(group, mats) {
  const channel = new THREE.Group();
  const length = 2.8;
  const x = 1.75;
  const zStart = 0.65;
  channel.position.set(x, 0, zStart + length / 2);

  const trough = mesh(new THREE.BoxGeometry(0.18, 0.02, length), mats.dark, 0, -0.012, 0);
  trough.castShadow = false;
  channel.add(trough);
  for (const s of [-1, 1]) {
    channel.add(mesh(new THREE.BoxGeometry(0.02, 0.006, length), mats.steel, s * 0.09, 0.003, 0));
  }
  const slots = Math.floor(length / 0.09);
  for (let i = 0; i < slots; i++) {
    const bar = mesh(new THREE.BoxGeometry(0.16, 0.005, 0.03), mats.steel, 0, 0.0025, -length / 2 + 0.045 + i * 0.09);
    bar.castShadow = false;
    channel.add(bar);
  }
  group.add(channel);
  return { channel };
}

export function buildProps(scene, mats) {
  const group = new THREE.Group();
  const tray = buildToolTray(group, mats);
  const station = buildEnergyStation(group, mats);
  const drain = buildDrainChannel(group, mats);
  scene.add(group);
  return { group, ...tray, ...station, ...drain };
}
