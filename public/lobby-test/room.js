import { ROOM } from './movement.js';

const THREE = globalThis.THREE;

const WALL_TOP = ROOM.height - ROOM.ceilingChamfer;
const BASE_GAP = 0.035;

export function roomPolygon(insetX = 0, insetZ = 0, chamfer = ROOM.chamfer) {
  const hx = ROOM.halfX - insetX;
  const hz = ROOM.halfZ - insetZ;
  const c = chamfer;
  return [
    [hx, hz - c], [hx - c, hz], [-hx + c, hz], [-hx, hz - c],
    [-hx, -hz + c], [-hx + c, -hz], [hx - c, -hz], [hx, -hz + c],
  ];
}

function polygonShape(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

function edges(points) {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const length = Math.hypot(dx, dz);
    // `normal` points towards the inside of the room
    return {
      length,
      mid: { x: (p[0] + q[0]) / 2, z: (p[1] + q[1]) / 2 },
      normal: { x: -dz / length, z: dx / length },
    };
  });
}

function facing(mesh, edge, inset) {
  mesh.position.x = edge.mid.x + edge.normal.x * inset;
  mesh.position.z = edge.mid.z + edge.normal.z * inset;
  mesh.rotation.y = Math.atan2(edge.normal.x, edge.normal.z);
  return mesh;
}

function inset(mesh, edge, amount) {
  mesh.position.x += edge.normal.x * amount;
  mesh.position.z += edge.normal.z * amount;
  return mesh;
}

export const WINDOW = { center: -0.15, width: 2.6, height: 1.05, y: 1.62, depth: 0.22 };

