// Robot articulé construit par code d'après cellule-assets/00-robot-master-blue-eyes.jpg :
// squelette gris, faisceaux musculaires noirs, câbles cuivrés, module thoracique,
// avant-bras gauche ouvert, tête grise aux yeux cyan. Unités en mètres, pieds en y=0.
const THREE = globalThis.THREE;

const HEIGHT = 1.88;

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Rounded rod: sphere caps on a cylinder, built as a lathe (three r128 has no CapsuleGeometry).
function capsuleGeometry(radius, length, segments = 20) {
  const pts = [];
  const half = Math.max(0, length / 2 - radius);
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * radius, -half + Math.sin(a) * radius));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * radius, half + Math.sin(a) * radius));
  }
  return new THREE.LatheGeometry(pts, segments);
}

// Muscle bundle: thin at the tendons, full in the belly. `bulge` shifts the belly along the axis.
function muscleGeometry(length, rEnd, rBelly, bulge = 0.5, segments = 22) {
  const pts = [new THREE.Vector2(0, 0)];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const d = t < bulge ? t / bulge : (1 - t) / (1 - bulge);
    const r = rEnd + (rBelly - rEnd) * Math.pow(Math.sin((d * Math.PI) / 2), 0.8);
    pts.push(new THREE.Vector2(r, t * length));
  }
  pts.push(new THREE.Vector2(0, length));
  return new THREE.LatheGeometry(pts, segments);
}

function roundedBoxGeometry(w, h, d, r) {
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
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.002, d - r * 0.6),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: r * 0.3,
    bevelThickness: r * 0.3,
    curveSegments: 5,
  });
  geo.center();
  return geo;
}

// Perforated speaker grille of the sternum module.
function grilleTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3b3f';
  ctx.fillRect(0, 0, size, size * 2);
  ctx.fillStyle = '#0c0d10';
  const step = 12;
  for (let y = 10; y < size * 2 - 6; y += step) {
    for (let x = 10; x < size - 6; x += step) {
      ctx.beginPath();
      ctx.arc(x + ((y / step) % 2) * 5, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function createRobotMaterials(envMap = null) {
  const env = (i) => (envMap ? { envMap, envMapIntensity: i } : {});
  const muscle = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.6, metalness: 0.2, ...env(0.22) });
  const muscleSheen = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.42, metalness: 0.35, ...env(0.3) });
  const bone = new THREE.MeshStandardMaterial({ color: 0x6e7074, roughness: 0.46, metalness: 0.55, ...env(0.45) });
  const boneDark = new THREE.MeshStandardMaterial({ color: 0x35373b, roughness: 0.5, metalness: 0.55, ...env(0.35) });
  const skull = new THREE.MeshStandardMaterial({ color: 0x8c8e92, roughness: 0.62, metalness: 0.12, ...env(0.35) });
  const skullBack = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.45, metalness: 0.5, ...env(0.3) });
  const copper = new THREE.MeshStandardMaterial({ color: 0x6a3628, roughness: 0.5, metalness: 0.65, ...env(0.4) });
  const grille = new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.6, metalness: 0.5 });
  const socket = new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.3, metalness: 0.2 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x3fd8f0, emissiveIntensity: 2.2, roughness: 0.2 });
  const eyeHalo = new THREE.MeshBasicMaterial({ color: 0x6fe6ff, transparent: true, opacity: 0.22, depthWrite: false });
  return { muscle, muscleSheen, bone, boneDark, skull, skullBack, copper, grille, socket, eye, eyeHalo };
}

