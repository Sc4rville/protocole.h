import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ecctrl } from 'ecctrl';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { HEAVEN, HELL, LANES, advanceFlight, clamp, collectEnergy, disarmPad, landAtIsland, pressPhase, triggerPad } from './game-state.js';

const rigUrl = new URL('media/AnimationLibrary.glb', document.baseURI).href;
useGLTF.setDecoderPath(new URL('media/draco/', document.baseURI).href);
useGLTF.preload(rigUrl);
const flightRings = [
  [[-1.6, 5.4, -21], [-3.3, 7.2, -26], [-5.1, 5.2, -31]],
  [[-1.3, 8.2, -62], [0, 11.6, -67], [1.8, 8.1, -72]],
  [[3.2, 10.6, -102], [0, 13, -107], [-2.1, 9.4, -112]],
  [[-3.6, 7.4, -142], [-1.7, 9.2, -147], [0.6, 7.2, -152]],
];
const actionNames = { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', jump: 'Jump_Loop', land: 'Jump_Land' };
const playerData = { afterworldPlayer: true };

function distanceToSegment(point, start, end) {
  const ab = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
  const ap = new THREE.Vector3(point[0] - start.x, point[1] - start.y, point[2] - start.z);
  const den = ab.lengthSq();
  const t = den > 0 ? clamp(ap.dot(ab) / den, 0, 1) : 0;
  return ap.sub(ab.multiplyScalar(t)).length();
}

function Wing({ runRef }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.06);
    shape.quadraticCurveTo(-0.48, 0.48, -1.35, 0.42);
    shape.quadraticCurveTo(-1.12, -0.28, -0.18, -0.34);
    shape.quadraticCurveTo(0, -0.18, 0, 0.06);
    shape.quadraticCurveTo(0.18, -0.34, 1.12, -0.28);
    shape.quadraticCurveTo(1.35, 0.42, 0.48, 0.48);
    shape.quadraticCurveTo(0.12, 0.26, 0, 0.06);
    return new THREE.ShapeGeometry(shape, 10);
  }, []);
  useFrame((_, dt) => {
    const gliding = runRef.current?.gliding;
    if (!ref.current) return;
    ref.current.visible = Boolean(gliding);
    if (gliding) ref.current.rotation.z = Math.sin(runRef.current.elapsed * 1.7) * 0.035;
  });
  return (
    <mesh ref={ref} geometry={geometry} position={[0, 0.42, 0.16]} rotation={[0, 0, 0]}>
      <meshStandardMaterial color="#b5eee5" emissive="#66cbbd" emissiveIntensity={0.22} transparent opacity={0.58} side={THREE.DoubleSide} depthWrite={false} roughness={0.68} />
    </mesh>
  );
}

