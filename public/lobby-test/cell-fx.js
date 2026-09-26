const THREE = globalThis.THREE;
const SFX = '../audio/';
const REACH = 1.9;
const CUT_TIME = 1.4;

function sfx(name, volume = 0.6) {
  const a = new Audio(SFX + name + '.mp3');
  a.volume = volume;
  a.play().catch(() => {});
}

function buildHands() {
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89478, roughness: 0.62, metalness: 0 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.85 });
  const hands = {};
  for (const side of [-1, 1]) {
    const root = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 12), sleeve);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = 0.2;
    root.add(arm);
    const fist = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.1), skin);
    fist.add(palm);
    for (let i = 0; i < 4; i++) {
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), skin);
      knuckle.position.set(-0.03 + i * 0.02, 0.01, -0.055);
      fist.add(knuckle);
    }
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8), skin);
    thumb.rotation.z = Math.PI / 2;
    thumb.position.set(-side * 0.05, -0.012, -0.03);
    fist.add(thumb);
    fist.position.z = -0.02;
    root.add(fist);
    root.position.set(side * 0.22, -0.24, -0.42);
    root.rotation.set(0.12, side * -0.18, side * 0.12);
    root.userData.rest = root.position.clone();
    for (const m of [arm, palm, thumb, ...fist.children]) {
      m.renderOrder = 20;
      m.material.depthTest = true;
    }
    hands[side < 0 ? 'left' : 'right'] = root;
  }
  return hands;
}