export function buildRobot(mats) {
  const root = new THREE.Group();
  root.name = 'robot';
  const joints = {};
  const geos = {
    jointS: new THREE.SphereGeometry(0.03, 24, 18),
    jointM: new THREE.SphereGeometry(0.042, 28, 20),
    jointL: new THREE.SphereGeometry(0.058, 32, 24),
  };

  function joint(name, parent, x, y, z) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    joints[name] = g;
    return g;
  }

  // A segment runs along -y from its joint (parent pivot) toward the child joint.
  function muscle(parent, length, rEnd, rBelly, mat, opts = {}) {
    const m = shadowed(new THREE.Mesh(muscleGeometry(length, rEnd, rBelly, opts.bulge ?? 0.45), mat));
    m.rotation.x = Math.PI;
    m.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
    if (opts.tilt) m.rotation.z = opts.tilt;
    if (opts.tiltX) m.rotation.x += opts.tiltX;
    parent.add(m);
    return m;
  }

  function capsule(parent, radius, length, mat, x, y, z, rot) {
    const m = shadowed(new THREE.Mesh(capsuleGeometry(radius, length), mat));
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m);
    return m;
  }

  function cable(parent, points, radius, mat = mats.copper) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 6, false), mat);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function ball(parent, size, mat, x = 0, y = 0, z = 0) {
    const m = shadowed(new THREE.Mesh(geos[size], mat));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // ---------------------------------------------------------------- pelvis & spine
  const pelvis = joint('pelvis', root, 0, 1.0, 0);
  const pelvisBand = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.013, 10, 28, Math.PI * 1.35), mats.bone));
  pelvisBand.rotation.set(Math.PI / 2, 0, -Math.PI * 0.175);
  pelvisBand.position.y = -0.03;
  pelvis.add(pelvisBand);
  capsule(pelvis, 0.075, 0.2, mats.muscle, 0, -0.04, 0.01, [0.1, 0, 0]);
  capsule(pelvis, 0.05, 0.16, mats.muscleSheen, 0, -0.1, 0.05, [0.35, 0, 0]);
  for (const sx of [-1, 1]) {
    capsule(pelvis, 0.045, 0.16, mats.muscle, sx * 0.075, -0.02, -0.06, [0.2, 0, sx * 0.4]);
    ball(pelvis, 'jointM', mats.boneDark, sx * 0.105, -0.05, 0.0);
  }

  const spine = joint('spine', pelvis, 0, 0.05, -0.01);
  for (let i = 0; i < 5; i++) {
    const v = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.03, 10), mats.bone));
    v.position.set(0, i * 0.045, -0.035);
    spine.add(v);
  }
  // abdominal wall: two columns of four blocks
  for (let r = 0; r < 4; r++) {
    for (const sx of [-1, 1]) {
      capsule(spine, 0.036, 0.09, r === 3 ? mats.muscleSheen : mats.muscle, sx * 0.04, 0.02 + r * 0.045, 0.045 + r * 0.004, [0, 0, Math.PI / 2]);
    }
    capsule(spine, 0.05, 0.075, mats.muscle, 0, 0.02 + r * 0.045, -0.005, [Math.PI / 2, 0, Math.PI / 2]);
  }
  for (const sx of [-1, 1]) muscle(spine, 0.24, 0.02, 0.045, mats.muscle, { x: sx * 0.1, y: 0.25, z: 0.005, bulge: 0.5 });

  // ---------------------------------------------------------------- chest
  const chest = joint('chest', spine, 0, 0.19, 0);
  capsule(chest, 0.085, 0.3, mats.muscle, 0, 0.1, -0.02, [0, 0, 0]);
  // rib cage: five pairs of open arcs around the core
  for (let i = 0; i < 5; i++) {
    const rad = 0.13 - i * 0.008;
    const y = 0.0 + i * 0.05;
    for (const sx of [-1, 1]) {
      // arc laid flat (Rz then Rx): a=pi/2 faces +z; right rib sweeps back-right to front-centre
      const rib = shadowed(new THREE.Mesh(new THREE.TorusGeometry(rad, 0.009, 8, 22, Math.PI * 0.7), mats.bone));
      rib.rotation.set(Math.PI / 2 + 0.12, 0, sx > 0 ? -Math.PI * 0.32 : Math.PI * 0.62);
      rib.position.set(0, y, 0.005 + i * 0.004);
      chest.add(rib);
    }
  }
  const sternum = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.24, 0.02), mats.bone));
  sternum.position.set(0, 0.1, 0.125);
  chest.add(sternum);
  // sternum module with grille
  const moduleFrame = shadowed(new THREE.Mesh(roundedBoxGeometry(0.075, 0.14, 0.035, 0.014), mats.bone));
  moduleFrame.position.set(0, 0.235, 0.135);
  chest.add(moduleFrame);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.105), mats.grille);
  grille.position.set(0, 0.235, 0.156);
  chest.add(grille);
  // pectorals
  for (const sx of [-1, 1]) {
    const pec = shadowed(new THREE.Mesh(muscleGeometry(0.19, 0.018, 0.05, 0.55), mats.muscleSheen));
    pec.rotation.set(0, 0, -sx * (Math.PI / 2 + 0.25));
    pec.position.set(sx * 0.008, 0.275, 0.085);
    pec.scale.z = 0.5;
    chest.add(pec);
    muscle(chest, 0.22, 0.02, 0.05, mats.muscle, { x: sx * 0.07, y: 0.32, z: -0.1, tilt: sx * 0.2 });
  }
  // shoulder yoke: gray bar across the top with a central clasp
  const yoke = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.01, 10, 30, Math.PI * 0.66), mats.bone));
  yoke.rotation.set(Math.PI / 2 - 0.25, 0, Math.PI * 0.17);
  yoke.position.set(0, 0.345, -0.1);
  chest.add(yoke);
  const clasp = shadowed(new THREE.Mesh(roundedBoxGeometry(0.04, 0.035, 0.02, 0.008), mats.bone));
  clasp.position.set(0, 0.34, 0.075);
  chest.add(clasp);
  // neck cables
  for (const [x, z] of [[-0.03, -0.03], [0.03, -0.03], [0, -0.055], [-0.045, 0.01], [0.045, 0.01]]) {
    cable(chest, [[x, 0.33, z], [x * 0.9, 0.4, z], [x * 0.8, 0.45, z * 0.9]], 0.0055, mats.muscle);
  }
  cable(chest, [[-0.012, 0.32, 0.03], [-0.02, 0.4, 0.02], [-0.01, 0.46, 0.015]], 0.003);
  cable(chest, [[0.014, 0.32, 0.035], [0.022, 0.4, 0.025], [0.012, 0.46, 0.02]], 0.003);

  // ---------------------------------------------------------------- neck & head
  const neck = joint('neck', chest, 0, 0.37, -0.01);
  for (let i = 0; i < 3; i++) {
    const v = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.025, 10), mats.bone));
    v.position.set(0, 0.02 + i * 0.035, -0.02);
    neck.add(v);
  }
  const head = joint('head', neck, 0, 0.08, 0.0);
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 24), mats.skull));
  skull.scale.set(0.82, 1.08, 0.95);
  skull.position.set(0, 0.115, -0.005);
  head.add(skull);
  // back of skull is a darker shell (phi = pi/2 faces +z, so the back half runs pi..2pi)
  const skullBack = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.0965, 32, 24, Math.PI * 1.02, Math.PI * 0.96), mats.skullBack));
  skullBack.scale.copy(skull.scale);
  skullBack.position.copy(skull.position);
  head.add(skullBack);
  // brow ridge, cheekbones, jaw and chin as blended volumes
  const brow = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), mats.skull));
  brow.scale.set(1.25, 0.3, 0.7);
  brow.position.set(0, 0.14, 0.05);
  head.add(brow);
  for (const sx of [-1, 1]) {
    const cheek = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mats.skull));
    cheek.scale.set(1.0, 1.1, 0.9);
    cheek.position.set(sx * 0.045, 0.085, 0.045);
    head.add(cheek);
    const plate = shadowed(new THREE.Mesh(roundedBoxGeometry(0.014, 0.04, 0.008, 0.004), mats.boneDark));
    plate.position.set(sx * 0.062, 0.07, 0.03);
    plate.rotation.y = sx * 0.9;
    head.add(plate);
    const ear = shadowed(new THREE.Mesh(roundedBoxGeometry(0.016, 0.03, 0.026, 0.006), mats.skullBack));
    ear.position.set(sx * 0.079, 0.105, -0.018);
    head.add(ear);
  }
  const jaw = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 14), mats.skull));
  jaw.scale.set(1.0, 0.8, 0.95);
  jaw.position.set(0, 0.045, 0.015);
  head.add(jaw);
  const chin = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), mats.skull));
  chin.scale.set(1.0, 0.75, 0.8);
  chin.position.set(0, 0.03, 0.05);
  head.add(chin);
  const nose = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 8), mats.skull));
  nose.rotation.x = -Math.PI / 2 + 0.3;
  nose.position.set(0, 0.095, 0.08);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0025, 0.006), mats.socket);
  mouth.position.set(0, 0.058, 0.076);
  head.add(mouth);
  // eyes: dark socket, glowing iris, soft halo
  const eyes = [];
  for (const sx of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 12), mats.socket);
    socket.scale.set(1.3, 0.75, 0.6);
    socket.position.set(sx * 0.03, 0.12, 0.074);
    head.add(socket);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 14, 10), mats.eye);
    iris.position.set(sx * 0.03, 0.12, 0.081);
    head.add(iris);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), mats.eyeHalo);
    halo.position.copy(iris.position);
    head.add(halo);
    eyes.push({ iris, halo });
  }
  const eyeLight = new THREE.PointLight(0x4fdcf5, 0.5, 0.6, 2);
  eyeLight.position.set(0, 0.12, 0.095);
  head.add(eyeLight);

  // ---------------------------------------------------------------- arms
  const arms = {};
  for (const sx of [-1, 1]) {
    const side = sx < 0 ? 'L' : 'R';
    const shoulder = joint('shoulder' + side, chest, sx * 0.19, 0.335, 0.0);
    ball(shoulder, 'jointM', mats.bone);
    const delt = shadowed(new THREE.Mesh(muscleGeometry(0.16, 0.018, 0.046, 0.35), mats.muscleSheen));
    delt.rotation.set(Math.PI, 0, sx * 0.12);
    delt.position.set(sx * 0.005, 0.045, 0);
    shoulder.add(delt);
    // upper arm: biceps front, triceps back, bone rod
    const rod = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 10), mats.bone));
    rod.position.set(0, -0.15, 0);
    shoulder.add(rod);
    muscle(shoulder, 0.28, 0.02, 0.042, mats.muscle, { x: sx * 0.01, y: -0.02, z: 0.03, bulge: 0.5 });
    muscle(shoulder, 0.28, 0.02, 0.04, mats.muscle, { x: 0, y: -0.02, z: -0.035, bulge: 0.55 });
    cable(shoulder, [[sx * 0.035, -0.04, 0.0], [sx * 0.04, -0.15, -0.01], [sx * 0.03, -0.28, 0.0]], 0.0035);
    cable(shoulder, [[sx * 0.03, -0.05, 0.02], [sx * 0.045, -0.16, 0.015], [sx * 0.025, -0.28, 0.01]], 0.003);

    const elbow = joint('elbow' + side, shoulder, 0, -0.31, 0);
    const hinge = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 16), mats.bone));
    hinge.rotation.z = Math.PI / 2;
    elbow.add(hinge);
    const hingeCap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.056, 12), mats.boneDark));
    hingeCap.rotation.z = Math.PI / 2;
    elbow.add(hingeCap);
    // forearm: three thinner bundles plus exposed copper harness
    const fRod = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.26, 10), mats.bone));
    fRod.position.set(0, -0.14, 0);
    elbow.add(fRod);
    muscle(elbow, 0.25, 0.015, 0.032, mats.muscle, { x: sx * 0.02, y: -0.02, z: 0.012, bulge: 0.3 });
    muscle(elbow, 0.25, 0.014, 0.03, mats.muscle, { x: -sx * 0.015, y: -0.02, z: -0.025, bulge: 0.35 });
    muscle(elbow, 0.24, 0.013, 0.026, mats.muscleSheen, { x: -sx * 0.02, y: -0.03, z: 0.02, bulge: 0.4 });
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * 0.012;
      cable(elbow, [[sx * 0.03 + off * 0.3, -0.03, 0.02 + off], [sx * 0.038, -0.14, 0.015 + off * 0.8], [sx * 0.022, -0.25, 0.01 + off * 0.5]], 0.0028);
    }
    if (sx < 0) {
      // left forearm: maintenance hatch swung open, service port inside
      const hatchPivot = new THREE.Group();
      hatchPivot.position.set(-0.035, -0.08, 0.0);
      hatchPivot.rotation.y = -1.25;
      const hatch = shadowed(new THREE.Mesh(roundedBoxGeometry(0.11, 0.15, 0.008, 0.012), mats.bone));
      hatch.position.set(-0.055, -0.03, 0);
      hatchPivot.add(hatch);
      const hatchInner = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.12), mats.boneDark);
      hatchInner.position.set(-0.055, -0.03, 0.005);
      hatchPivot.add(hatchInner);
      elbow.add(hatchPivot);
      joints.hatchL = hatchPivot;
      const port = shadowed(new THREE.Mesh(roundedBoxGeometry(0.025, 0.04, 0.018, 0.005), mats.boneDark));
      port.position.set(-0.032, -0.12, 0.012);
      port.rotation.y = -0.4;
      elbow.add(port);
      for (const [x, z] of [[-0.03, 0.03], [-0.037, 0.0], [-0.028, -0.025]]) {
        cable(elbow, [[x, -0.05, z], [x - 0.012, -0.11, z * 1.2], [x, -0.19, z]], 0.0026);
      }
    }

    const wrist = joint('wrist' + side, elbow, 0, -0.28, 0);
    ball(wrist, 'jointM', mats.bone);
    const palm = shadowed(new THREE.Mesh(roundedBoxGeometry(0.075, 0.085, 0.03, 0.012), mats.muscleSheen));
    palm.position.set(sx * -0.005, -0.06, 0);
    wrist.add(palm);
    for (const [x, z] of [[-0.02, 0.012], [0.0, 0.014], [0.02, 0.012]]) {
      const tendon = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), mats.bone));
      tendon.position.set(x, -0.06, z + 0.006);
      wrist.add(tendon);
    }
    // fingers: three phalanges each, thumb on the inside
    const fingers = [];
    const fingerSpecs = [
      [-0.028, 0.065], [-0.01, 0.075], [0.009, 0.072], [0.027, 0.06],
    ];
    for (const [fx, len] of fingerSpecs) {
      const base = new THREE.Group();
      base.position.set(fx, -0.1, 0);
      wrist.add(base);
      const segLens = [len * 0.42, len * 0.32, len * 0.26];
      let parentJoint = base;
      const chain = [];
      for (let s = 0; s < 3; s++) {
        const seg = shadowed(new THREE.Mesh(capsuleGeometry(0.0075 - s * 0.0008, segLens[s] + 0.01), s === 2 ? mats.bone : mats.muscleSheen));
        seg.position.y = -segLens[s] / 2;
        parentJoint.add(seg);
        const knuckle = new THREE.Group();
        knuckle.position.y = -segLens[s];
        parentJoint.add(knuckle);
        if (s < 2) {
          const k = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), mats.bone));
          knuckle.add(k);
        }
        chain.push(parentJoint);
        parentJoint = knuckle;
      }
      fingers.push(chain);
    }
    const thumb = new THREE.Group();
    thumb.position.set(sx * 0.038, -0.045, 0.012);
    thumb.rotation.set(0.5, 0, sx * 0.9);
    wrist.add(thumb);
    let tp = thumb;
    for (let s = 0; s < 2; s++) {
      const seg = shadowed(new THREE.Mesh(capsuleGeometry(0.008, 0.042), s === 1 ? mats.bone : mats.muscleSheen));
      seg.position.y = -0.018;
      tp.add(seg);
      const k = new THREE.Group();
      k.position.y = -0.034;
      tp.add(k);
      tp = k;
    }
    fingers.push([thumb]);
    arms[side] = { shoulder, elbow, wrist, fingers };
  }

  // ---------------------------------------------------------------- legs
  for (const sx of [-1, 1]) {
    const side = sx < 0 ? 'L' : 'R';
    const hip = joint('hip' + side, pelvis, sx * 0.1, -0.06, 0);
    ball(hip, 'jointL', mats.bone);
    const femur = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.42, 10), mats.bone));
    femur.position.set(0, -0.22, 0);
    hip.add(femur);
    muscle(hip, 0.42, 0.024, 0.05, mats.muscle, { x: sx * 0.01, y: -0.02, z: 0.028, bulge: 0.4 });
    muscle(hip, 0.4, 0.022, 0.042, mats.muscle, { x: -sx * 0.028, y: -0.04, z: -0.022, bulge: 0.45 });
    muscle(hip, 0.38, 0.02, 0.038, mats.muscleSheen, { x: sx * 0.032, y: -0.05, z: -0.008, bulge: 0.5 });
    // gray tendon insert above the knee, as in the reference
    const insert = shadowed(new THREE.Mesh(roundedBoxGeometry(0.03, 0.11, 0.012, 0.008), mats.bone));
    insert.position.set(sx * 0.005, -0.36, 0.055);
    hip.add(insert);
    cable(hip, [[sx * 0.045, -0.06, 0.02], [sx * 0.055, -0.22, 0.03], [sx * 0.035, -0.4, 0.02]], 0.0032);
    cable(hip, [[-sx * 0.04, -0.08, -0.03], [-sx * 0.05, -0.24, -0.035], [-sx * 0.03, -0.4, -0.02]], 0.003);

    const knee = joint('knee' + side, hip, 0, -0.45, 0);
    const kneeCap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 18), mats.bone));
    kneeCap.rotation.z = Math.PI / 2;
    knee.add(kneeCap);
    const patella = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), mats.boneDark));
    patella.scale.set(1, 1, 0.6);
    patella.position.set(0, 0.0, 0.035);
    knee.add(patella);
    const tibia = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.42, 10), mats.bone));
    tibia.position.set(0, -0.22, 0.01);
    knee.add(tibia);
    muscle(knee, 0.4, 0.02, 0.045, mats.muscle, { x: -sx * 0.015, y: -0.03, z: -0.03, bulge: 0.3 });
    muscle(knee, 0.38, 0.018, 0.035, mats.muscle, { x: sx * 0.025, y: -0.04, z: 0.0, bulge: 0.35 });
    muscle(knee, 0.36, 0.016, 0.03, mats.muscleSheen, { x: 0, y: -0.05, z: 0.03, bulge: 0.3 });
    const shinPlate = shadowed(new THREE.Mesh(roundedBoxGeometry(0.028, 0.16, 0.01, 0.007), mats.bone));
    shinPlate.position.set(0, -0.25, 0.048);
    knee.add(shinPlate);
    cable(knee, [[sx * 0.035, -0.08, 0.0], [sx * 0.04, -0.22, -0.01], [sx * 0.025, -0.4, 0.0]], 0.003);

    const ankle = joint('ankle' + side, knee, 0, -0.45, 0);
    ball(ankle, 'jointM', mats.bone);
    const heel = shadowed(new THREE.Mesh(capsuleGeometry(0.03, 0.09), mats.muscle));
    heel.rotation.x = Math.PI / 2;
    heel.position.set(0, -0.02, -0.02);
    ankle.add(heel);
    const sole = shadowed(new THREE.Mesh(roundedBoxGeometry(0.085, 0.03, 0.22, 0.012), mats.muscleSheen));
    sole.position.set(0, -0.03, 0.07);
    ankle.add(sole);
    const arch = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), mats.bone));
    arch.rotation.x = Math.PI / 2 - 0.25;
    arch.position.set(0, -0.01, 0.06);
    ankle.add(arch);
    for (let i = 0; i < 5; i++) {
      const toe = shadowed(new THREE.Mesh(capsuleGeometry(0.009 - i * 0.0008, 0.045 - i * 0.004), i % 2 ? mats.bone : mats.muscleSheen));
      toe.rotation.x = Math.PI / 2;
      toe.position.set(sx * (-0.028 + i * 0.014), -0.035, 0.195 - i * 0.006);
      ankle.add(toe);
    }
  }

  // ---------------------------------------------------------------- posing
  const rest = {};
  for (const [name, g] of Object.entries(joints)) {
    rest[name] = { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z };
  }

  const POSES = {
    // debout, bras le long du corps, regard droit
    debout: {
      shoulderL: { z: 0.12, x: 0.05 }, shoulderR: { z: -0.12, x: 0.05 },
      elbowL: { x: -0.18 }, elbowR: { x: -0.14 },
      hipL: { z: 0.02 }, hipR: { z: -0.02 },
      chest: { x: 0.02 },
    },
    // assis dans le fauteuil : hanches à 90°, avant-bras posés
    assis: {
      hipL: { x: -1.5, z: 0.08 }, hipR: { x: -1.5, z: -0.08 },
      kneeL: { x: 1.5 }, kneeR: { x: 1.5 },
      ankleL: { x: 0.0 }, ankleR: { x: 0.0 },
      shoulderL: { x: -0.35, z: 0.22 }, shoulderR: { x: -0.35, z: -0.22 },
      elbowL: { x: -1.25 }, elbowR: { x: -1.25 },
      spine: { x: 0.06 }, chest: { x: -0.04 }, neck: { x: 0.12 },
      hatchL: { y: -1.25 },
    },
    // défensif : recul, bras repliés devant le module
    defensif: {
      hipL: { x: -1.65, z: 0.15 }, hipR: { x: -1.65, z: -0.2 },
      kneeL: { x: 1.85 }, kneeR: { x: 1.85 },
      ankleL: { x: -0.2 }, ankleR: { x: -0.2 },
      shoulderL: { x: -1.5, z: 0.35, y: 0.4 }, shoulderR: { x: -1.35, z: -0.4, y: -0.5 },
      elbowL: { x: -2.2 }, elbowR: { x: -2.35 },
      spine: { x: 0.25 }, chest: { x: 0.18 }, neck: { x: 0.35, y: 0.25 },
      hatchL: { y: -0.35 },
    },
  };
  const FINGER_CURL = { debout: 0.35, assis: 0.55, defensif: 1.15 };
  // the root is lowered each frame so the lowest foot rests on the floor
  const footBox = new THREE.Box3();
  const tmpBox = new THREE.Box3();
  const tmpVec = new THREE.Vector3();

  const current = {};
  for (const name of Object.keys(joints)) current[name] = { ...rest[name] };
  const target = {};
  let poseName = 'debout';
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
  setPose('debout');
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
    // breathing: the chest lifts and the shoulders drift with it
    const breath = Math.sin(elapsed * 1.4) * 0.5 + 0.5;
    joints.chest.rotation.x += breath * 0.025;
    joints.chest.scale.setScalar(1 + breath * 0.012);
    joints.shoulderL.rotation.z += breath * 0.015;
    joints.shoulderR.rotation.z -= breath * 0.015;
    // gaze follows a target with a slight lag, idle micro-saccades on top
    look.lerp(lookTarget, 1 - Math.exp(-dt * 4));
    joints.head.rotation.y += look.x * 0.6 + Math.sin(elapsed * 0.7) * 0.03;
    joints.head.rotation.x += -look.y * 0.4 + Math.sin(elapsed * 0.45) * 0.02;
    joints.neck.rotation.y += look.x * 0.3;
    // fingers ease toward the pose's curl with a per-finger wave
    fingerCurl += (fingerTarget - fingerCurl) * k;
    root.updateMatrixWorld(true);
    footBox.setFromObject(joints.ankleL);
    footBox.union(tmpBox.setFromObject(joints.ankleR));
    // footBox is in world space; the floor sits at the root parent's y = 0
    const parentY = root.parent ? root.parent.getWorldPosition(tmpVec).y : 0;
    root.position.y -= footBox.min.y - parentY;
    for (const side of ['L', 'R']) {
      arms[side].fingers.forEach((chain, i) => {
        const wave = Math.sin(elapsed * 1.1 + i * 0.7 + (side === 'L' ? 0 : 1.5)) * 0.06;
        chain.forEach((seg, s) => {
          seg.rotation.x = -(fingerCurl + wave) * (s === 0 ? 0.55 : 0.85);
        });
      });
    }
    // blink: the irises dim briefly, roughly every few seconds
    nextBlink -= dt;
    if (nextBlink <= 0) {
      blink = 0.18;
      nextBlink = 2.5 + Math.random() * 3.5;
    }
    const pulse = 1.9 + Math.sin(elapsed * 2.3) * 0.25;
    const dim = blink > 0 ? 0.15 : 1;
    if (blink > 0) blink -= dt;
    mats.eye.emissiveIntensity = pulse * dim;
    eyeLight.intensity = 0.5 * dim;
    for (const e of eyes) e.halo.material.opacity = 0.22 * dim;
  }

  function lookAt(x, y) {
    lookTarget.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
  }

  let meshCount = 0;
  root.traverse((o) => {
    if (o.isMesh) meshCount++;
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
  };
}
