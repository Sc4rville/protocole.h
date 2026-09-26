// Robot articulé, construit par code d'après cellule-assets/00-robot-master-blue-eyes.jpg.
// Anatomie : ossature grise apparente, faisceaux de fibres noires satinées, câblage cuivre dans
// les interstices, crâne gris sculpté aux yeux cyan, coque sombre à l'arrière du crâne, module
// pectoral grillagé, trappe ouverte sur l'avant-bras gauche. Aucun asset externe.
const THREE = globalThis.THREE;

const HEIGHT = 1.88;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ utils

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function v3(a) {
  return a instanceof THREE.Vector3
    ? a.clone()
    : new THREE.Vector3(a[0], a[1], a[2]);
}

// Concatenate non-indexed geometries (position/normal/uv) into one BufferGeometry.
function mergeGeometries(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

// Geometry aligned on +y (centered on the origin) placed between two points.
function placeBetween(geo, a, b) {
  const A = v3(a);
  const B = v3(b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  geo.applyMatrix4(
    new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)),
  );
  return { geo, len, dir, q };
}

function capsuleGeometry(radius, length, segments = 24) {
  const pts = [];
  const half = Math.max(0, length / 2 - radius);
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(Math.cos(a) * radius, -half + Math.sin(a) * radius),
    );
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(Math.cos(a) * radius, half + Math.sin(a) * radius),
    );
  }
  return new THREE.LatheGeometry(pts, segments);
}

// Spindle: thin tendon ends, full belly, along +y from 0 to length.
function spindleGeometry(length, rEnd, rBelly, bulge = 0.5, segments = 24) {
  const pts = [new THREE.Vector2(0, 0)];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const d = t < bulge ? t / bulge : (1 - t) / (1 - bulge);
    const r =
      rEnd + (rBelly - rEnd) * Math.pow(Math.sin((d * Math.PI) / 2), 0.9);
    pts.push(new THREE.Vector2(Math.max(0.0005, r), t * length));
  }
  pts.push(new THREE.Vector2(0, length));
  return new THREE.LatheGeometry(pts, segments);
}

function roundedBoxGeometry(w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - r),
    bevelEnabled: true,
    bevelThickness: r / 2,
    bevelSize: r / 2,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(d - r) / 2);
  return geo;
}

function tube(points, radius, segs = 24, radial = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(v3),
    closed,
    "centripetal",
  );
  return new THREE.TubeGeometry(curve, segs, radius, radial, closed);
}

// Muscle: a bundle of thin fibres wrapping a dark core, thin at the tendons, full in the belly.
function fiberBundle(rng, a, b, opts = {}) {
  const {
    belly = 0.04,
    bulge = 0.5,
    strands = 12,
    strandR = 0.0065,
    core = true,
    spreadX = 1,
    spreadZ = 1,
    coreScale = 0.78,
    arc = 0,
  } = opts;
  const A = v3(a);
  const B = v3(b);
  const axis = B.clone().sub(A);
  const len = axis.length();
  const dir = axis.clone().normalize();
  const up = Math.abs(dir.y) < 0.9 ? Y_AXIS : new THREE.Vector3(1, 0, 0);
  const n1 = new THREE.Vector3().crossVectors(dir, up).normalize();
  const n2 = new THREE.Vector3().crossVectors(dir, n1).normalize();
  const geos = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < strands; i++) {
    const ang = (i / strands) * Math.PI * 2 + rng() * 0.4;
    const r0 = 0.55 + 0.45 * rng();
    const twist = (rng() - 0.5) * 0.6;
    const pts = [];
    for (let k = 0; k <= 7; k++) {
      const t = k / 7;
      const tt =
        t < bulge ? (t / bulge) * 0.5 : 0.5 + ((t - bulge) / (1 - bulge)) * 0.5;
      const prof = Math.pow(Math.sin(tt * Math.PI), 0.85);
      const rad = strandR * 0.5 + belly * prof * r0;
      const an = ang + twist * t;
      tmp
        .copy(n1)
        .multiplyScalar(Math.cos(an) * rad * spreadX)
        .addScaledVector(n2, Math.sin(an) * rad * spreadZ)
        .addScaledVector(n2, arc * Math.sin(t * Math.PI));
      pts.push(
        A.clone()
          .addScaledVector(dir, len * t)
          .add(tmp),
      );
    }
    geos.push(tube(pts, strandR * (0.75 + 0.5 * rng()), 18, 6));
  }
  if (core) {
    const c = spindleGeometry(len, strandR * 1.5, belly * coreScale, bulge, 20);
    c.scale(spreadX, 1, spreadZ);
    c.translate(0, -len / 2, 0);
    placeBetween(c, A, B);
    geos.push(c);
  }
  return mergeGeometries(geos);
}