export function createCellFx({ scene, camera, gameplay, robot, onEvent }) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.9, roughness: 0.28 });
  const glowBand = new THREE.MeshStandardMaterial({ color: 0x220303, emissive: 0xff2a14, emissiveIntensity: 1.4 });
  const ledMat = () => new THREE.MeshStandardMaterial({ color: 0x300404, emissive: 0xff2a14, emissiveIntensity: 2.2 });
  const cuffs = [];
  const specs = [
    { joint: 'wristL', r: 0.05, drop: 0.09, wrist: true },
    { joint: 'wristR', r: 0.05, drop: 0.09, wrist: true },
    { joint: 'ankleL', r: 0.055, drop: 0.08 },
    { joint: 'ankleR', r: 0.055, drop: 0.08 },
  ];
  robot.update?.(0, 0);
  for (const spec of specs) {
    const j = robot.joints[spec.joint];
    if (!j) continue;
    const ring = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(spec.r + 0.006, 0.026, 12, 28), steel);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(spec.r + 0.006, 0.028, 6, 28, Math.PI * 0.5), glowBand);
    stripe.rotation.x = Math.PI / 2;
    ring.add(stripe);
    band.rotation.x = Math.PI / 2;
    band.castShadow = true;
    ring.add(band);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.03), steel);
    lock.position.set(0, 0, spec.r + 0.012);
    ring.add(lock);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), ledMat());
    led.position.set(0, 0.012, spec.r + 0.028);
    ring.add(led);
    ring.position.set(0, spec.wrist ? -0.03 : 0.03, 0);
    j.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1, 8), steel);
    chain.castShadow = true;
    scene.add(chain);
    const world = new THREE.Vector3();
    ring.getWorldPosition(world);
    const anchor = world.clone().add(new THREE.Vector3(0, -spec.drop - 0.05, 0));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(spec.r + 0.05, 8, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    ring.add(hit);
    const cuff = { ...spec, ring, band, stripe, led, chain, anchor, hit, cut: 0, open: false, fall: null };
    hit.userData.cuff = cuff;
    cuffs.push(cuff);
  }

  const hands = buildHands();
  camera.add(hands.left);
  camera.add(hands.right);

  const prompt = document.getElementById('fx-prompt');
  const ray = new THREE.Raycaster();
  ray.far = REACH;
  const center = new THREE.Vector2(0, 0);
  let aim = null;
  let holding = false;
  let punchT = 0;
  let punchSide = 'right';
  let recoil = 0;
  let hits = 0;
  let blink = 0;
  let released = false;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function openCuff(c, loud = true) {
    if (c.open) return;
    c.open = true;
    c.chain.visible = false;
    c.led.material.emissive.setHex(0x2aff7a);
    c.stripe.visible = false;
    const world = new THREE.Vector3();
    c.ring.getWorldPosition(world);
    const q = new THREE.Quaternion();
    c.ring.getWorldQuaternion(q);
    c.ring.parent.remove(c.ring);
    c.ring.position.copy(world);
    c.ring.quaternion.copy(q);
    scene.add(c.ring);
    c.fall = { v: 0.3, spin: (Math.random() - 0.5) * 6 };
    if (loud) {
      sfx('fluids/seal_release_01', 0.6);
      sfx('mechanics/restraint_click_02', 0.7);
    }
  }

  function releaseAll(loud) {
    for (const c of cuffs) openCuff(c, loud && c === cuffs[0]);
  }

  function state() {
    return gameplay.debug.getState();
  }

  function robotHit(object) {
    for (let o = object; o; o = o.parent) if (o === robot.group) return true;
    return false;
  }

  function findAim() {
    const st = state();
    if (st.finished || st.active) return null;
    if (gameplay.debug.currentTarget) return null;
    ray.setFromCamera(center, camera);
    const targets = cuffs.filter((c) => !c.open).map((c) => c.hit);
    const hitsList = ray.intersectObjects([...targets, robot.group], true);
    for (const h of hitsList) {
      if (h.object.userData.cuff) {
        if (st.equipped === 'pliers') return { type: 'cuff', cuff: h.object.userData.cuff };
        continue;
      }
      if (robotHit(h.object)) return st.equipped ? null : { type: 'robot' };
    }
    return null;
  }

  function punch() {
    punchT = 0.28;
    punchSide = punchSide === 'right' ? 'left' : 'right';
    setTimeout(() => {
      recoil = 0.7;
      hits += 1;
      sfx('mechanics/metal_impact_01', 0.8);
      sfx(hits > 2 ? 'screams/robot_distress_low_01' : 'screams/robot_distress_grain_01', 0.5);
      onEvent?.('struck', hits);
      if (gameplay.addFact('robot_struck')) onEvent?.('fact', 'robot_struck');
    }, 110);
  }

  return {
    press(button) {
      if (button !== 0 || !aim) return false;
      if (aim.type === 'robot') { punch(); return true; }
      if (aim.type === 'cuff') { holding = true; sfx('electricity/probe_crackle_01', 0.35); return true; }
      return false;
    },
    release() {
      holding = false;
    },
    releaseAll,
    get cuffs() { return cuffs; },
    get hits() { return hits; },
    update(dt, active) {
      const st = state();
      if (!released && st.facts.includes('restraint_released')) {
        released = true;
        releaseAll(true);
      }
      blink += dt;
      const damaged = st.facts.includes('restraint_damaged');
      for (const c of cuffs) {
        if (c.open) {
          if (c.fall) {
            c.fall.v += 9.8 * dt;
            c.ring.position.y = Math.max(0.03, c.ring.position.y - c.fall.v * dt);
            c.ring.rotation.z += c.fall.spin * dt;
            if (c.ring.position.y <= 0.03) c.fall = null;
          }
          continue;
        }
        c.led.material.emissiveIntensity = damaged ? (Math.sin(blink * 18) > 0 ? 3 : 0.2) : 1.6 + Math.sin(blink * 3) * 0.6;
        c.ring.getWorldPosition(tmpA);
        tmpB.copy(c.anchor);
        const mid = tmpA.clone().add(tmpB).multiplyScalar(0.5);
        const dir = tmpB.clone().sub(tmpA);
        const len = Math.max(0.01, dir.length());
        c.chain.position.copy(mid);
        c.chain.scale.set(1, len, 1);
        c.chain.quaternion.setFromUnitVectors(up, dir.normalize());
      }

      aim = active ? findAim() : null;
      if (holding && (!aim || aim.type !== 'cuff' || !active)) holding = false;
      if (holding && aim?.type === 'cuff') {
        const c = aim.cuff;
        c.cut += dt;
        if (Math.random() < dt * 12) sfx('electricity/probe_arc_snap_01', 0.15);
        if (c.cut >= CUT_TIME) {
          holding = false;
          openCuff(c, true);
          sfx('metal/metal_strain_01', 0.6);
          onEvent?.('cuff_cut', c.joint);
          const wristsOpen = cuffs.filter((x) => x.wrist).every((x) => x.open);
          if (wristsOpen && gameplay.addFact('restraint_released')) {
            released = true;
            releaseAll(true);
            onEvent?.('fact', 'restraint_released');
          }
        }
      }

      if (aim?.type === 'robot') {
        prompt.textContent = 'Left click · strike';
        prompt.hidden = false;
      } else if (aim?.type === 'cuff') {
        const pct = Math.round((aim.cuff.cut / CUT_TIME) * 100);
        prompt.textContent = holding ? `Cutting the cuff… ${pct}%` : 'Hold left click · cut the cuff';
        prompt.hidden = false;
      } else {
        prompt.hidden = true;
      }

      const showHands = !st.equipped && !st.finished;
      hands.left.visible = hands.right.visible = showHands;
      for (const side of ['left', 'right']) {
        const h = hands[side];
        const rest = h.userData.rest;
        let push = 0;
        if (punchT > 0 && side === punchSide) push = Math.sin((1 - punchT / 0.28) * Math.PI);
        h.position.set(rest.x * (1 - push * 0.7), rest.y + push * 0.12, rest.z - push * 0.38);
      }
      if (punchT > 0) punchT = Math.max(0, punchT - dt);

      if (recoil > 0) {
        const k = recoil / 0.7;
        robot.joints.head.rotation.y += Math.sin(recoil * 30) * 0.25 * k;
        robot.joints.head.rotation.x -= 0.2 * k;
        robot.joints.chest.rotation.x -= 0.12 * k;
        camera.position.x += (Math.random() - 0.5) * 0.02 * k;
        recoil = Math.max(0, recoil - dt);
      }
    },
  };
}
