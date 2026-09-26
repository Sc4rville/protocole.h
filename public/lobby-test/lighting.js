import { ROOM } from './movement.js';

const THREE = globalThis.THREE;

const LAMP_COLOR = 0xfff3e0;
const COVE_COLOR = 0xdce6f0;
const PRESENCE_COLOR = 0x86aad4;

export function buildLighting(scene, mats) {
  const ambient = new THREE.HemisphereLight(0xeff0ec, 0x8e8c86, 0.25);
  scene.add(ambient);

  const lamp = new THREE.Group();
  lamp.position.set(0, ROOM.height - 0.02, -0.15);

  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.06, 20), mats.steel);
  lamp.add(mount);

  const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 14), mats.lampShell);
  upperArm.position.set(0, -0.3, 0.06);
  upperArm.rotation.x = 0.2;
  upperArm.castShadow = true;
  lamp.add(upperArm);

  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mats.steel);
  elbow.position.set(0, -0.6, 0.18);
  lamp.add(elbow);

  const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.52, 14), mats.lampShell);
  lowerArm.position.set(0, -0.79, 0.34);
  lowerArm.rotation.x = 0.85;
  lowerArm.castShadow = true;
  lamp.add(lowerArm);

  const head = new THREE.Group();
  head.position.set(0, -1.0, 0.5);
  head.rotation.x = 0.22;

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2.6), mats.lampShell);
  dome.castShadow = true;
  head.add(dome);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 10, 36), mats.steel);
  rim.rotation.x = Math.PI / 2;
  head.add(rim);

  const lensMaterials = [];
  const lensRing = [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2], [0.15, 0.15], [-0.15, -0.15]];
  for (const [lx, lz] of lensRing) {
    const mat = mats.lens.clone();
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), mat);
    lens.rotation.x = -Math.PI / 2;
    lens.position.set(lx, -0.012, lz);
    head.add(lens);
    lensMaterials.push(mat);
  }

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 1.9, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: LAMP_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.set(0, -1.0, 0);
  head.add(beam);

  lamp.add(head);
  scene.add(lamp);

  const spot = new THREE.SpotLight(LAMP_COLOR, 0, 5.5, Math.PI / 7.5, 0.45, 1.6);
  spot.position.set(0, ROOM.height - 1.05, 0.35);
  spot.target.position.set(0, 0.7, -0.05);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  spot.shadow.camera.near = 0.4;
  spot.shadow.camera.far = 6;
  scene.add(spot, spot.target);

  const coveLights = [];
  for (const [x, z] of [[0, ROOM.halfZ - 0.5], [0, -ROOM.halfZ + 0.5], [ROOM.halfX - 0.5, 0], [-ROOM.halfX + 0.5, 0]]) {
    const light = new THREE.PointLight(COVE_COLOR, 0, 7, 2);
    light.position.set(x, ROOM.height - 0.22, z);
    scene.add(light);
    coveLights.push(light);
  }

  const presence = new THREE.PointLight(PRESENCE_COLOR, 0, 6, 2);
  presence.position.set(-0.15, 1.6, -ROOM.halfZ + 0.35);
  scene.add(presence);

  return { ambient, lamp, head, beam, spot, lensMaterials, coveLights, presence };
}

export function applyLevels(rig, mats, refs, levels, time) {
  const lamp = levels.lamp;
  rig.spot.intensity = 0.2 + lamp * 3.4;
  // a gas-discharge head never sits perfectly still
  const flicker = 1 + Math.sin(time * 9.3) * 0.006 + Math.sin(time * 2.1) * 0.004;
  rig.spot.intensity *= flicker;
  rig.beam.material.opacity = Math.max(0, lamp - 0.35) * 0.05;
  for (const mat of rig.lensMaterials) mat.emissiveIntensity = 0.05 + lamp * 2.4;

  const cove = levels.cove;
  for (const light of rig.coveLights) light.intensity = cove * 0.55;
  mats.cove.emissiveIntensity = 0.05 + cove * 0.9;

  rig.ambient.intensity = 0.015 + levels.ambient * 0.55;
  const bounce = 0.01 + levels.ambient * 1.6 + levels.cove * 0.3;
  for (const entry of mats.envDriven) entry.mat.envMapIntensity = entry.base * bounce;

  const glow = levels.window;
  mats.windowGlow.emissiveIntensity = glow * 1.6 * (1 + Math.sin(time * 0.7) * 0.06);
  rig.presence.intensity = Math.max(0, glow - 0.2) * 0.75;

  if (refs.ventBlades) refs.ventBlades.rotation.z += (0.4 + levels.fan * 5.5) * 0.016;

  const openAngle = -levels.restraint * 0.95;
  for (const cuff of refs.restraints) cuff.rotation.z = openAngle;

  const diagnostic = levels.diagnostic;
  const leds = refs.leds.concat(refs.wallPanelLeds);
  leds.forEach((led, i) => {
    const wave = Math.sin(time * 3.4 - i * 0.7) * 0.5 + 0.5;
    led.material.emissiveIntensity = diagnostic * (0.25 + wave * 1.5);
  });
}