// Fine longitudinal striations for the fibre material (roughness + bump).
function fiberTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#8c8c8c";
  ctx.fillRect(0, 0, 256, 256);
  const rng = mulberry(7);
  for (let i = 0; i < 260; i++) {
    const y = rng() * 256;
    const w = 0.4 + rng() * 1.4;
    const g = 90 + Math.floor(rng() * 110);
    ctx.strokeStyle = `rgb(${g},${g},${g})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + (rng() - 0.5) * 3);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  t.anisotropy = 8;
  return t;
}

function grilleTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 192;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3a3a3c";
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = "#08090b";
  for (let y = 14; y < 180; y += 11) {
    for (let x = 14 + ((y / 11) % 2) * 5; x < 116; x += 10) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(60,220,250,0.8)");
  g.addColorStop(0.35, "rgba(40,190,235,0.3)");
  g.addColorStop(1, "rgba(40,180,220,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------------ head sculpt

function bump(dir, cx, cy, cz, width, amount) {
  const l = Math.hypot(cx, cy, cz);
  const d = Math.max(
    -1,
    Math.min(1, (dir.x * cx + dir.y * cy + dir.z * cz) / l),
  );
  const ang = Math.acos(d);
  return amount * Math.exp(-(ang * ang) / (2 * width * width));
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Skull as a displaced sphere: ellipsoid base, brow, sockets, nose, cheekbones, jaw, chin.
function skullGeometry(scale) {
  const geo = new THREE.SphereGeometry(1, 96, 72);
  const p = geo.attributes.position;
  const d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const { x, y, z } = d;
    // flatter face plane in front, fuller occiput behind
    const rz = z > 0 ? 0.78 : 0.9;
    let r = 1 / Math.sqrt((x / 0.66) ** 2 + (y / 1.04) ** 2 + (z / rz) ** 2);
    // flat temples, slight parietal bulge
    r += bump(d, 0, 0.5, -0.8, 0.7, 0.04);
    r +=
      bump(d, 0.95, 0.25, 0.1, 0.42, -0.05) +
      bump(d, -0.95, 0.25, 0.1, 0.42, -0.05);
    // brow ridge, deep sockets
    r +=
      bump(d, 0.3, 0.32, 0.9, 0.34, 0.075) +
      bump(d, -0.3, 0.32, 0.9, 0.34, 0.075);
    r +=
      bump(d, 0.38, 0.13, 0.9, 0.22, -0.17) +
      bump(d, -0.38, 0.13, 0.9, 0.22, -0.17);
    // nose bridge, tip, nostrils
    r +=
      bump(d, 0, 0.14, 1, 0.12, 0.06) +
      bump(d, 0, -0.08, 1, 0.16, 0.14) +
      bump(d, 0, -0.2, 0.95, 0.1, 0.06);
    r +=
      bump(d, 0.12, -0.2, 0.96, 0.08, -0.03) +
      bump(d, -0.12, -0.2, 0.96, 0.08, -0.03);
    // cheekbones / hollows
    r +=
      bump(d, 0.62, -0.02, 0.72, 0.3, 0.07) +
      bump(d, -0.62, -0.02, 0.72, 0.3, 0.07);
    r +=
      bump(d, 0.52, -0.36, 0.74, 0.26, -0.07) +
      bump(d, -0.52, -0.36, 0.74, 0.26, -0.07);
    // lips, mouth line, chin
    r +=
      bump(d, 0, -0.4, 0.93, 0.17, 0.035) +
      bump(d, 0, -0.48, 0.93, 0.08, -0.035) +
      bump(d, 0, -0.56, 0.9, 0.14, 0.03);
    r += bump(d, 0, -0.84, 0.6, 0.3, 0.1);
    // jaw: taper toward the chin but keep the angle of the mandible
    const jaw = smooth(-0.1, -0.95, y);
    r *= 1 - 0.26 * jaw * (0.35 + 0.65 * Math.abs(x)) * (z > -0.05 ? 1 : 1.35);
    p.setXYZ(i, d.x * r * scale, d.y * r * scale, d.z * r * scale);
  }
  geo.computeVertexNormals();
  // vertex colours: gray face, dark rear shell, thin panel line at the transition
  const colors = new Float32Array(p.count * 3);
  const face = new THREE.Color(0x4f545a);
  const shell = new THREE.Color(0x0c0d10);
  const line = new THREE.Color(0x1d1e22);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(p.getX(i)) / scale;
    const y = p.getY(i) / scale;
    const z = p.getZ(i) / scale;
    const s = z - (-0.05 - 0.3 * y + 0.2 * x);
    const k = smooth(-0.03, 0.03, s);
    c.copy(shell).lerp(face, k);
    const edge = Math.exp(-(s * s) / (2 * 0.02 * 0.02));
    c.lerp(line, edge * 0.9);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

// ------------------------------------------------------------------ materials

export function createRobotMaterials(envMap = null) {
  const env = (i) => (envMap ? { envMap, envMapIntensity: i } : {});
  const striae = fiberTexture();
  const fiber = new THREE.MeshPhysicalMaterial({
    color: 0x090a0c,
    roughness: 0.78,
    metalness: 0.04,
    clearcoat: 0.4,
    clearcoatRoughness: 0.42,
    roughnessMap: striae,
    bumpMap: striae,
    bumpScale: 0.0005,
    ...env(0.18),
  });
  const core = new THREE.MeshStandardMaterial({
    color: 0x050607,
    roughness: 0.85,
    metalness: 0.05,
    ...env(0.08),
  });
  const bone = new THREE.MeshStandardMaterial({
    color: 0x55544f,
    roughness: 0.58,
    metalness: 0.35,
    ...env(0.3),
  });
  const boneDark = new THREE.MeshStandardMaterial({
    color: 0x232427,
    roughness: 0.5,
    metalness: 0.45,
    ...env(0.3),
  });
  const skull = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.7,
    metalness: 0.06,
    clearcoat: 0.1,
    clearcoatRoughness: 0.6,
    ...env(0.28),
  });
  const skullBack = boneDark;
  const copper = new THREE.MeshStandardMaterial({
    color: 0x5a2f22,
    roughness: 0.45,
    metalness: 0.75,
    ...env(0.35),
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x0f1013,
    roughness: 0.75,
    metalness: 0.1,
    ...env(0.12),
  });
  const grille = new THREE.MeshStandardMaterial({
    map: grilleTexture(),
    roughness: 0.6,
    metalness: 0.5,
    ...env(0.3),
  });
  const socket = new THREE.MeshStandardMaterial({
    color: 0x03040a,
    roughness: 0.35,
    metalness: 0.2,
  });
  const eye = new THREE.MeshStandardMaterial({
    color: 0x03141a,
    emissive: 0x18b8e0,
    emissiveIntensity: 1.1,
    roughness: 0.15,
  });
  const glow = new THREE.SpriteMaterial({
    map: glowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.45,
  });
  return {
    fiber,
    core,
    bone,
    boneDark,
    skull,
    skullBack,
    copper,
    rubber,
    grille,
    socket,
    eye,
    glow,
  };
}

// ------------------------------------------------------------------ robot

export function buildRobot(mats) {
  const rng = mulberry(1337);
  const root = new THREE.Group();
  root.name = "robot";
  const joints = {};

  function joint(name, parent, x, y, z) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    joints[name] = g;
    return g;
  }
  function add(parent, geo, mat, pos, rot) {
    const m = shadowed(new THREE.Mesh(geo, mat));
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m);
    return m;
  }
  function muscle(parent, a, b, opts, mat = mats.fiber) {
    return add(parent, fiberBundle(rng, a, b, opts), mat);
  }
  function wires(parent, points, n, radius = 0.0028, spread = 0.006) {
    const geos = [];
    for (let i = 0; i < n; i++) {
      const ox = (rng() - 0.5) * spread;
      const oz = (rng() - 0.5) * spread;
      geos.push(
        tube(
          points.map(([x, y, z]) => [x + ox, y, z + oz]),
          radius * (0.8 + rng() * 0.5),
          20,
          6,
        ),
      );
    }
    const m = new THREE.Mesh(mergeGeometries(geos), mats.copper);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function rod(parent, a, b, radius, mat) {
    const len = v3(a).distanceTo(v3(b));
    const g = new THREE.CylinderGeometry(radius, radius, len, 14);
    placeBetween(g, a, b);
    return add(parent, g, mat);
  }
  function capsuleBetween(parent, a, b, radius, mat) {
    const A = v3(a);
    const B = v3(b);
    const len = A.distanceTo(B);
    const g = capsuleGeometry(radius, len + radius * 2);
    placeBetween(g, A, B);
    return add(parent, g, mat);
  }
  // Mechanical hinge: disc on the joint axis (x) with hub bolt and side brackets.
  function hinge(parent, r, width, side = 1) {
    const disc = new THREE.CylinderGeometry(r, r, width, 28);
    disc.rotateZ(Math.PI / 2);
    add(parent, disc, mats.boneDark);
    const hub = new THREE.CylinderGeometry(
      r * 0.35,
      r * 0.35,
      width + 0.006,
      8,
    );
    hub.rotateZ(Math.PI / 2);
    add(parent, hub, mats.bone);
    const ring = new THREE.TorusGeometry(r * 0.72, r * 0.09, 8, 28);
    ring.rotateY(Math.PI / 2);
    add(parent, ring, mats.bone, [side * (width / 2 + 0.001), 0, 0]);
    add(parent, ring.clone(), mats.bone, [-side * (width / 2 + 0.001), 0, 0]);
    return disc;
  }

  // ================================================================ pelvis
  const pelvis = joint("pelvis", root, 0, 0.98, 0);
  {
    // iliac crest: gray belt + sacrum block
    const crest = new THREE.TorusGeometry(
      0.088,
      0.0075,
      10,
      40,
      Math.PI * 1.25,
    );
    crest.rotateX(Math.PI / 2);
    crest.rotateZ(-Math.PI * 0.125);
    crest.scale(1, 0.6, 1);
    add(pelvis, crest, mats.bone, [0, 0.01, -0.01], [-0.12, 0, 0]);
    add(
      pelvis,
      roundedBoxGeometry(0.06, 0.07, 0.03, 0.01),
      mats.bone,
      [0, -0.01, -0.085],
    );
    add(
      pelvis,
      capsuleGeometry(0.06, 0.16),
      mats.core,
      [0, -0.04, 0.0],
      [0.15, 0, 0],
    );
    // gluteal and lower abdominal bundles
    muscle(pelvis, [-0.06, 0.03, -0.05], [-0.09, -0.13, -0.02], {
      belly: 0.045,
      strands: 12,
      spreadX: 1.3,
    });
    muscle(pelvis, [0.06, 0.03, -0.05], [0.09, -0.13, -0.02], {
      belly: 0.045,
      strands: 12,
      spreadX: 1.3,
    });
    muscle(pelvis, [-0.04, 0.0, 0.05], [-0.06, -0.12, 0.045], {
      belly: 0.03,
      strands: 9,
    });
    muscle(pelvis, [0.04, 0.0, 0.05], [0.06, -0.12, 0.045], {
      belly: 0.03,
      strands: 9,
    });
    muscle(pelvis, [0, 0.02, 0.06], [0, -0.13, 0.05], {
      belly: 0.024,
      strands: 7,
    });
    for (const sx of [-1, 1]) {
      // hip socket cups
      const cup = new THREE.SphereGeometry(
        0.032,
        24,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.55,
      );
      add(pelvis, cup, mats.bone, [sx * 0.1, -0.02, 0], [0, 0, -sx * 0.9]);
      wires(
        pelvis,
        [
          [sx * 0.05, 0.05, -0.04],
          [sx * 0.08, -0.02, -0.05],
          [sx * 0.1, -0.08, -0.03],
        ],
        3,
      );
    }
  }

  // ================================================================ spine / abdomen
  const spine = joint("spine", pelvis, 0, 0.06, -0.015);
  {
    for (let i = 0; i < 6; i++) {
      const y = i * 0.04;
      add(
        spine,
        new THREE.CylinderGeometry(0.026, 0.028, 0.026, 14),
        mats.bone,
        [0, y, -0.045],
      );
      add(
        spine,
        new THREE.CylinderGeometry(0.02, 0.02, 0.012, 10),
        mats.boneDark,
        [0, y + 0.02, -0.045],
      );
      add(spine, roundedBoxGeometry(0.014, 0.02, 0.03, 0.004), mats.bone, [
        0,
        y,
        -0.065,
      ]);
    }
    add(spine, capsuleGeometry(0.058, 0.3), mats.core, [0, 0.12, -0.005]);
    // rectus abdominis: two columns of four segments, each a small fibre bundle
    for (let r = 0; r < 4; r++) {
      const y0 = -0.01 + r * 0.058;
      for (const sx of [-1, 1]) {
        muscle(spine, [sx * 0.03, y0, 0.05], [sx * 0.033, y0 + 0.055, 0.052], {
          belly: 0.028,
          strands: 8,
          strandR: 0.005,
          spreadX: 1.15,
          spreadZ: 0.7,
          bulge: 0.5,
        });
      }
    }
    // linea alba
    add(
      spine,
      roundedBoxGeometry(0.008, 0.24, 0.006, 0.003),
      mats.bone,
      [0, 0.11, 0.078],
    );
    // obliques wrapping the flank
    for (const sx of [-1, 1]) {
      muscle(spine, [sx * 0.07, -0.02, -0.02], [sx * 0.085, 0.2, 0.0], {
        belly: 0.03,
        strands: 10,
        spreadZ: 1.6,
        spreadX: 0.7,
      });
      muscle(spine, [sx * 0.05, 0.02, -0.06], [sx * 0.06, 0.22, -0.055], {
        belly: 0.024,
        strands: 8,
      });
      wires(
        spine,
        [
          [sx * 0.055, -0.02, 0.035],
          [sx * 0.06, 0.1, 0.03],
          [sx * 0.07, 0.22, 0.02],
        ],
        3,
        0.0024,
      );
    }
  }

  // ================================================================ chest
  const chest = joint("chest", spine, 0, 0.24, 0);
  {
    add(chest, capsuleGeometry(0.075, 0.28), mats.core, [0, 0.11, -0.01]);
    // sternum + chest module
    add(
      chest,
      roundedBoxGeometry(0.03, 0.22, 0.018, 0.008),
      mats.bone,
      [0, 0.11, 0.085],
    );
    const module = add(
      chest,
      roundedBoxGeometry(0.075, 0.115, 0.03, 0.012),
      mats.bone,
      [0, 0.17, 0.1],
    );
    module.rotation.x = -0.12;
    const grille = add(
      chest,
      new THREE.PlaneGeometry(0.055, 0.092),
      mats.grille,
      [0, 0.17, 0.117],
    );
    grille.rotation.x = -0.12;
    add(
      chest,
      roundedBoxGeometry(0.03, 0.02, 0.014, 0.005),
      mats.boneDark,
      [0, 0.245, 0.095],
    );
    // ribs: pairs of curved gray bars wrapping the core
    for (let i = 0; i < 6; i++) {
      const y = 0.03 + i * 0.03;
      const rr = 0.098 - i * 0.005;
      for (const sx of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 7; k++) {
          const a = (k / 7) * Math.PI * 0.62;
          pts.push([
            sx * Math.sin(a) * rr,
            y - Math.sin(a) * 0.04 + Math.sin(a * 2) * 0.006,
            Math.cos(a) * rr * 0.85 - 0.012,
          ]);
        }
        add(chest, tube(pts, 0.0065, 18, 10), mats.bone);
      }
    }
    // pectorals fanning from the sternum to the shoulder
    for (const sx of [-1, 1]) {
      muscle(chest, [sx * 0.025, 0.2, 0.07], [sx * 0.15, 0.24, 0.02], {
        belly: 0.03,
        strands: 11,
        spreadZ: 0.6,
        spreadX: 1.4,
      });
      muscle(chest, [sx * 0.03, 0.15, 0.075], [sx * 0.16, 0.22, 0.03], {
        belly: 0.028,
        strands: 10,
        spreadZ: 0.6,
        spreadX: 1.3,
      });
      // lats and serratus on the back / side
      muscle(chest, [sx * 0.06, 0.0, -0.06], [sx * 0.17, 0.25, -0.03], {
        belly: 0.035,
        strands: 12,
        spreadZ: 0.7,
        spreadX: 1.4,
      });
      muscle(chest, [sx * 0.03, 0.02, -0.075], [sx * 0.1, 0.28, -0.06], {
        belly: 0.028,
        strands: 10,
      });
      // trapezius up to the neck
      muscle(chest, [sx * 0.16, 0.27, -0.03], [sx * 0.03, 0.33, -0.03], {
        belly: 0.022,
        strands: 8,
      });
      wires(
        chest,
        [
          [sx * 0.09, 0.05, -0.06],
          [sx * 0.14, 0.18, -0.05],
          [sx * 0.18, 0.27, -0.02],
        ],
        4,
        0.0026,
      );
      wires(
        chest,
        [
          [sx * 0.02, 0.28, 0.04],
          [sx * 0.06, 0.3, 0.03],
          [sx * 0.1, 0.28, 0.0],
        ],
        3,
        0.0022,
      );
    }
    // clavicle yoke: one gray bar over the shoulders with a central clasp
    const yoke = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const x = (t - 0.5) * 0.4;
      yoke.push([
        x,
        0.3 + Math.cos((t - 0.5) * Math.PI) * 0.025,
        0.04 - Math.abs(t - 0.5) * 0.12,
      ]);
    }
    add(chest, tube(yoke, 0.011, 30, 12), mats.bone);
    add(
      chest,
      roundedBoxGeometry(0.04, 0.03, 0.02, 0.008),
      mats.bone,
      [0, 0.32, 0.045],
    );
    add(
      chest,
      new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8),
      mats.boneDark,
      [0, 0.32, 0.055],
      [Math.PI / 2, 0, 0],
    );
  }

  // ================================================================ neck & head
  const neck = joint("neck", chest, 0, 0.31, -0.005);
  {
    add(
      neck,
      new THREE.CylinderGeometry(0.03, 0.036, 0.11, 20),
      mats.core,
      [0, 0.055, 0],
    );
    for (let i = 0; i < 3; i++)
      add(neck, new THREE.CylinderGeometry(0.02, 0.022, 0.018, 12), mats.bone, [
        0,
        0.02 + i * 0.038,
        -0.03,
      ]);
    const fibers = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + rng() * 0.1;
      const r0 = 0.037 + rng() * 0.006;
      const r1 = 0.028 + rng() * 0.004;
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const r = r0 + (r1 - r0) * t + Math.sin(t * Math.PI) * 0.004;
        pts.push([
          Math.cos(a + t * 0.35) * r,
          -0.01 + t * 0.125,
          Math.sin(a + t * 0.35) * r,
        ]);
      }
      fibers.push(tube(pts, 0.0022 + rng() * 0.0012, 12, 6));
    }
    add(neck, mergeGeometries(fibers), mats.fiber);
    wires(
      neck,
      [
        [0.02, -0.01, 0.03],
        [0.025, 0.06, 0.028],
        [0.02, 0.12, 0.02],
      ],
      3,
      0.0022,
    );
    wires(
      neck,
      [
        [-0.02, -0.01, 0.03],
        [-0.025, 0.06, 0.028],
        [-0.02, 0.12, 0.02],
      ],
      3,
      0.0022,
    );
  }

  const head = joint("head", neck, 0, 0.105, 0.0);
  const eyes = [];
  {
    const S = 0.112;
    const skull = shadowed(new THREE.Mesh(skullGeometry(S), mats.skull));
    skull.position.set(0, 0.1, 0.01);
    head.add(skull);
    for (const sx of [-1, 1]) {
      // eyes: recessed almond socket, emissive lens, additive glow
      const sock = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 20, 14),
        mats.socket,
      );
      sock.scale.set(1.35, 0.72, 0.55);
      sock.position.set(sx * 0.0385, 0.114, 0.089);
      head.add(sock);
      const lens = new THREE.Mesh(
        new THREE.SphereGeometry(0.0085, 18, 12),
        mats.eye,
      );
      lens.scale.set(1.3, 0.7, 0.5);
      lens.position.set(sx * 0.0385, 0.114, 0.096);
      head.add(lens);
      const glow = new THREE.Sprite(mats.glow);
      glow.scale.set(0.036, 0.026, 1);
      glow.position.set(sx * 0.0385, 0.114, 0.1);
      head.add(glow);
      eyes.push({ lens, glow });
      // cheek vent and ear port
      add(
        head,
        roundedBoxGeometry(0.014, 0.022, 0.005, 0.003),
        mats.boneDark,
        [sx * 0.053, 0.072, 0.052],
        [0, sx * 0.85, 0],
      );
      for (let s = 0; s < 3; s++)
        add(
          head,
          new THREE.BoxGeometry(0.009, 0.002, 0.004),
          mats.socket,
          [sx * 0.0545, 0.066 + s * 0.006, 0.0535],
          [0, sx * 0.85, 0],
        );
      add(
        head,
        new THREE.CylinderGeometry(0.014, 0.014, 0.006, 20),
        mats.boneDark,
        [sx * 0.083, 0.1, -0.008],
        [0, 0, (sx * Math.PI) / 2],
      );
      add(
        head,
        new THREE.TorusGeometry(0.011, 0.002, 8, 20),
        mats.bone,
        [sx * 0.086, 0.1, -0.008],
        [0, (sx * Math.PI) / 2, 0],
      );
      add(
        head,
        new THREE.CylinderGeometry(0.003, 0.003, 0.004, 8),
        mats.socket,
        [sx * 0.0865, 0.1, -0.008],
        [0, 0, (sx * Math.PI) / 2],
      );
    }
    // chin bolt, mouth line
    add(
      head,
      new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 8),
      mats.boneDark,
      [0, 0.036, 0.081],
      [Math.PI / 2, 0, 0],
    );
    add(
      head,
      new THREE.BoxGeometry(0.026, 0.0016, 0.006),
      mats.socket,
      [0, 0.054, 0.084],
    );
    // jaw hinge bolts
    for (const sx of [-1, 1])
      add(
        head,
        new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10),
        mats.boneDark,
        [sx * 0.072, 0.055, 0.01],
        [0, 0, (sx * Math.PI) / 2],
      );
  }
  const eyeLight = new THREE.PointLight(0x4fe0f5, 0.45, 0.6, 2);
  eyeLight.position.set(0, 0.114, 0.11);
  head.add(eyeLight);

  // ================================================================ arms
  const arms = {};
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    const shoulder = joint("shoulder" + side, chest, sx * 0.2, 0.275, -0.01);
    // shoulder ball + deltoid cap
    add(shoulder, new THREE.SphereGeometry(0.03, 24, 18), mats.bone);
    add(
      shoulder,
      new THREE.TorusGeometry(0.036, 0.006, 10, 28),
      mats.boneDark,
      [sx * 0.01, 0.005, 0],
      [0, 0, Math.PI / 2 + sx * 0.35],
    );
    muscle(shoulder, [sx * 0.008, 0.04, 0.0], [sx * 0.016, -0.13, 0.0], {
      belly: 0.03,
      strands: 13,
      spreadZ: 1.3,
      bulge: 0.35,
      strandR: 0.0055,
    });
    muscle(shoulder, [sx * 0.0, 0.025, 0.025], [sx * 0.015, -0.11, 0.016], {
      belly: 0.02,
      strands: 9,
      bulge: 0.35,
      strandR: 0.005,
    });
    // biceps / triceps
    const UA = 0.32;
    muscle(
      shoulder,
      [sx * 0.008, -0.03, 0.016],
      [sx * 0.008, -UA + 0.02, 0.01],
      { belly: 0.022, strands: 10, spreadZ: 0.8, bulge: 0.55, strandR: 0.0055 },
    );
    muscle(
      shoulder,
      [sx * 0.008, -0.04, -0.016],
      [sx * 0.008, -UA + 0.03, -0.01],
      { belly: 0.022, strands: 10, spreadZ: 0.8, bulge: 0.45, strandR: 0.0055 },
    );
    muscle(shoulder, [sx * 0.024, -0.05, 0.0], [sx * 0.02, -UA + 0.03, 0.0], {
      belly: 0.013,
      strands: 6,
      core: false,
      strandR: 0.0045,
    });
    add(shoulder, capsuleGeometry(0.02, UA - 0.05), mats.core, [0, -UA / 2, 0]);
    // humerus visible strip on the outer side
    add(shoulder, roundedBoxGeometry(0.012, 0.14, 0.008, 0.004), mats.bone, [
      sx * 0.027,
      -0.2,
      0.0,
    ]);
    wires(
      shoulder,
      [
        [-sx * 0.012, -0.05, 0.03],
        [-sx * 0.018, -0.18, 0.032],
        [-sx * 0.012, -UA + 0.02, 0.02],
      ],
      4,
      0.0024,
      0.008,
    );

    const elbow = joint("elbow" + side, shoulder, 0, -UA, 0);
    hinge(elbow, 0.03, 0.046, sx);
    add(elbow, roundedBoxGeometry(0.02, 0.07, 0.03, 0.006), mats.bone, [
      sx * 0.028,
      -0.02,
      -0.005,
    ]);
    // forearm
    const FA = 0.28;
    add(elbow, capsuleGeometry(0.017, FA - 0.03), mats.core, [0, -FA / 2, 0]);
    muscle(elbow, [sx * 0.005, -0.02, 0.014], [sx * 0.004, -FA + 0.02, 0.008], {
      belly: 0.018,
      strands: 9,
      bulge: 0.32,
      spreadX: 0.9,
      strandR: 0.005,
    });
    muscle(
      elbow,
      [sx * 0.005, -0.02, -0.014],
      [sx * 0.004, -FA + 0.02, -0.008],
      { belly: 0.017, strands: 9, bulge: 0.35, spreadX: 0.9, strandR: 0.005 },
    );
    muscle(elbow, [-sx * 0.016, -0.03, 0.0], [-sx * 0.01, -FA + 0.03, 0.0], {
      belly: 0.012,
      strands: 6,
      core: false,
      strandR: 0.0045,
    });
    // radius/ulna plates
    add(elbow, roundedBoxGeometry(0.011, 0.16, 0.01, 0.004), mats.bone, [
      sx * 0.026,
      -0.14,
      0.006,
    ]);
    add(elbow, roundedBoxGeometry(0.008, 0.12, 0.008, 0.003), mats.boneDark, [
      sx * 0.02,
      -0.17,
      -0.014,
    ]);
    wires(
      elbow,
      [
        [-sx * 0.014, -0.03, 0.012],
        [-sx * 0.02, -0.15, 0.012],
        [-sx * 0.012, -FA + 0.02, 0.008],
      ],
      5,
      0.0022,
      0.008,
    );
    // wrist ring
    add(
      elbow,
      new THREE.TorusGeometry(0.02, 0.005, 10, 28),
      mats.bone,
      [0, -FA + 0.015, 0],
      [Math.PI / 2, 0, 0],
    );
    add(
      elbow,
      new THREE.CylinderGeometry(0.018, 0.02, 0.02, 20),
      mats.boneDark,
      [0, -FA + 0.005, 0],
    );

    // left forearm: open service hatch with the wiring exposed underneath
    if (side === "L") {
      const bay = add(
        elbow,
        roundedBoxGeometry(0.03, 0.11, 0.012, 0.004),
        mats.socket,
        [sx * 0.024, -0.13, 0.012],
        [0, sx * 0.4, 0],
      );
      bay.scale.set(1, 1, 1);
      wires(
        elbow,
        [
          [sx * 0.02, -0.08, 0.02],
          [sx * 0.03, -0.12, 0.024],
          [sx * 0.022, -0.18, 0.02],
        ],
        7,
        0.0022,
        0.012,
      );
      const hatch = joint("hatchL", elbow, sx * 0.038, -0.13, 0.006);
      const plate = add(
        hatch,
        roundedBoxGeometry(0.065, 0.11, 0.008, 0.004),
        mats.bone,
        [sx * 0.032, 0, 0.0],
      );
      plate.rotation.y = 0;
      add(
        hatch,
        new THREE.PlaneGeometry(0.05, 0.09),
        mats.grille,
        [sx * 0.032, 0, -0.005],
        [0, Math.PI, 0],
      );
      for (const dy of [-0.045, 0.045])
        add(
          hatch,
          new THREE.CylinderGeometry(0.004, 0.004, 0.014, 10),
          mats.boneDark,
          [0, dy, 0.0],
        );
      add(
        hatch,
        new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 12),
        mats.boneDark,
        [sx * 0.05, 0.03, 0.005],
        [Math.PI / 2, 0, 0],
      );
      hatch.rotation.y = -sx * 1.35;
    }

    // hand
    const wrist = joint("wrist" + side, elbow, 0, -FA, 0);
    add(wrist, new THREE.SphereGeometry(0.016, 20, 14), mats.bone);
    const palm = add(
      wrist,
      roundedBoxGeometry(0.058, 0.075, 0.02, 0.008),
      mats.rubber,
      [0, -0.045, 0.0],
    );
    palm.rotation.x = 0.1;
    add(
      wrist,
      roundedBoxGeometry(0.04, 0.04, 0.006, 0.003),
      mats.bone,
      [0, -0.035, -0.012],
    );
    const fingers = [];
    const lens = [
      [0.032, 0.022, 0.018],
      [0.036, 0.025, 0.02],
      [0.033, 0.023, 0.018],
      [0.026, 0.018, 0.015],
    ];
    for (let f = 0; f < 4; f++) {
      const fx = (f - 1.5) * 0.015;
      let parent = wrist;
      let y = -0.08;
      const chain = [];
      for (let s = 0; s < 3; s++) {
        const seg = new THREE.Group();
        seg.position.set(s === 0 ? fx : 0, s === 0 ? y : -lens[f][s - 1], 0);
        parent.add(seg);
        const r = 0.0058 - s * 0.0008;
        add(seg, new THREE.SphereGeometry(r * 1.15, 12, 10), mats.bone);
        add(
          seg,
          new THREE.CylinderGeometry(r * 0.9, r, lens[f][s] - r, 12),
          mats.rubber,
          [0, -lens[f][s] / 2, 0],
        );
        if (s === 2)
          add(seg, new THREE.SphereGeometry(r * 0.9, 12, 10), mats.rubber, [
            0,
            -lens[f][s] + r * 0.5,
            0,
          ]);
        chain.push(seg);
        parent = seg;
      }
      fingers.push(chain);
    }
    // thumb
    {
      const thumb = new THREE.Group();
      thumb.position.set(-sx * 0.03, -0.045, 0.008);
      thumb.rotation.set(0.5, 0, -sx * 0.9);
      wrist.add(thumb);
      const chain = [];
      let parent = thumb;
      for (let s = 0; s < 2; s++) {
        const seg = new THREE.Group();
        seg.position.set(0, s === 0 ? 0 : -0.028, 0);
        parent.add(seg);
        add(seg, new THREE.SphereGeometry(0.0072, 12, 10), mats.bone);
        add(
          seg,
          new THREE.CylinderGeometry(0.0058, 0.0066, 0.022, 12),
          mats.rubber,
          [0, -0.014, 0],
        );
        chain.push(seg);
        parent = seg;
      }
      fingers.push(chain);
    }
    arms[side] = { fingers };
  }

  // ================================================================ legs
  for (const side of ["L", "R"]) {
    const sx = side === "L" ? -1 : 1;
    const hip = joint("hip" + side, pelvis, sx * 0.1, -0.03, 0);
    add(hip, new THREE.SphereGeometry(0.025, 24, 18), mats.bone);
    const TH = 0.46;
    add(hip, capsuleGeometry(0.03, TH - 0.06), mats.core, [0, -TH / 2, 0]);
    // quadriceps (3 heads), hamstrings, adductor
    muscle(hip, [sx * 0.005, -0.03, 0.024], [sx * 0.0, -TH + 0.05, 0.022], {
      belly: 0.027,
      strands: 12,
      bulge: 0.45,
      spreadX: 1.1,
      strandR: 0.0055,
    });
    muscle(hip, [sx * 0.024, -0.05, 0.012], [sx * 0.015, -TH + 0.06, 0.016], {
      belly: 0.022,
      strands: 10,
      bulge: 0.4,
      strandR: 0.0055,
    });
    muscle(hip, [-sx * 0.02, -0.06, 0.016], [-sx * 0.012, -TH + 0.06, 0.016], {
      belly: 0.02,
      strands: 9,
      bulge: 0.5,
      strandR: 0.005,
    });
    muscle(hip, [sx * 0.008, -0.02, -0.024], [sx * 0.01, -TH + 0.04, -0.022], {
      belly: 0.027,
      strands: 12,
      bulge: 0.45,
      spreadX: 1.1,
      strandR: 0.0055,
    });
    muscle(
      hip,
      [-sx * 0.016, -0.03, -0.016],
      [-sx * 0.008, -TH + 0.05, -0.016],
      { belly: 0.02, strands: 8, bulge: 0.45, strandR: 0.005 },
    );
    muscle(hip, [-sx * 0.024, -0.04, 0.0], [-sx * 0.016, -TH + 0.1, 0.0], {
      belly: 0.017,
      strands: 7,
      bulge: 0.3,
      core: false,
      strandR: 0.0045,
    });
    // femur strip on the outer thigh (gray patch in the reference) + tendon plates near the knee
    add(hip, roundedBoxGeometry(0.02, 0.16, 0.01, 0.006), mats.bone, [
      sx * 0.032,
      -0.12,
      -0.005,
    ]);
    add(
      hip,
      roundedBoxGeometry(0.012, 0.1, 0.008, 0.004),
      mats.bone,
      [sx * 0.03, -TH + 0.09, 0.03],
      [0.15, 0, 0],
    );
    add(
      hip,
      roundedBoxGeometry(0.012, 0.1, 0.008, 0.004),
      mats.bone,
      [-sx * 0.02, -TH + 0.1, 0.032],
      [0.15, 0, 0],
    );
    wires(
      hip,
      [
        [-sx * 0.03, -0.05, 0.02],
        [-sx * 0.038, -0.25, 0.015],
        [-sx * 0.025, -TH + 0.03, 0.01],
      ],
      5,
      0.0024,
      0.01,
    );

    const knee = joint("knee" + side, hip, 0, -TH, 0);
    hinge(knee, 0.034, 0.05, sx);
    add(
      knee,
      roundedBoxGeometry(0.03, 0.045, 0.02, 0.006),
      mats.bone,
      [0, 0.0, 0.034],
    );
    const SH = 0.42;
    add(knee, capsuleGeometry(0.024, SH - 0.05), mats.core, [0, -SH / 2, 0]);
    // tibialis / gastrocnemius / soleus
    muscle(knee, [sx * 0.008, -0.03, 0.012], [sx * 0.004, -SH + 0.05, 0.012], {
      belly: 0.017,
      strands: 8,
      bulge: 0.35,
      strandR: 0.005,
    });
    muscle(
      knee,
      [sx * 0.008, -0.02, -0.016],
      [sx * 0.004, -SH + 0.07, -0.012],
      { belly: 0.024, strands: 11, bulge: 0.3, spreadX: 1.2, strandR: 0.0055 },
    );
    muscle(
      knee,
      [-sx * 0.01, -0.03, -0.012],
      [-sx * 0.004, -SH + 0.05, -0.008],
      { belly: 0.018, strands: 8, bulge: 0.4, strandR: 0.005 },
    );
    muscle(knee, [-sx * 0.016, -0.03, 0.0], [-sx * 0.01, -SH + 0.05, 0.0], {
      belly: 0.012,
      strands: 6,
      core: false,
      strandR: 0.0045,
    });
    // tibia strip and calf plate
    add(knee, roundedBoxGeometry(0.012, 0.26, 0.008, 0.004), mats.bone, [
      sx * 0.008,
      -0.2,
      0.028,
    ]);
    add(knee, roundedBoxGeometry(0.016, 0.1, 0.008, 0.005), mats.bone, [
      sx * 0.03,
      -0.14,
      -0.01,
    ]);
    wires(
      knee,
      [
        [-sx * 0.02, -0.04, 0.01],
        [-sx * 0.026, -0.2, 0.012],
        [-sx * 0.015, -SH + 0.02, 0.01],
      ],
      4,
      0.0022,
      0.008,
    );
    // achilles rods
    rod(
      knee,
      [sx * 0.006, -SH + 0.12, -0.028],
      [sx * 0.006, -SH, -0.03],
      0.005,
      mats.bone,
    );

    const ankle = joint("ankle" + side, knee, 0, -SH, 0);
    hinge(ankle, 0.022, 0.04, sx);
    // foot: heel block, arch plate, metatarsal fibres, five toes
    add(
      ankle,
      roundedBoxGeometry(0.05, 0.05, 0.07, 0.012),
      mats.rubber,
      [0, -0.045, -0.02],
    );
    add(
      ankle,
      roundedBoxGeometry(0.055, 0.016, 0.2, 0.006),
      mats.bone,
      [0, -0.065, 0.06],
      [0.06, 0, 0],
    );
    add(
      ankle,
      roundedBoxGeometry(0.04, 0.03, 0.14, 0.01),
      mats.core,
      [0, -0.045, 0.06],
      [0.08, 0, 0],
    );
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.012;
      add(
        ankle,
        tube(
          [
            [x * 0.5, -0.028, -0.01],
            [x, -0.04, 0.06],
            [x * 1.4, -0.058, 0.14],
          ],
          0.0045,
          12,
          6,
        ),
        mats.fiber,
      );
    }
    for (let t = 0; t < 5; t++) {
      const x = sx * (t - 2) * 0.012;
      const len = 0.045 - Math.abs(t - 1) * 0.005;
      const base = new THREE.Group();
      base.position.set(x, -0.066, 0.155);
      ankle.add(base);
      add(base, new THREE.SphereGeometry(0.0065, 12, 10), mats.bone);
      add(
        base,
        new THREE.CylinderGeometry(0.0055, 0.0065, len, 10),
        mats.rubber,
        [0, -0.002, len / 2],
        [Math.PI / 2, 0, 0],
      );
      add(base, new THREE.SphereGeometry(0.0055, 12, 10), mats.rubber, [
        0,
        -0.002,
        len,
      ]);
    }
  }

  // ---------------------------------------------------------------- posing
  const rest = {};
  for (const [name, g] of Object.entries(joints))
    rest[name] = { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z };

  const POSES = {
    debout: {
      shoulderL: { z: 0.1, x: 0.04 },
      shoulderR: { z: -0.1, x: 0.04 },
      elbowL: { x: -0.16 },
      elbowR: { x: -0.12 },
      hipL: { z: 0.02 },
      hipR: { z: -0.02 },
      chest: { x: 0.02 },
    },
    assis: {
      hipL: { x: -1.5, z: 0.08 },
      hipR: { x: -1.5, z: -0.08 },
      kneeL: { x: 1.5 },
      kneeR: { x: 1.5 },
      shoulderL: { x: -0.35, z: 0.22 },
      shoulderR: { x: -0.35, z: -0.22 },
      elbowL: { x: -1.25 },
      elbowR: { x: -1.25 },
      spine: { x: 0.06 },
      chest: { x: -0.04 },
      neck: { x: 0.12 },
      hatchL: { y: -1.25 },
    },
    defensif: {
      hipL: { x: -1.65, z: 0.15 },
      hipR: { x: -1.65, z: -0.2 },
      kneeL: { x: 1.85 },
      kneeR: { x: 1.85 },
      ankleL: { x: -0.2 },
      ankleR: { x: -0.2 },
      shoulderL: { x: -1.5, z: 0.35, y: 0.4 },
      shoulderR: { x: -1.35, z: -0.4, y: -0.5 },
      elbowL: { x: -2.2 },
      elbowR: { x: -2.35 },
      spine: { x: 0.25 },
      chest: { x: 0.18 },
      neck: { x: 0.35, y: 0.25 },
      hatchL: { y: -0.35 },
    },
  };
  const FINGER_CURL = { debout: 0.3, assis: 0.55, defensif: 1.15 };
  const footBox = new THREE.Box3();
  const tmpBox = new THREE.Box3();
  const tmpVec = new THREE.Vector3();

  const current = {};
  for (const name of Object.keys(joints)) current[name] = { ...rest[name] };
  const target = {};
  let poseName = "debout";
  let fingerCurl = FINGER_CURL.debout;
  let fingerTarget = fingerCurl;

  function setPose(name) {
    if (!POSES[name]) return false;
    poseName = name;
    const pose = POSES[name];
    for (const jn of Object.keys(joints)) {
      const over = pose[jn] || {};
      target[jn] = {
        x: rest[jn].x + (over.x ?? 0),
        y: rest[jn].y + (over.y ?? 0),
        z: rest[jn].z + (over.z ?? 0),
      };
    }
    fingerTarget = FINGER_CURL[name];
    return true;
  }
  setPose("debout");
  for (const jn of Object.keys(joints)) Object.assign(current[jn], target[jn]);

  const look = new THREE.Vector2(0, 0);
  const lookTarget = new THREE.Vector2(0, 0);
  let blink = 0;
  let nextBlink = 2.5;

  function update(dt, elapsed) {
    const k = 1 - Math.exp(-dt * 6);
    for (const jn of Object.keys(joints)) {
      const c = current[jn];
      const t = target[jn];
      c.x += (t.x - c.x) * k;
      c.y += (t.y - c.y) * k;
      c.z += (t.z - c.z) * k;
      joints[jn].rotation.set(c.x, c.y, c.z);
    }
    const breath = Math.sin(elapsed * 1.4) * 0.5 + 0.5;
    joints.chest.rotation.x += breath * 0.02;
    joints.shoulderL.rotation.z += breath * 0.012;
    joints.shoulderR.rotation.z -= breath * 0.012;
    look.lerp(lookTarget, 1 - Math.exp(-dt * 4));
    joints.head.rotation.y += look.x * 0.6 + Math.sin(elapsed * 0.7) * 0.03;
    joints.head.rotation.x += -look.y * 0.4 + Math.sin(elapsed * 0.45) * 0.02;
    joints.neck.rotation.y += look.x * 0.3;
    fingerCurl += (fingerTarget - fingerCurl) * k;
    for (const side of ["L", "R"]) {
      arms[side].fingers.forEach((chain, i) => {
        const wave =
          Math.sin(elapsed * 1.1 + i * 0.7 + (side === "L" ? 0 : 1.5)) * 0.06;
        chain.forEach((seg, s) => {
          seg.rotation.x = -(fingerCurl + wave) * (s === 0 ? 0.55 : 0.85);
        });
      });
    }
    // keep the lowest foot on the floor (parent y = 0)
    root.updateMatrixWorld(true);
    footBox.setFromObject(joints.ankleL);
    footBox.union(tmpBox.setFromObject(joints.ankleR));
    const parentY = root.parent ? root.parent.getWorldPosition(tmpVec).y : 0;
    root.position.y -= footBox.min.y - parentY;
    // blink / pulse
    nextBlink -= dt;
    if (nextBlink <= 0) {
      blink = 0.16;
      nextBlink = 2.5 + Math.random() * 3.5;
    }
    const pulse = 1.05 + Math.sin(elapsed * 2.3) * 0.15;
    const dim = blink > 0 ? 0.12 : 1;
    if (blink > 0) blink -= dt;
    mats.eye.emissiveIntensity = pulse * dim;
    eyeLight.intensity = 0.45 * dim;
    mats.glow.opacity = 0.45 * dim;
  }

  function lookAt(x, y) {
    lookTarget.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
  }

  let meshCount = 0;
  let triangleCount = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshCount++;
    const p = o.geometry.attributes.position;
    triangleCount += o.geometry.index
      ? o.geometry.index.count / 3
      : p.count / 3;
  });

  return {
    group: root,
    joints,
    poses: Object.keys(POSES),
    get pose() {
      return poseName;
    },
    setPose,
    lookAt,
    update,
    height: HEIGHT,
    meshCount,
    triangleCount: Math.round(triangleCount),
  };
}
