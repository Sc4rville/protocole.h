export function createHumanPlaceholder(THREE) {
  const root = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xcfd6dd,
    roughness: 0.6,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x3a4048,
    roughness: 0.5,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe8d8c8,
    roughness: 0.55,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x22262c,
    roughness: 0.4,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x6a7684,
    metalness: 0.6,
    roughness: 0.35,
  });

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.36, 1.15, 12),
    suitMat,
  );
  torso.position.y = 1.1;
  torso.castShadow = true;
  root.add(torso);

  const hips = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.4, 0.45, 12),
    suitMat,
  );
  hips.position.y = 0.55;
  hips.castShadow = true;
  root.add(hips);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.85;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 14),
    skinMat,
  );
  head.castShadow = true;
  headGroup.add(head);
  root.add(headGroup);

  const limbs = {};

  for (const side of [-1, 1]) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.22, 0.5, 0);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.1, 0.42, 8),
      jointMat,
    );
    leg.position.y = -0.2;
    legGroup.add(leg);
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.2, 0.5),
      shoeMat,
    );
    shoe.position.set(0, -0.42, 0.08);
    shoe.castShadow = true;
    legGroup.add(shoe);
    root.add(legGroup);
    if (side === -1) limbs.leftLeg = legGroup;
    else limbs.rightLeg = legGroup;
  }

  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.58, 1.45, 0);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.55, 8),
      suitMat,
    );
    arm.position.y = -0.25;
    armGroup.add(arm);
    const wrist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10),
      bandMat,
    );
    wrist.position.y = -0.48;
    armGroup.add(wrist);
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 8),
      skinMat,
    );
    hand.position.y = -0.6;
    hand.castShadow = true;
    armGroup.add(hand);
    root.add(armGroup);
    if (side === -1) limbs.leftArm = armGroup;
    else limbs.rightArm = armGroup;
  }

  root.limbs = limbs;
  root.head = headGroup;
  return root;
}

export function createToolPlaceholder(THREE, kind) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: 0x9aa4ae,
    metalness: 0.5,
    roughness: 0.4,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x2c3238,
    roughness: 0.6,
  });
  if (kind === 'probe') {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.4, 10),
      metal,
    );
    group.add(shaft);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.5, 10),
      dark,
    );
    tip.position.y = -1.4;
    tip.rotation.x = Math.PI;
    group.add(tip);
  } else if (kind === 'pliers') {
    for (const side of [-1, 1]) {
      const jaw = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 2.2, 0.5),
        metal,
      );
      jaw.position.set(side * 0.55, 0, 0);
      jaw.rotation.z = side * 0.12;
      group.add(jaw);
    }
    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12),
      dark,
    );
    hinge.rotation.z = Math.PI / 2;
    group.add(hinge);
  } else {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.16, 10, 24),
      metal,
    );
    group.add(ring);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.24, 0.24),
      dark,
    );
    group.add(bar);
  }
  return group;
}

export function createRobotPlaceholder(THREE, facts = []) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: facts.includes('overload_caused') ? 0x4a3230 : 0x8a97a5,
    metalness: 0.4,
    roughness: 0.5,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x22282e,
    roughness: 0.6,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 1.4), bodyMat);
  body.position.y = 2.2;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.0), bodyMat);
  head.position.y = 4.3;
  group.add(head);
  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.2, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x66e0ff }),
  );
  eye.position.set(0, 4.35, 0.55);
  group.add(eye);
  if (!facts.includes('cable_torn')) {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 3.5, 8),
      dark,
    );
    cable.position.set(-1.6, 1.0, 0);
    cable.rotation.z = 0.4;
    group.add(cable);
  }
  const restraintOpen = facts.includes('restraint_released');
  for (const side of [-1, 1]) {
    const cuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.12, 8, 16),
      dark,
    );
    cuff.position.set(side * 1.6, restraintOpen ? 0.4 : 2.4, 0);
    group.add(cuff);
  }
  return group;
}