// A wall panel with an optional opening, so the observation recess is a real
// hole in the shell instead of a rectangle stuck onto it.
function wallPanel(edge, mats, hole) {
  const h = WALL_TOP - BASE_GAP;
  const shape = new THREE.Shape();
  shape.moveTo(-edge.length / 2, 0);
  shape.lineTo(edge.length / 2, 0);
  shape.lineTo(edge.length / 2, h);
  shape.lineTo(-edge.length / 2, h);
  shape.closePath();
  if (hole) {
    const path = new THREE.Path();
    const x0 = hole.x - hole.width / 2;
    const x1 = hole.x + hole.width / 2;
    const y0 = hole.y - hole.height / 2 - BASE_GAP;
    const y1 = hole.y + hole.height / 2 - BASE_GAP;
    path.moveTo(x0, y0);
    path.lineTo(x0, y1);
    path.lineTo(x1, y1);
    path.lineTo(x1, y0);
    path.closePath();
    shape.holes.push(path);
  }
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mats.wall);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildRoom(scene, mats) {
  const group = new THREE.Group();
  const points = roomPolygon();
  const wallEdges = edges(points);

  const floorGeo = new THREE.ShapeGeometry(polygonShape(points));
  const floor = new THREE.Mesh(floorGeo, mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Treatment zone: a shallow inlay that tells you where the chair belongs.
  const zone = new THREE.Mesh(new THREE.CircleGeometry(1.55, 48), mats.inlay);
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.0035;
  zone.receiveShadow = true;
  group.add(zone);
  const zoneRing = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.58, 48), mats.shadowGap);
  zoneRing.rotation.x = -Math.PI / 2;
  zoneRing.position.y = 0.004;
  group.add(zoneRing);

  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.03, 20), mats.dark);
  drain.position.set(0.95, -0.012, 1.35);
  group.add(drain);
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.008, 0.016), mats.steel);
    bar.position.set(0.95, 0.002, 1.35 - 0.06 + i * 0.03);
    group.add(bar);
  }

  const ceilingPoints = roomPolygon(ROOM.ceilingChamfer, ROOM.ceilingChamfer, ROOM.chamfer);
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(polygonShape(ceilingPoints)), mats.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.height;
  group.add(ceiling);

  const coveStrips = [];
  for (const edge of wallEdges) {
    // the long wall at -Z carries the observation opening
    const carriesWindow = edge.normal.z > 0.9 && edge.mid.z < -ROOM.halfZ + 1e-6;
    const wall = wallPanel(edge, mats, carriesWindow ? { ...WINDOW, x: WINDOW.center - edge.mid.x } : null);
    wall.position.y = BASE_GAP;
    facing(wall, edge, 0);
    group.add(wall);

    // recessed shadow gap at the floor junction instead of a visible skirting
    const base = new THREE.Mesh(new THREE.PlaneGeometry(edge.length, BASE_GAP), mats.shadowGap);
    base.position.y = BASE_GAP / 2;
    facing(base, edge, 0);
    inset(base, edge, 0.02);
    group.add(base);

    const strip = new THREE.Mesh(new THREE.PlaneGeometry(edge.length - 0.12, 0.05), mats.cove);
    facing(strip, edge, 0.05);
    strip.position.y = WALL_TOP - 0.03;
    strip.rotation.order = 'YXZ';
    strip.rotation.x = -Math.PI / 3;
    group.add(strip);
    coveStrips.push(strip);

    // thin vertical joints: panels, not one continuous slab
    const seams = Math.max(1, Math.round(edge.length / 1.1));
    const hole = carriesWindow
      ? { x: WINDOW.center - edge.mid.x, halfWidth: WINDOW.width / 2, top: WINDOW.y + WINDOW.height / 2, bottom: WINDOW.y - WINDOW.height / 2 }
      : null;
    for (let i = 1; i < seams; i++) {
      const offsetAlong = -edge.length / 2 + (edge.length / seams) * i;
      const spans = hole && Math.abs(offsetAlong - hole.x) < hole.halfWidth
        ? [[BASE_GAP, hole.bottom], [hole.top, WALL_TOP]]
        : [[BASE_GAP, WALL_TOP]];
      for (const [y0, y1] of spans) {
        if (y1 - y0 < 0.02) continue;
        const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.012, y1 - y0), mats.shadowGap);
        facing(seam, edge, 0.004);
        // slide along the panel's own axis so the offset matches the shape-space
        // coordinates used for the window opening
        seam.translateX(offsetAlong);
        seam.position.y = (y0 + y1) / 2;
        group.add(seam);
      }
    }
  }

  // One mitred band between the wall top and the ceiling: built per wall it
  // would leave open wedges at every chamfer.
  group.add(buildCoveBand(points, ceilingPoints, mats));

  const observation = buildObservationWindow(group, mats);
  const door = buildDoor(group, mats);
  const vent = buildVent(group, mats);
  const wallSign = buildWallPanel(group, mats);

  scene.add(group);
  return { group, coveStrips, ...observation, ...door, ...vent, ...wallSign };
}