function AnimatedRig({ runRef }) {
  const gltf = useGLTF(rigUrl);
  const root = useRef();
  const previous = useRef('');
  const { actions } = useAnimations(gltf.animations, root);
  useEffect(() => {
    gltf.materials.M_Main.color.setHex(0xe4e2dc);
    gltf.materials.M_Main.roughness = 0.76;
    gltf.materials.M_Joints.color.setHex(0x34383a);
    gltf.materials.M_Joints.roughness = 0.63;
  }, [gltf.materials]);
  useFrame((_, dt) => {
    const run = runRef.current || { motion: 'idle', grounded: true, status: 'menu' };
    if (!root.current) return;
    const action = run.sliding ? 'jump' : run.gliding || !run.grounded ? 'jump' : run.motion || 'idle';
    const name = actionNames[action] || actionNames.idle;
    if (previous.current !== name && actions[name]) {
      actions[name].reset().fadeIn(0.18).play();
      if (previous.current && actions[previous.current]) actions[previous.current].fadeOut(0.16);
      actions[name].setLoop(name === actionNames.land ? THREE.LoopOnce : THREE.LoopRepeat, name === actionNames.land ? 1 : Infinity);
      if (name === actionNames.land) actions[name].clampWhenFinished = true;
      previous.current = name;
    }
    root.current.position.y = run.sliding ? -0.53 : -0.92;
    root.current.rotation.x = run.gliding ? -0.12 : run.sliding ? 0.35 : 0;
    root.current.rotation.z = run.gliding ? clamp(run.flight.vx * -0.035, -0.25, 0.25) : 0;
    root.current.scale.set(1, run.sliding ? 0.38 : 1, 1);
    if (actions[name]) actions[name].timeScale = ['paused', 'dead', 'won', 'recovering'].includes(run.status) ? 0 : Math.min(dt, 1 / 30) / Math.max(dt, 0.001);
  });
  return (
    <group ref={root} position={[0, -0.92, 0]} scale={0.92}>
      <group name="Mannequin">
        <skinnedMesh name="Mannequin_1" geometry={gltf.nodes.Mannequin_1.geometry} material={gltf.materials.M_Main} skeleton={gltf.nodes.Mannequin_1.skeleton} castShadow receiveShadow />
        <skinnedMesh name="Mannequin_2" geometry={gltf.nodes.Mannequin_2.geometry} material={gltf.materials.M_Joints} skeleton={gltf.nodes.Mannequin_2.skeleton} castShadow receiveShadow />
      </group>
      <primitive object={gltf.nodes.root} />
      <Wing runRef={runRef} />
    </group>
  );
}

