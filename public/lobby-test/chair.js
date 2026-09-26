const THREE = globalThis.THREE;

function roundedRectShape(w, h, r) {
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
  return s;
}

function panel(w, h, depth, mat) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, Math.min(w, h) * 0.18), {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.022,
    bevelThickness: 0.022,
    curveSegments: 6,
  });
  geo.center();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildChair(scene, mats) {
  const chair = new THREE.Group();

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.07, 28), mats.charcoal);
  foot.position.y = 0.035;
  foot.castShadow = true;
  foot.receiveShadow = true;
  chair.add(foot);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.44, 20), mats.steel);
  column.position.y = 0.28;
  column.castShadow = true;
  chair.add(column);

  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.72), mats.charcoal);
  pedestal.position.y = 0.55;
  pedestal.castShadow = true;
  chair.add(pedestal);

  const seatShell = panel(0.95, 0.62, 0.09, mats.shell);
  seatShell.rotation.x = -Math.PI / 2;
  seatShell.position.set(0, 0.66, -0.05);
  chair.add(seatShell);
  const seatCushion = panel(0.78, 0.5, 0.06, mats.cushion);
  seatCushion.rotation.x = -Math.PI / 2;
  seatCushion.position.set(0, 0.73, -0.05);
  chair.add(seatCushion);

  const backShell = panel(0.95, 1.15, 0.09, mats.shell);
  backShell.position.set(0, 1.28, -0.62);
  backShell.rotation.x = -0.12;
  chair.add(backShell);
  const backCushion = panel(0.78, 0.95, 0.06, mats.cushion);
  backCushion.position.set(0, 1.3, -0.56);
  backCushion.rotation.x = -0.12;
  chair.add(backCushion);

  const headrest = panel(0.5, 0.3, 0.07, mats.shell);
  headrest.position.set(0, 1.86, -0.69);
  headrest.rotation.x = -0.16;
  chair.add(headrest);
  const headPad = panel(0.4, 0.22, 0.05, mats.cushion);
  headPad.position.set(0, 1.87, -0.64);
  headPad.rotation.x = -0.16;
  chair.add(headPad);

  const footBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.46, 12), mats.steel);
  footBar.position.set(0, 0.38, 0.72);
  footBar.rotation.x = 0.5;
  footBar.castShadow = true;
  chair.add(footBar);
  const footRest = panel(0.55, 0.3, 0.05, mats.shell);
  footRest.rotation.x = -Math.PI / 2 + 0.15;
  footRest.position.set(0, 0.26, 0.9);
  chair.add(footRest);

  const restraints = [];
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), mats.charcoal);
    post.position.set(sx * 0.55, 0.8, 0.05);
    post.castShadow = true;
    chair.add(post);

    const arm = panel(0.14, 0.62, 0.07, mats.shell);
    arm.rotation.x = -Math.PI / 2;
    arm.position.set(sx * 0.55, 0.98, 0.05);
    chair.add(arm);

    const cuffPivot = new THREE.Group();
    cuffPivot.position.set(sx * 0.55, 1.02, 0.28);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 12, 24, Math.PI), mats.steel);
    cuff.rotation.x = Math.PI / 2;
    cuff.castShadow = true;
    cuffPivot.add(cuff);
    chair.add(cuffPivot);
    restraints.push(cuffPivot);

    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 14), mats.dark);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(sx * 0.64, 0.98, 0.28);
    knob.castShadow = true;
    chair.add(knob);
  }

  const ankle = new THREE.Group();
  ankle.position.set(0, 0.3, 0.86);
  const ankleCuff = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 10, 22, Math.PI), mats.steel);
  ankleCuff.rotation.x = Math.PI / 2;
  ankle.add(ankleCuff);
  chair.add(ankle);
  restraints.push(ankle);

  const trayAssembly = new THREE.Group();
  const trayArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.52, 12), mats.steel);
  trayArm.rotation.x = Math.PI / 2;
  trayArm.position.set(-0.6, 0.83, 0.35);
  trayArm.castShadow = true;
  trayAssembly.add(trayArm);
  const tray = panel(0.55, 0.4, 0.04, mats.shell);
  tray.rotation.x = -Math.PI / 2;
  tray.position.set(-0.35, 0.86, 0.55);
  trayAssembly.add(tray);

  const leds = [];
  for (let i = 0; i < 5; i++) {
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.012), mats.ledSpare());
    led.rotation.x = -Math.PI / 2;
    led.position.set(-0.52 + i * 0.06, 0.881, 0.71);
    trayAssembly.add(led);
    leds.push(led);
  }

  const probeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 12), mats.dark);
  probeHandle.rotation.z = Math.PI / 2;
  probeHandle.position.set(-0.45, 0.9, 0.5);
  probeHandle.castShadow = true;
  trayAssembly.add(probeHandle);
  const probeTip = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.002, 0.12, 8), mats.steel);
  probeTip.rotation.z = Math.PI / 2;
  probeTip.position.set(-0.32, 0.9, 0.5);
  probeTip.castShadow = true;
  trayAssembly.add(probeTip);

  for (const px of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), mats.dark);
    handle.rotation.x = Math.PI / 2.4;
    handle.position.set(-0.3 + px * 0.035, 0.9, 0.66);
    handle.castShadow = true;
    trayAssembly.add(handle);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), mats.steel);
    jaw.position.set(-0.3 + px * 0.02, 0.93, 0.58);
    jaw.rotation.x = px * 0.35;
    jaw.castShadow = true;
    trayAssembly.add(jaw);
  }
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10), mats.steel);
  pivot.position.set(-0.3, 0.92, 0.61);
  trayAssembly.add(pivot);
  chair.add(trayAssembly);

  scene.add(chair);
  return { group: chair, restraints, leds, trayAssembly };
}
