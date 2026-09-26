// The cell, rebuilt from the lobby modules, driven by the trailer timeline
// instead of the player.
import { buildChair } from '../lobby-test/chair.js';
import { animateDetails, buildDetails } from '../lobby-test/details.js';
import { applyLevels, buildLighting } from '../lobby-test/lighting.js';
import { createMaterials } from '../lobby-test/materials.js';
import { buildProps } from '../lobby-test/props.js';
import { buildRoom } from '../lobby-test/room.js';
import { createSequence } from '../lobby-test/sequence.js';
import { buildRobot, createRobotMaterials } from '../robot-test/robot.js';
import { ROBOT } from './timeline.js';

const THREE = globalThis.THREE;

export function createStage(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b0d);
  scene.fog = new THREE.FogExp2(0x1a1b1d, 0.035);

  const mats = createMaterials(renderer);
  const room = buildRoom(scene, mats);
  const chair = buildChair(scene, mats);
  const props = buildProps(scene, mats);
  const rig = buildLighting(scene, mats);
  const details = buildDetails(scene, mats, rig);
  if (chair.trayAssembly) chair.trayAssembly.visible = false;

  const refs = {
    restraints: [],
    leds: chair.leds,
    wallPanelLeds: room.wallPanelLeds,
    ventBlades: room.ventBlades,
    doorReader: room.doorReader,
    windowFigure: room.windowFigure,
    stationStrip: props.stationStrip,
    probeLed: props.probeLed,
  };

  const robotMats = createRobotMaterials(mats.envMap);
  const robot = buildRobot(robotMats, { grounded: false });
  robot.group.position.set(ROBOT.x, ROBOT.y, ROBOT.z);
  robot.group.scale.setScalar(ROBOT.scale);
  robot.setPose('assis');
  robot.update(1, 0);
  scene.add(robot.group);

  const portRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.006, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x123a40, emissive: 0x35d8e8, emissiveIntensity: 0.8 }),
  );
  portRing.position.set(-0.05, -0.12, 0.07);
  robot.joints.elbowL.add(portRing);

  const cableMat = new THREE.MeshStandardMaterial({ color: 0x2b7f8c, emissive: 0x1c5f6a, emissiveIntensity: 0.5, roughness: 0.5 });
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.045, -0.06, 0.075),
    new THREE.Vector3(0.075, -0.13, 0.1),
    new THREE.Vector3(0.05, -0.2, 0.07),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 16, 0.008, 8, false), cableMat);
  cable.castShadow = true;
  robot.joints.elbowL.add(cable);
  const cableDamage = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x330b06, emissive: 0xc03018, emissiveIntensity: 1.6 }),
  );
  cableDamage.position.set(0.075, -0.13, 0.1);
  cableDamage.visible = false;
  robot.joints.elbowL.add(cableDamage);

  // the probe, held at the port during the arc shots
  const probe = props.probe.clone();
  probe.visible = false;
  probe.rotation.set(0.9, Math.PI * 0.75, 0.2);
  scene.add(probe);

  const spark = new THREE.PointLight(0x86c8ff, 0, 1.6, 2);
  scene.add(spark);
  const sparkMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0 }),
  );
  scene.add(sparkMesh);
  const charge = new THREE.PointLight(0x35d8e8, 0, 1.2, 2);
  scene.add(charge);

  const sequence = createSequence('repos');
  const portWorld = new THREE.Vector3();
  let recoil = 0;

  function apply(shotScene, tracks, elapsed, dt) {
    const s = shotScene || { state: 'repos', robot: false };
    if (sequence.state !== s.state) sequence.setState(s.state);
    const frame = sequence.update(dt, { distance: Infinity });
    const levels = { ...frame.levels };
    levels.lamp = Math.min(1.4, levels.lamp + tracks.lamp * 0.5);
    applyLevels(rig, mats, refs, levels, elapsed, dt);
    animateDetails(details, rig, mats, refs, levels, elapsed, dt);

    robot.group.visible = !!s.robot;
    if (s.pose && robot.pose !== s.pose) robot.setPose(s.pose);
    if (s.look) robot.lookAt(s.look[0], s.look[1]);
    robot.update(dt, elapsed);

    if (s.recoil) recoil = Math.min(1, recoil + dt * 6);
    else recoil = Math.max(0, recoil - dt * 2.5);
    if (recoil > 0) {
      const k = recoil * (0.6 + Math.sin(elapsed * 31) * 0.4);
      robot.joints.chest.rotation.x += k * 0.1;
      robot.joints.head.rotation.x += k * 0.14;
      robot.joints.shoulderL.rotation.z += k * 0.15;
    }
    if (s.damaged) {
      robot.joints.head.rotation.x += 0.24;
      robot.joints.neck.rotation.x += 0.1;
    }
    const dim = s.damaged ? 0.3 : 1;
    robotMats.eye.emissiveIntensity *= tracks.eyes * dim;
    robotMats.glow.opacity *= Math.min(1, tracks.eyes) * dim;
    for (const child of robot.joints.head.children) {
      if (child.isPointLight) child.intensity *= tracks.eyes * dim;
    }

    cable.visible = !s.cableTorn;
    cableDamage.visible = !!s.cableTorn;

    chair.restraints[0].rotation.z = -(1 - tracks.restraint) * 0.95;
    chair.restraints[1].rotation.z = -(1 - tracks.restraint) * 0.95;

    portRing.getWorldPosition(portWorld);
    spark.position.copy(portWorld);
    sparkMesh.position.copy(portWorld);
    const flick = tracks.spark * (0.55 + Math.abs(Math.sin(elapsed * 57)) * 0.45);
    spark.intensity = flick * 3.2;
    sparkMesh.material.opacity = Math.min(1, flick * 1.4);
    sparkMesh.scale.setScalar(0.8 + flick * 1.6);
    portRing.material.emissiveIntensity = 0.8 + tracks.charge * 2.5 + tracks.spark * 3;
    charge.position.copy(portWorld);
    charge.intensity = tracks.charge * 1.4;

    const holding = tracks.spark > 0.01 || tracks.charge > 0.01;
    probe.visible = holding && s.robot;
    if (holding) {
      probe.position.set(portWorld.x - 0.05, portWorld.y + 0.09, portWorld.z + 0.11);
    }
  }

  return { scene, mats, rig, room, chair, props, robot, sequence, apply };
}