export default function Player({ mode, status, runRef, controlsRef, signalsRef, audio, apiRef, spawnRequestRef, onSnapshot, onStatus }) {
  const controller = useRef(null);
  const { world, rapier } = useRapier();
  const [sliding, setSliding] = useState(false);
  const [gliding, setGliding] = useState(false);
  const normalMass = useRef(0);
  const lastPublish = useRef(0);
  const previousGround = useRef(false);
  const previousPosition = useRef({ x: 0, y: 0, z: 0 });
  const forward = useMemo(() => new THREE.Vector3(0, 0, -1), []);
  const markStatus = (next) => {
    if (runRef.current.status === next) return;
    runRef.current.status = next;
    if (onStatus.current) onStatus.current(next);
  };

  useEffect(() => {
    const api = {
      read: () => {
        const handle = controller.current;
        if (!handle) return null;
        const position = handle.body.translation();
        const velocity = handle.body.linvel();
        return {
          position: { x: position.x, y: position.y, z: position.z },
          velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
          grounded: runRef.current?.grounded ?? false,
          mass: handle.body.mass(),
          capsuleHalfHeight: handle.collider.halfHeight(),
        };
      },
      respawn: (position) => {
        const handle = controller.current;
        if (!handle) return;
        normalMass.current ||= handle.body.mass();
        handle.collider.setHalfHeight(0.45);
        handle.collider.setTranslationWrtParent({ x: 0, y: 0, z: 0 });
        handle.collider.setMass(normalMass.current);
        handle.body.recomputeMassPropertiesFromColliders();
        setSliding(false);
        setGliding(false);
        if (runRef.current) Object.assign(runRef.current, {
          grounded: false, previousGrounded: false, sliding: false, gliding: false,
          slideLeft: 0, slideCooldown: 0, laneCooldown: 0, jumpBuffer: 0, coyote: 0,
          jumpSent: false, jumpCut: false, jumpStartedAt: -100, flightEligible: false,
          flightSpeed: 0, wasDiving: false, stepClock: 0, stepIndex: 0, motion: 'idle',
        });
        handle.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
        handle.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        handle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        handle.body.resetForces(true);
        handle.body.resetTorques(true);
        handle.body.setGravityScale(1, true);
        handle.setMovement({ forward: false, backward: false, leftward: false, rightward: false, run: false, jump: false, joystick: { x: 0, y: 0 } });
        previousPosition.current = { x: position[0], y: position[1], z: position[2] };
        previousGround.current = false;
        lastPublish.current = 0;
      },
    };
    apiRef.current = api;
    if (spawnRequestRef.current) {
      api.respawn(spawnRequestRef.current);
      spawnRequestRef.current = null;
    }
    return () => {
      if (apiRef.current === api) apiRef.current = null;
    };
  }, [apiRef, runRef]);

  useEffect(() => {
    if (!controller.current) return;
    controller.current.setForwardDir(forward);
  }, [forward, mode]);

  useEffect(() => {
    const handle = controller.current;
    if (!handle) return;
    normalMass.current ||= handle.body.mass();
    const height = sliding ? 0.07 : 0.45;
    const difference = height - handle.collider.halfHeight();
    const position = handle.body.translation();
    handle.collider.setHalfHeight(height);
    handle.collider.setMass(normalMass.current);
    handle.body.recomputeMassPropertiesFromColliders();
    handle.body.setTranslation({ ...position, y: position.y + difference }, true);
  }, [sliding]);

  const onObstacleEnter = (spec, lane) => {
    const run = runRef.current;
    const handle = controller.current;
    if (!run || run.status !== 'running' || !handle) return;
    const pos = handle.body.translation();
    const progress = mode === 'hell' ? clamp(8 - pos.z, 0, HELL.length) : 0;
    if (mode === 'hell' && Math.abs(progress - spec.distance) > 2.1) return;
    if (spec.kind === 'hurdle' && pos.y > 1.55) return;
    if (spec.kind === 'overhead' && run.sliding) return;
    if (spec.kind === 'press' && pressPhase(run.elapsed, HELL.obstacles.indexOf(spec) * 1.85) !== 'closed') return;
    run.hitLabel = spec.kind === 'hurdle' ? 'La barrière' : spec.kind === 'overhead' ? 'La barre basse' : spec.kind === 'block' ? 'Le bloc' : 'La presse';
    run.events.push({ type: 'hit', id: spec.id, lane });
    audio.current?.play('hit', { gain: 0.82, pan: clamp(pos.x / 6, -0.6, 0.6) });
    audio.current?.ambience(null);
    run.deaths += 1;
    run.combo = 0;
    markStatus('dead');
  };

  useFrame((_, rawDelta) => {
    const dt = Math.min(Math.max(rawDelta, 0), 1 / 30);
    const run = runRef.current;
    const handle = controller.current;
    if (!run || !handle) return;
    if (status !== 'running' && run.status !== 'recovering') {
      handle.setMovement({ forward: false, backward: false, leftward: false, rightward: false, run: false, jump: false, joystick: { x: 0, y: 0 } });
      return;
    }
    const body = handle.body;
    const position = body.translation();
    const velocity = body.linvel();
    if (run.status === 'recovering') {
      run.recoverLeft = Math.max(0, run.recoverLeft - dt);
      if (run.recoverLeft <= 0) {
        const island = HEAVEN.islands[run.checkpoint] || HEAVEN.islands[0];
        run.energy = run.checkpointEnergy;
        run.collected = new Set(run.checkpointCollected);
        run.armedPads.clear();
        signalsRef.current.padContacts.clear();
        signalsRef.current.padExited.clear();
        for (const key of Object.keys(controlsRef.current)) controlsRef.current[key] = false;
        apiRef.current.respawn(island.spawn);
        run.events.push({ type: 'recover', island: island.id });
        audio.current?.play('recover', { gain: 0.62 });
        audio.current?.ambience('heaven');
        markStatus('running');
      }
      return;
    }
    if (run.status !== 'running') return;

    run.elapsed += dt;
    const input = controlsRef.current;
    const floorHit = mode === 'heaven' && velocity.y <= 1
      ? world.castRayAndGetNormal(new rapier.Ray(position, { x: 0, y: -1, z: 0 }), 1.06, false,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, handle.collider, body)
      : null;
    const floorId = floorHit?.collider.parent()?.userData?.islandId;
    const floorIndex = HEAVEN.islands.findIndex((island) => island.id === floorId);
    const grounded = velocity.y <= 1 && (mode === 'hell'
      ? handle.isOnGround
      : floorIndex >= 0 && floorHit.normal.y > 0.7 && position.y >= HEAVEN.islands[floorIndex].y + 0.65);
    run.grounded = grounded;
    const previous = previousPosition.current;
    const progress = mode === 'hell' ? clamp(8 - position.z, 0, HELL.length) : 0;
    const xSpeed = Math.hypot(velocity.x, velocity.z);
    run.previousY = previous.y;
    run.previousZ = previous.z;

    if (input.jumpPressed) {
      run.jumpBuffer = 0.12;
      run.jumpPressTime = run.elapsed;
      input.jumpPressed = false;
    }
    run.jumpBuffer = Math.max(0, run.jumpBuffer - dt);
    if (grounded) run.coyote = 0.09;
    else run.coyote = Math.max(0, run.coyote - dt);

    if (mode === 'hell') {
      if (input.leftPressed && run.laneCooldown <= 0) {
        run.lane = clamp(run.lane - 1, 0, 2);
        run.laneCooldown = 0.22;
        audio.current?.play('lane-whoosh', { gain: 0.55, rate: 0.95 + Math.random() * 0.08, pan: -0.35 });
      }
      if (input.rightPressed && run.laneCooldown <= 0) {
        run.lane = clamp(run.lane + 1, 0, 2);
        run.laneCooldown = 0.22;
        audio.current?.play('lane-whoosh', { gain: 0.55, rate: 0.95 + Math.random() * 0.08, pan: 0.35 });
      }
      input.leftPressed = false;
      input.rightPressed = false;
      run.laneCooldown = Math.max(0, run.laneCooldown - dt);
      for (const checkpoint of HELL.checkpoints.slice(1)) {
        if (progress >= checkpoint && run.checkpoint < checkpoint) {
          run.checkpoint = checkpoint;
          run.events.push({ type: 'checkpoint', distance: checkpoint });
          audio.current?.play('checkpoint', { gain: 0.65 });
        }
      }
      for (const sensor of signalsRef.current.obstacleContacts) {
        const [id, laneText] = sensor.split(':');
        const spec = HELL.obstacles.find((obstacle) => obstacle.id === id);
        if (spec) onObstacleEnter(spec, Number(laneText));
      }
      for (let i = 0; i < HELL.obstacles.length; i += 1) {
        const spec = HELL.obstacles[i];
        if (spec.kind !== 'press') continue;
        const phase = pressPhase(run.elapsed, i * 1.85);
        const last = run.pressPhases?.[spec.id];
        if (!run.pressPhases) run.pressPhases = {};
        if (Math.abs(progress - spec.distance) < 28 && phase !== last) {
          if (phase === 'warning') {
            audio.current?.play('press-warning', { gain: 0.72, pan: clamp(position.x / 6, -0.8, 0.8) });
            run.events.push({ type: 'press-warning', id: spec.id });
          }
          if (phase === 'closed') {
            audio.current?.play('press-impact', { gain: 0.82, pan: clamp(position.x / 6, -0.8, 0.8) });
            run.events.push({ type: 'press-impact', id: spec.id });
          }
        }
        run.pressPhases[spec.id] = phase;
        if (signalsRef.current.activePresses.has(spec.id) && phase === 'closed' && Math.abs(progress - spec.distance) < 2.1) onObstacleEnter(spec, 1);
      }
      const deltaLane = LANES[run.lane] - position.x;
      const jumpReady = run.jumpBuffer > 0 && !run.jumpSent && !run.sliding;
      if (jumpReady && grounded) {
        run.jumpSent = true;
        run.jumpStartedAt = run.elapsed;
        run.coyote = 0;
        run.jumpCut = false;
        run.events.push({ type: 'jump' });
        run.jumpBuffer = 0;
        run.flightEligible = true;
        audio.current?.play('jump', { gain: 0.5, rate: 0.98 + Math.random() * 0.04 });
      } else if (run.jumpBuffer > 0 && !grounded && run.coyote > 0 && !run.jumpSent) {
        body.applyImpulse({ x: 0, y: body.mass() * 9.5, z: 0 }, true);
        run.jumpSent = true;
        run.jumpStartedAt = run.elapsed;
        run.coyote = 0;
        run.jumpCut = false;
        run.events.push({ type: 'jump' });
        run.jumpBuffer = 0;
        run.flightEligible = true;
        audio.current?.play('jump', { gain: 0.5 });
      }
      if (!input.jump) run.jumpSent = false;
      let slideChanged = false;
      if (input.slidePressed) {
        input.slidePressed = false;
        if (grounded && run.slideCooldown <= 0) {
          run.slideLeft = 0.75;
          run.slideCooldown = 0.2;
          run.sliding = true;
          slideChanged = true;
          audio.current?.play('slide', { gain: 0.58 });
        }
      }
      run.slideCooldown = Math.max(0, run.slideCooldown - dt);
      if (input.down && !grounded && velocity.y > -12) body.setLinvel({ x: velocity.x, y: -12, z: velocity.z }, true);
      if (run.slideLeft > 0) {
        run.slideLeft = Math.max(0, run.slideLeft - dt);
        if (run.slideLeft === 0) {
          run.sliding = false;
          slideChanged = true;
        }
      }
      if (slideChanged) setSliding(run.sliding);
      handle.setMovement({
        joystick: { x: clamp(deltaLane * 1.8, -0.72, 0.72), y: 1 },
        run: true,
        jump: jumpReady && grounded,
        forward: false,
        backward: false,
        leftward: false,
        rightward: false,
      });
      if (progress >= HELL.length && grounded) {
        run.finish = true;
        run.events.push({ type: 'finish', mode: 'hell' });
        audio.current?.ambience(null);
        audio.current?.play('finish', { gain: 0.88 });
        markStatus('won');
      }
    } else {
      const jumpReady = run.jumpBuffer > 0 && !run.jumpSent && !run.sliding;
      if (jumpReady && grounded) {
        run.jumpSent = true;
        run.jumpStartedAt = run.elapsed;
        run.coyote = 0;
        run.jumpCut = false;
        run.events.push({ type: 'jump' });
        run.flightEligible = true;
        run.jumpBuffer = 0;
        audio.current?.play('jump', { gain: 0.45 });
      }
      if (!input.jump) run.jumpSent = false;
      if (run.gliding && !input.jump) {
        run.gliding = false;
        run.flightEligible = false;
        body.setGravityScale(1, true);
        audio.current?.flight(0, false);
      }
      if (!grounded && velocity.y <= 1 && input.jump && run.flightEligible && !run.gliding && run.elapsed - (run.jumpStartedAt || 0) > 0.12) {
        run.flight = {
          speed: Math.max(9, Math.hypot(velocity.x, velocity.z)),
          pitch: -0.12,
          vx: velocity.x,
          vy: velocity.y,
          vz: velocity.z || -9,
        };
        run.gliding = true;
        run.flightSpeed = run.flight.speed;
        body.setGravityScale(0, true);
        body.setLinvel({ x: run.flight.vx, y: run.flight.vy, z: run.flight.vz }, true);
        audio.current?.play('glider-open', { gain: 0.7 });
      }
      if (run.gliding) {
        const prior = run.flight;
        const flight = advanceFlight(prior, { dive: input.down, flare: input.up, steer: (input.right ? 1 : 0) - (input.left ? 1 : 0) }, dt);
        run.flight = flight;
        run.flightSpeed = flight.speed;
        body.setLinvel({ x: flight.vx, y: flight.vy, z: flight.vz }, true);
        audio.current?.flight(flight.speed, true);
        if (input.down && !run.wasDiving) audio.current?.play('air-dive', { gain: 0.55 });
        run.wasDiving = input.down;
      } else {
        audio.current?.flight(0, false);
        handle.setMovement({
          forward: input.up,
          backward: input.down,
          leftward: input.left,
          rightward: input.right,
          run: false,
          jump: jumpReady && grounded,
          joystick: { x: 0, y: 0 },
        });
      }
      for (const id of signalsRef.current.padExited) {
        if (grounded && !signalsRef.current.padContacts.has(id)) {
          disarmPad(run, id);
          signalsRef.current.padExited.delete(id);
        }
      }
      if (grounded) {
        for (const island of HEAVEN.islands) {
          if (!island.pad) continue;
          const id = `pad:${island.id}`;
          if (!signalsRef.current.padContacts.has(id) || run.armedPads.has(id)) continue;
          const pos = body.translation();
          if (pos.y < island.y + 0.25 || Math.abs(pos.x - island.pad[0]) > 1.35 || Math.abs(pos.z - island.pad[2]) > 1.35) continue;
          if (triggerPad(run, id, { heightAboveSurface: pos.y - island.y, grounded, fromAbove: previous.y > island.y + 0.25 })) {
            const next = HEAVEN.islands[Math.min(HEAVEN.islands.indexOf(island) + 1, HEAVEN.islands.length - 1)];
            const perfect = run.elapsed - (run.jumpPressTime ?? -100) <= 0.16;
            const up = perfect ? 16 : 13.5;
            const mass = body.mass();
            const targetX = clamp((next.x - island.x) * 0.12, -3, 3);
            body.applyImpulse({ x: mass * (targetX - velocity.x), y: mass * up, z: mass * (-10 - velocity.z) }, true);
            run.flightEligible = true;
            run.bouncedAt = run.elapsed;
            collectEnergy(run, id);
            audio.current?.play(perfect ? 'perfect-rebound' : 'rebound', { gain: 0.78 });
            run.events.push({ type: perfect ? 'perfect-rebound' : 'rebound', id });
          }
        }
      }
      const current = body.translation();
      if (grounded && !run.previousGrounded && velocity.y <= 1.5) {
        const islandIndex = floorIndex;
        if (islandIndex >= 0) {
          const island = HEAVEN.islands[islandIndex];
          const cameFromAbove = previous.y > island.y + 0.25 && velocity.y <= 1.5;
          if (landAtIsland(run, islandIndex, cameFromAbove)) audio.current?.play('checkpoint', { gain: 0.64 });
          if (run.gliding) {
            run.gliding = false;
            run.flightEligible = false;
            body.setGravityScale(1, true);
            audio.current?.flight(0, false);
          }
          if (velocity.y < -7) audio.current?.play('land-hard', { gain: 0.8 });
          else audio.current?.play('land-soft', { gain: 0.5 });
          run.combo = Math.max(0, run.combo);
          run.events.push({ type: 'land', island: island.id });
          run.landAnimationLeft = 0.28;
        }
      }
      if (run.landAnimationLeft > 0) {
        run.landAnimationLeft = Math.max(0, run.landAnimationLeft - dt);
        if (run.landAnimationLeft === 0) run.motion = 'idle';
      }
      if (previous.y < -14 && run.status === 'running') {
        run.status = 'recovering';
        run.recoverLeft = 0.48;
        run.gliding = false;
        audio.current?.flight(0, false);
        audio.current?.ambience(null);
        run.events.push({ type: 'fall', checkpoint: run.checkpoint });
        onStatus.current?.('recovering');
      }
      for (const chain of flightRings) {
        for (let i = 0; i < chain.length; i += 1) {
          const id = `ring-${flightRings.indexOf(chain)}-${i}`;
          if (run.collected.has(id)) continue;
          if (distanceToSegment(chain[i], previous, current) < 1.1) {
            if (collectEnergy(run, id)) audio.current?.play('collect', { gain: 0.7, pan: clamp(current.x / 8, -0.6, 0.6) });
          }
        }
      }
      if (run.checkpoint === 4 && floorIndex === 4 && current.z <= HEAVEN.exit[2] && grounded) {
        run.finish = true;
        run.events.push({ type: 'finish', mode: 'heaven' });
        audio.current?.ambience(null);
        audio.current?.play('finish', { gain: 0.9 });
        markStatus('won');
      }
    }

    if (gliding !== run.gliding) setGliding(run.gliding);
    const holdingJump = input.jump || (mode === 'hell' && input.up);
    if (!holdingJump && !run.gliding && !run.jumpCut && run.elapsed - (run.jumpStartedAt ?? -100) >= 0.12 && velocity.y > 0) {
      const currentVelocity = body.linvel();
      body.setLinvel({ ...currentVelocity, y: currentVelocity.y * 0.55 }, true);
      run.jumpCut = true;
    }
    if (grounded && xSpeed > 0.55 && !run.sliding && run.status === 'running') {
      run.stepIndex ??= 0;
      run.stepClock = (run.stepClock || 0) + xSpeed * dt;
      if (run.stepClock > (mode === 'hell' ? 2.4 : 1.6)) {
        run.stepClock = 0;
        const footstep = mode === 'hell'
          ? (run.stepIndex++ % 2 ? 'step-metal-b' : 'step-metal-a')
          : (run.stepIndex++ % 2 ? 'step-stone-b' : 'step-stone-a');
        audio.current?.play(footstep, { gain: clamp(xSpeed / 8, 0.18, 0.48), rate: 0.97 + Math.random() * 0.06, pan: clamp(position.x / 7, -0.5, 0.5) });
      }
    } else {
      run.stepClock = 0;
    }

    if (mode === 'hell') {
      const nearObstacle = HELL.obstacles.some((spec) => Math.abs(progress - spec.distance) < 30);
      run.motion = !grounded ? 'jump' : xSpeed > 4 ? 'run' : xSpeed > 0.5 || nearObstacle ? 'walk' : 'idle';
    } else {
      run.motion = run.gliding || !grounded ? 'jump' : xSpeed > 0.5 ? 'walk' : 'idle';
    }
    run.previousGrounded = grounded;
    previousGround.current = grounded;
    previousPosition.current = { x: position.x, y: position.y, z: position.z };
    if (run.status === 'running' && run.elapsed - lastPublish.current >= 0.09) {
      lastPublish.current = run.elapsed;
      onSnapshot.current?.({
        mode,
        status: run.status,
        elapsed: run.elapsed,
        position: { x: position.x, y: position.y, z: position.z },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        grounded,
        sliding: run.sliding,
        gliding: run.gliding,
        flightSpeed: run.flightSpeed,
        checkpoint: run.checkpoint,
        energy: run.energy,
        combo: run.combo,
        deaths: run.deaths,
        collected: [...run.collected],
        events: run.events.slice(-50),
      });
    }
  });

  const capHalfHeight = sliding ? 0.07 : 0.45;
  return (
    <Ecctrl
      ref={controller}
      name="afterworld-player"
      userData={playerData}
      position={[0, mode === 'hell' ? 0.92 : 1.4, mode === 'hell' ? 8 : 7]}
      enable={status === 'running' && !gliding}
      lockForward={mode === 'hell'}
      enabledRotations={[false, true, false]}
      useCustomForward
      capsuleHalfHeight={0.45}
      capsuleRadius={0.28}
      rayOriginOffest={-capHalfHeight}
      rayLength={1.25}
      rayRadius={0.14}
      rayHitForgiveness={0.2}
      floatHeight={0.18}
      jumpVel={9.5}
      jumpDuration={0.08}
      fallingGravityScale={1.5}
      fallingMaxVel={22}
      maxWalkVel={mode === 'hell' ? 12 : 6.8}
      maxRunVel={mode === 'hell' ? 12 : 6.8}
      accDeltaTime={0.14}
      decDeltaTime={0.18}
      airDragFactor={0.02}
      enableToggleRun={false}
      canSleep={false}
      ccd
      friction={0.18}
      colliders={false}
      gravityScale={1}
    >
      <AnimatedRig runRef={runRef} />
    </Ecctrl>
  );
}