function buildCoveBand(wallPoints, ceilingPoints, mats) {
  const position = [];
  const normal = [];
  const uv = [];
  const n = wallPoints.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [wallPoints[i][0], WALL_TOP, wallPoints[i][1]];
    const b = [wallPoints[j][0], WALL_TOP, wallPoints[j][1]];
    const c = [ceilingPoints[j][0], ROOM.height, ceilingPoints[j][1]];
    const d = [ceilingPoints[i][0], ROOM.height, ceilingPoints[i][1]];
    for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
      position.push(...p, ...q, ...r);
      for (let k = 0; k < 3; k++) {
        normal.push(0, 0, 0);
        uv.push(0, 0);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mat = mats.ceiling.clone();
  mat.side = THREE.DoubleSide;
  // the band has no usable UVs: the stain map would sample one point
  mat.map = null;
  mat.bumpMap = null;
  return new THREE.Mesh(geo, mat);
}

// Deep recess: the glass sits inside the wall, so it reads as a cavity rather
// than a rectangle painted on the surface.
function buildObservationWindow(group, mats) {
  const z = -ROOM.halfZ;
  const w = WINDOW.width;
  const h = WINDOW.height;
  const y = WINDOW.y;
  const depth = WINDOW.depth;

  const reveal = new THREE.Group();
  reveal.position.set(WINDOW.center, y, z);

  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), mats.wall);
  top.rotation.x = Math.PI / 2;
  top.position.set(0, h / 2, -depth / 2);
  reveal.add(top);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), mats.wall);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(0, -h / 2, -depth / 2);
  reveal.add(bottom);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, h), mats.wall);
    side.rotation.y = -sx * Math.PI / 2;
    side.position.set(sx * w / 2, 0, -depth / 2);
    reveal.add(side);
  }

  // Closed cavity behind the pane: without it the semi-transparent glass would
  // show the scene background instead of the observation room.
  const cavityDepth = 0.6;
  const zBack = -depth - cavityDepth;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.dark);
  back.position.set(0, 0, zBack);
  reveal.add(back);
  for (const sy of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, cavityDepth), mats.dark);
    face.rotation.x = sy * Math.PI / 2;
    face.position.set(0, sy * h / 2, zBack + cavityDepth / 2);
    reveal.add(face);
  }
  for (const sx of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(cavityDepth, h), mats.dark);
    face.rotation.y = -sx * Math.PI / 2;
    face.position.set(sx * w / 2, 0, zBack + cavityDepth / 2);
    reveal.add(face);
  }

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.windowGlow);
  glow.position.set(0, 0, zBack + 0.01);
  reveal.add(glow);

  // Backlit silhouette: what the light behind the glass is standing in front of.
  const figure = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.95), mats.presence);
  figure.position.set(-0.15, -0.12, zBack + 0.3);
  figure.visible = false;
  reveal.add(figure);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), mats.glass);
  glass.position.set(0, 0, -depth + 0.02);
  reveal.add(glass);

  group.add(reveal);
  return { windowGroup: reveal, windowGlass: glass, windowGlow: glow, windowFigure: figure };
}

// Flush door: only the shadow gap and the recessed plate give it away.
function buildDoor(group, mats) {
  const x = ROOM.halfX;
  const zc = 1.55;
  const w = 0.95;
  const h = 2.12;

  const doorGroup = new THREE.Group();
  doorGroup.position.set(x, h / 2, zc);
  doorGroup.rotation.y = -Math.PI / 2;

  const gap = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.03, h + 0.015), mats.shadowGap);
  gap.position.z = 0.002;
  doorGroup.add(gap);
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.wall);
  leaf.position.z = 0.012;
  doorGroup.add(leaf);

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), mats.steel);
  plate.position.set(w / 2 - 0.16, -0.05, 0.016);
  doorGroup.add(plate);
  const reader = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), mats.cove.clone());
  reader.position.set(w / 2 - 0.16, 0.03, 0.018);
  doorGroup.add(reader);

  group.add(doorGroup);
  return { door: doorGroup, doorReader: reader };
}

function buildVent(group, mats) {
  const frame = new THREE.Group();
  frame.position.set(-1.45, ROOM.height - 0.02, 1.9);
  frame.rotation.x = Math.PI / 2;

  const recess = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), mats.dark);
  frame.add(recess);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.37, 28), mats.steel);
  ring.position.z = 0.012;
  frame.add(ring);

  const blades = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.055, 0.008), mats.steel);
    blade.rotation.z = (i / 7) * Math.PI * 2;
    blade.position.set(Math.cos(blade.rotation.z) * 0.15, Math.sin(blade.rotation.z) * 0.15, 0.004);
    blades.add(blade);
  }
  blades.position.z = 0.006;
  frame.add(blades);

  group.add(frame);
  return { ventBlades: blades };
}

// Small recessed status panel: gives the walls something to read.
function buildWallPanel(group, mats) {
  const panel = new THREE.Group();
  panel.position.set(-ROOM.halfX + 0.01, 1.35, -0.6);
  panel.rotation.y = Math.PI / 2;

  const recess = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), mats.shadowGap);
  panel.add(recess);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), mats.dark);
  face.position.z = 0.006;
  panel.add(face);

  const leds = [];
  for (let i = 0; i < 4; i++) {
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.02), mats.ledSpare());
    led.position.set(-0.13 + i * 0.087, -0.07, 0.01);
    panel.add(led);
    leds.push(led);
  }

  group.add(panel);
  return { wallPanelLeds: leds };
}
