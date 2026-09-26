import React, { useEffect, useMemo, useRef } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { RoundedBox } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HEAVEN, HELL, pressPhase } from './game-state.js';

const media = (name) => new URL(`media/${name}`, document.baseURI).href;
const playerIs = (payload) => payload.other?.rigidBodyObject?.userData?.afterworldPlayer === true;

function useSurfaceTextures() {
  const maps = useLoader(THREE.TextureLoader, [media('metal-enfer.webp'), media('surface-paradis.webp')]);
  maps.forEach((map) => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
  });
  return maps;
}

function BoltField({ positions, color = '#82909b' }) {
  const ref = useRef();
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.055, 0.055, 0.045, 8), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.32 }), [color]);
  const matrices = useMemo(() => positions.map((p) => {
    const object = new THREE.Object3D();
    object.position.set(...p);
    object.rotation.x = Math.PI / 2;
    object.updateMatrix();
    return object.matrix.clone();
  }), [positions]);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    matrices.forEach((matrix, i) => ref.current.setMatrixAt(i, matrix));
    ref.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geometry, material, positions.length]} castShadow receiveShadow />;
}

function HellRail({ side, start, length }) {
  const zMid = start - length / 2;
  return (
    <group position={[0, 0, zMid]}>
      <mesh position={[side * 5.25, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 1.1, length]} />
        <meshStandardMaterial color="#65717b" metalness={0.72} roughness={0.48} />
      </mesh>
      <mesh position={[side * 5.23, 1.17, 0]}>
        <boxGeometry args={[0.32, 0.12, length]} />
        <meshStandardMaterial color="#ff6149" emissive="#9b241b" emissiveIntensity={0.45} metalness={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[side * 5.65, 0.26, start - i * (length / 2)]}>
          <boxGeometry args={[0.58, 0.06, 1.4]} />
          <meshStandardMaterial color="#e4e8e9" emissive="#8a3230" emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function BayRibs({ start, end, zone }) {
  const bars = [];
  const count = Math.ceil((start - end) / 12);
  for (let i = 0; i <= count; i += 1) {
    const z = start - i * 12;
    bars.push(
      <group key={i} position={[0, 0, z]}>
        <mesh position={[-5.9, 4.8, 0]} castShadow>
          <boxGeometry args={[0.42, 9.6, 0.5]} />
          <meshStandardMaterial color={zone === 2 ? '#4c545e' : '#68737d'} metalness={0.74} roughness={0.48} />
        </mesh>
        <mesh position={[5.9, 4.8, 0]} castShadow>
          <boxGeometry args={[0.42, 9.6, 0.5]} />
          <meshStandardMaterial color={zone === 2 ? '#4c545e' : '#68737d'} metalness={0.74} roughness={0.48} />
        </mesh>
        <mesh position={[0, 9.35, 0]} castShadow>
          <boxGeometry args={[12, 0.48, 0.5]} />
          <meshStandardMaterial color="#424b55" metalness={0.78} roughness={0.42} />
        </mesh>
        <mesh position={[0, 8.8, 0]}>
          <boxGeometry args={[7.8, 0.06, 0.16]} />
          <meshStandardMaterial color="#ff6149" emissive="#e34231" emissiveIntensity={0.8} />
        </mesh>
      </group>,
    );
  }
  return <group>{bars}</group>;
}

function PipeRuns({ start, end, zone }) {
  const segments = [];
  const count = Math.floor((start - end) / 9);
  for (let i = 0; i <= count; i += 1) {
    const z = start - i * 9;
    for (const side of [-1, 1]) {
      segments.push(
        <group key={`${i}:${side}`} position={[side * (zone === 1 ? 4.65 : 4.25), 7.6 + (i % 2) * 0.25, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 2.2, 12]} />
            <meshStandardMaterial color="#87919a" metalness={0.82} roughness={0.34} />
          </mesh>
          <mesh position={[side * 0.95, -0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 1.2, 10]} />
            <meshStandardMaterial color="#bb493d" metalness={0.52} roughness={0.5} />
          </mesh>
        </group>,
      );
    }
  }
  return <group>{segments}</group>;
}

function IndustrialBay({ start, end, section, texture }) {
  const length = start - end;
  const zMid = (start + end) / 2;
  const plates = useMemo(() => {
    const values = [];
    for (let z = start - 4; z > end + 2; z -= 8) {
      for (const x of [-3.9, -1.3, 1.3, 3.9]) {
        values.push([x, 0.015, z]);
      }
    }
    return values;
  }, [start, end]);
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, -0.3, zMid]} userData={{ environment: true }}>
        <CuboidCollider args={[5, 0.3, length / 2]} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[10, 0.6, length]} />
          <meshStandardMaterial map={texture} color="#b0b7bb" metalness={0.55} roughness={0.65} />
        </mesh>
      </RigidBody>
      <BayRibs start={start} end={end} zone={section} />
      <PipeRuns start={start} end={end} zone={section} />
      <HellRail side={-1} start={start} length={length} />
      <HellRail side={1} start={start} length={length} />
      <BoltField positions={plates} />
      {section === 1 && <MachineryGallery start={start} end={end} />}
      {section === 2 && <PressHall start={start} end={end} />}
    </group>
  );
}

function MachineryGallery({ start, end }) {
  const machinery = [];
  for (let z = start - 12; z > end + 4; z -= 26) {
    const side = z % 2 ? -1 : 1;
    machinery.push(
      <group key={z} position={[side * 7.1, 2.8, z]}>
        <mesh castShadow>
          <cylinderGeometry args={[1.1, 1.1, 1.8, 20, 1, true]} />
          <meshStandardMaterial color="#313a44" metalness={0.78} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[1.15, 0.12, 8, 28]} />
          <meshStandardMaterial color="#a24d42" metalness={0.66} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.95, 0]}>
          <boxGeometry args={[2.4, 0.18, 2.2]} />
          <meshStandardMaterial color="#8d969e" metalness={0.82} roughness={0.38} />
        </mesh>
      </group>,
    );
  }
  return <group>{machinery}</group>;
}

function PressHall({ start, end }) {
  const props = [];
  for (let z = start - 9; z > end + 3; z -= 18) {
    for (const side of [-1, 1]) {
      props.push(
        <group key={`${z}:${side}`} position={[side * 7.2, 0, z]}>
          <mesh position={[0, 4.7, 0]} castShadow>
            <boxGeometry args={[1.1, 9.4, 2.1]} />
            <meshStandardMaterial color="#424a54" metalness={0.8} roughness={0.48} />
          </mesh>
          <mesh position={[-side * 0.6, 3.5, 0]} rotation={[0, 0, side * 0.18]}>
            <boxGeometry args={[0.16, 7.8, 0.2]} />
            <meshStandardMaterial color="#bd5144" emissive="#81251e" emissiveIntensity={0.32} />
          </mesh>
        </group>,
      );
    }
  }
  return <group>{props}</group>;
}

function Hurdle({ spec, lane, onContact, signalsRef }) {
  const x = [-2.6, 0, 2.6][lane];
  const z = 8 - spec.distance;
  const key = `${spec.id}:${lane}`;
  const contact = (payload) => {
    if (playerIs(payload)) {
      signalsRef.current.obstacleContacts.add(key);
      onContact(spec, lane);
    }
  };
  const leave = (payload) => {
    if (playerIs(payload)) signalsRef.current.obstacleContacts.delete(key);
  };
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[x, 0, z]} userData={{ obstacle: spec.id }}>
        <CuboidCollider args={[1.2, 0.4, 0.3]} position={[0, 0.4, 0]} />
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.8, 0.6]} />
          <meshStandardMaterial color="#535c66" map={null} metalness={0.78} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.64, 0.31]}>
          <boxGeometry args={[2.12, 0.12, 0.035]} />
          <meshStandardMaterial color="#ff6149" emissive="#c53226" emissiveIntensity={0.8} />
        </mesh>
        {[-0.86, 0, 0.86].map((xPos) => (
          <mesh key={xPos} position={[xPos, 0.4, 0.33]} rotation={[0, 0, -0.42]}>
            <boxGeometry args={[0.19, 0.56, 0.04]} />
            <meshStandardMaterial color="#e9e5d6" emissive="#815042" emissiveIntensity={0.18} />
          </mesh>
        ))}
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[x, 0, z + 2.2]} userData={{ sensor: spec.id }}>
        <CuboidCollider sensor args={[1.3, 2.2, 1.7]} position={[0, 2, 0]} onIntersectionEnter={contact} onIntersectionExit={leave} />
      </RigidBody>
    </group>
  );
}

function Overhead({ spec, onContact, signalsRef }) {
  const z = 8 - spec.distance;
  const key = `${spec.id}:1`;
  const contact = (payload) => {
    if (playerIs(payload)) {
      signalsRef.current.obstacleContacts.add(key);
      onContact(spec, 1);
    }
  };
  const leave = (payload) => {
    if (playerIs(payload)) signalsRef.current.obstacleContacts.delete(key);
  };
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, 0, z]} userData={{ obstacle: spec.id }}>
        <CuboidCollider args={[3.95, 0.25, 0.375]} position={[0, 1.4, 0]} />
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[7.9, 0.5, 0.75]} />
          <meshStandardMaterial color="#4b545e" metalness={0.8} roughness={0.44} />
        </mesh>
        <mesh position={[0, 1.12, 0.39]}>
          <boxGeometry args={[7.9, 0.12, 0.06]} />
          <meshStandardMaterial color="#ff6149" emissive="#c83226" emissiveIntensity={0.7} />
        </mesh>
        {[-3.2, 3.2].map((x) => (
          <mesh key={x} position={[x, 2.25, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 1.6, 12]} />
            <meshStandardMaterial color="#848e97" metalness={0.8} roughness={0.38} />
          </mesh>
        ))}
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[0, 0, z + 2.1]} userData={{ sensor: spec.id }}>
        <CuboidCollider sensor args={[4.05, 2.1, 1.55]} position={[0, 2, 0]} onIntersectionEnter={contact} onIntersectionExit={leave} />
      </RigidBody>
    </group>
  );
}

function Block({ spec, lane, onContact, signalsRef }) {
  const x = [-2.6, 0, 2.6][lane];
  const z = 8 - spec.distance;
  const key = `${spec.id}:${lane}`;
  const contact = (payload) => {
    if (playerIs(payload)) {
      signalsRef.current.obstacleContacts.add(key);
      onContact(spec, lane);
    }
  };
  const leave = (payload) => {
    if (playerIs(payload)) signalsRef.current.obstacleContacts.delete(key);
  };
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[x, 0, z]} userData={{ obstacle: spec.id }}>
        <CuboidCollider args={[1.2, 1.9, 0.7]} position={[0, 1.9, 0]} />
        <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 3.8, 1.4]} />
          <meshStandardMaterial color="#46505a" metalness={0.72} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.1, 0.72]}>
          <boxGeometry args={[1.85, 0.12, 0.04]} />
          <meshStandardMaterial color="#ff6149" emissive="#b5271c" emissiveIntensity={0.8} />
        </mesh>
        {[-0.72, 0.72].map((xPos) => (
          <mesh key={xPos} position={[xPos, 1.8, 0.74]}>
            <boxGeometry args={[0.12, 2.7, 0.05]} />
            <meshStandardMaterial color="#8d989e" metalness={0.82} />
          </mesh>
        ))}
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[x, 0, z + 2.1]} userData={{ sensor: spec.id }}>
        <CuboidCollider sensor args={[1.28, 2.1, 1.6]} position={[0, 2, 0]} onIntersectionEnter={contact} onIntersectionExit={leave} />
      </RigidBody>
    </group>
  );
}

function Press({ spec, index, runRef, signalsRef, onContact }) {
  const head = useRef();
  const headMesh = useRef();
  const centerX = spec.lanes.reduce((sum, lane) => sum + [-2.6, 0, 2.6][lane], 0) / spec.lanes.length;
  const z = 8 - spec.distance;
  const offset = index * 1.85;
  useFrame(() => {
    if (!head.current || !runRef.current) return;
    const phase = pressPhase(runRef.current.elapsed, offset);
    const y = phase === 'open' ? 3.5 : phase === 'warning' ? 2.8 : phase === 'closed' ? 0.55 : 1.8;
    head.current.setNextKinematicTranslation({ x: centerX, y, z });
    if (headMesh.current) {
      headMesh.current.material.emissive.setHex(phase === 'warning' ? 0xff9a22 : phase === 'closed' ? 0xe33c2b : 0x391510);
      headMesh.current.material.emissiveIntensity = phase === 'warning' || phase === 'closed' ? 1.2 : 0.35;
    }
  });
  const enter = (payload) => {
    if (!playerIs(payload)) return;
    signalsRef.current.activePresses.add(spec.id);
    onContact(spec, 1);
  };
  const exit = (payload) => {
    if (playerIs(payload)) signalsRef.current.activePresses.delete(spec.id);
  };
  return (
    <group>
      <mesh position={[centerX - 1.55, 2.2, z]} castShadow>
        <boxGeometry args={[0.3, 4.4, 0.7]} />
        <meshStandardMaterial color="#555f69" metalness={0.84} roughness={0.4} />
      </mesh>
      <mesh position={[centerX + 1.55, 2.2, z]} castShadow>
        <boxGeometry args={[0.3, 4.4, 0.7]} />
        <meshStandardMaterial color="#555f69" metalness={0.84} roughness={0.4} />
      </mesh>
      <mesh position={[centerX, 4.5, z]} castShadow>
        <boxGeometry args={[3.6, 0.55, 1.2]} />
        <meshStandardMaterial color="#46505b" metalness={0.84} roughness={0.4} />
      </mesh>
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[centerX + x, 2.2, z + 0.38]}>
          <cylinderGeometry args={[0.09, 0.09, 3.7, 10]} />
          <meshStandardMaterial color="#aeb5b8" metalness={0.9} roughness={0.26} />
        </mesh>
      ))}
      <RigidBody ref={head} type="kinematicPosition" colliders={false} position={[centerX, 3.5, z]} userData={{ pressHead: spec.id }}>
        <CuboidCollider args={[1.38, 0.32, 0.6]} />
        <mesh ref={headMesh} castShadow>
          <boxGeometry args={[2.76, 0.64, 1.2]} />
          <meshStandardMaterial color="#6a737b" emissive="#391510" metalness={0.82} roughness={0.38} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[centerX, 2, z + 1.5]} userData={{ sensor: spec.id }}>
        <CuboidCollider sensor args={[1.42, 2.1, 1.4]} onIntersectionEnter={enter} onIntersectionExit={exit} />
      </RigidBody>
      <mesh position={[centerX, 4.9, z + 0.5]}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshStandardMaterial color="#ff8b39" emissive="#df441d" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function HellExit() {
  return (
    <group position={[0, 0, -372]}>
      <mesh position={[-4.35, 4.1, 0]} castShadow>
        <boxGeometry args={[0.8, 8.2, 1.2]} />
        <meshStandardMaterial color="#59626b" metalness={0.78} roughness={0.4} />
      </mesh>
      <mesh position={[4.35, 4.1, 0]} castShadow>
        <boxGeometry args={[0.8, 8.2, 1.2]} />
        <meshStandardMaterial color="#59626b" metalness={0.78} roughness={0.4} />
      </mesh>
      <mesh position={[0, 8, 0]} castShadow>
        <boxGeometry args={[9.4, 0.65, 1.2]} />
        <meshStandardMaterial color="#68737e" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.6, -0.2]}>
        <planeGeometry args={[7.5, 7.2]} />
        <meshBasicMaterial color="#ff6a42" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 4.8, -0.5]}>
        <boxGeometry args={[2.8, 0.16, 0.08]} />
        <meshStandardMaterial color="#ffd27b" emissive="#ff7439" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function Plant({ x, z, index }) {
  const leaves = [];
  const count = 5 + (index % 3);
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.399 + index * 0.37;
    const radius = 0.12 + (i % 3) * 0.08;
    leaves.push(
      <mesh key={i} position={[Math.cos(angle) * radius, 0.45 + (i % 4) * 0.08, Math.sin(angle) * radius]} rotation={[Math.cos(angle) * 0.35, angle, -Math.sin(angle) * 0.48]} castShadow>
        <sphereGeometry args={[0.15 + (i % 2) * 0.04, 8, 6]} />
        <meshStandardMaterial color={i % 2 ? '#4e8a6c' : '#79a47d'} roughness={0.76} />
      </mesh>,
    );
  }
  return (
    <group position={[x, 0.02, z]}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.3, 1.4]} />
        <meshStandardMaterial color="#c8d5d4" roughness={0.8} />
      </mesh>
      {leaves}
    </group>
  );
}

function IslandDetails({ island, index, texture }) {
  const plantZs = [island.z - island.length * 0.28, island.z + island.length * 0.22];
  return (
    <group position={[island.x, island.y, island.z]}>
      <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[island.width - 0.5, 0.12, island.length - 0.6]} />
        <meshStandardMaterial color="#424f58" metalness={0.5} roughness={0.62} />
      </mesh>
      <mesh position={[0, -0.9, 0]}>
        <boxGeometry args={[island.width - 2, 0.82, island.length - 2]} />
        <meshStandardMaterial color="#64737d" metalness={0.55} roughness={0.72} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (island.width / 2 - 0.55), 0.06, 0]}>
            <boxGeometry args={[0.1, 0.07, island.length - 1.2]} />
            <meshStandardMaterial color="#75dbe2" emissive="#2bb5c6" emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[side * (island.width / 2 - 0.72), 0.28, plantZs[0] - island.z]}>
            <boxGeometry args={[1.65, 0.38, 3.2]} />
            <meshStandardMaterial color="#d9e1d9" roughness={0.88} />
          </mesh>
          <Plant x={side * (island.width / 2 - 0.76)} z={plantZs[0] - island.z} index={index * 11 + side + 2} />
          {index > 0 && (
            <Plant x={side * (island.width / 2 - 0.76)} z={plantZs[1] - island.z} index={index * 17 + side + 5} />
          )}
        </group>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-island.width * 0.28 + i * island.width * 0.28, 0.025, island.length * 0.27]}>
          <boxGeometry args={[1.4, 0.035, 0.11]} />
          <meshStandardMaterial color="#9caeb1" roughness={0.48} />
        </mesh>
      ))}
      {index === 2 && (
        <group position={[0, 0, island.length * 0.08]}>
          <mesh position={[-island.width / 2 + 0.5, 2.4, 0]} castShadow>
            <boxGeometry args={[0.42, 4.8, 0.5]} />
            <meshStandardMaterial color="#c5d1cf" roughness={0.46} />
          </mesh>
          <mesh position={[island.width / 2 - 0.5, 2.4, 0]} castShadow>
            <boxGeometry args={[0.42, 4.8, 0.5]} />
            <meshStandardMaterial color="#c5d1cf" roughness={0.46} />
          </mesh>
          <mesh position={[0, 4.8, 0]} castShadow>
            <boxGeometry args={[island.width - 0.4, 0.36, 0.5]} />
            <meshStandardMaterial color="#d9e0dc" roughness={0.46} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function ReboundPad({ island, signalsRef }) {
  const [x, y, z] = island.pad;
  const padId = `pad:${island.id}`;
  const enter = (payload) => {
    if (playerIs(payload)) signalsRef.current.padContacts.add(padId);
  };
  const exit = (payload) => {
    if (playerIs(payload)) {
      signalsRef.current.padContacts.delete(padId);
      signalsRef.current.padExited.add(padId);
    }
  };
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false} position={[0, 0.12, 0]} userData={{ pad: padId }}>
        <CuboidCollider sensor args={[1.28, 0.35, 1.3]} onIntersectionEnter={enter} onIntersectionExit={exit} />
      </RigidBody>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.32, 0.24, 32]} />
        <meshStandardMaterial color="#e6f4ed" metalness={0.22} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.88, 0.055, 8, 32]} />
        <meshStandardMaterial color="#5fddd1" emissive="#25bdba" emissiveIntensity={1.05} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, -0.06 - i * 0.045, 0]}>
          <torusGeometry args={[0.48 - i * 0.045, 0.035, 8, 20]} />
          <meshStandardMaterial color="#84949a" metalness={0.84} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

const energyRoutes = [
  [[-1.6, 5.4, -21], [-3.3, 7.2, -26], [-5.1, 5.2, -31]],
  [[-1.3, 8.2, -62], [0, 11.6, -67], [1.8, 8.1, -72]],
  [[3.2, 10.6, -102], [0, 13, -107], [-2.1, 9.4, -112]],
  [[-3.6, 7.4, -142], [-1.7, 9.2, -147], [0.6, 7.2, -152]],
];

function EnergyChain({ points, index, runRef }) {
  const refs = useRef([]);
  useFrame((_, dt) => {
    const run = runRef.current;
    if (!run) return;
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.visible = !run.collected.has(`ring-${index}-${i}`);
      mesh.rotation.z += dt * (i % 2 ? -0.6 : 0.6);
      mesh.rotation.y += dt * 0.42;
    });
  });
  return points.map((p, i) => (
    <group key={i} position={p}>
      <mesh ref={(mesh) => { refs.current[i] = mesh; }} castShadow>
        <torusGeometry args={[0.58, 0.09, 12, 28]} />
        <meshStandardMaterial color="#d6fff8" emissive="#6ff3e5" emissiveIntensity={1.35} metalness={0.2} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshBasicMaterial color="#f5fffb" />
      </mesh>
    </group>
  ));
}

function CloudLayer({ z, y, scale, opacity }) {
  return (
    <group position={[0, y, z]} scale={scale}>
      {[[-12, 0, 0], [-6, 0.6, -1.5], [0, 0.2, 0], [7, 0.8, -1], [13, 0, 0.5]].map(([x, yy, zz], i) => (
        <mesh key={i} position={[x, yy, zz]} scale={[2.6, 0.65, 1.7]}>
          <sphereGeometry args={[2, 16, 10]} />
          <meshBasicMaterial color="#f2fbff" transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function HeavenIsland({ island, index, signalsRef, texture }) {
  const enter = (payload) => {
    if (playerIs(payload)) signalsRef.current.islandContacts.add(island.id);
  };
  const exit = (payload) => {
    if (playerIs(payload)) signalsRef.current.islandContacts.delete(island.id);
  };
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[island.x, island.y - 0.7, island.z]} userData={{ islandId: island.id }} onCollisionEnter={enter} onCollisionExit={exit}>
        <RoundedBox args={[island.width, 0.7, island.length]} radius={0.45} smoothness={4} position={[0, 0.35, 0]} castShadow receiveShadow>
          <meshStandardMaterial map={texture} color="#ffffff" metalness={0.08} roughness={0.8} />
        </RoundedBox>
        <CuboidCollider args={[island.width / 2 - 0.18, 0.35, island.length / 2 - 0.2]} position={[0, 0.35, 0]} friction={0.68} />
      </RigidBody>
      <IslandDetails island={island} index={index} texture={texture} />
      {island.pad && <ReboundPad island={island} signalsRef={signalsRef} />}
    </group>
  );
}

function HeavenWorld({ runRef, signalsRef }) {
  const [, texture] = useSurfaceTextures();
  return (
    <group>
      <CloudLayer z={-32} y={-11} scale={1.3} opacity={0.7} />
      <CloudLayer z={-94} y={-14} scale={1.8} opacity={0.55} />
      <CloudLayer z={-155} y={-15} scale={2.2} opacity={0.44} />
      {HEAVEN.islands.map((island, index) => (
        <HeavenIsland key={island.id} island={island} index={index} signalsRef={signalsRef} texture={texture} />
      ))}
      {energyRoutes.map((points, index) => <EnergyChain key={index} points={points} index={index} runRef={runRef} />)}
      <ExitPortal position={HEAVEN.exit} />
    </group>
  );
}

function ExitPortal({ position }) {
  return (
    <group position={position}>
      <mesh position={[-3.1, 3.7, 0]} castShadow>
        <boxGeometry args={[0.48, 7.4, 0.55]} />
        <meshStandardMaterial color="#d9e3df" roughness={0.48} />
      </mesh>
      <mesh position={[3.1, 3.7, 0]} castShadow>
        <boxGeometry args={[0.48, 7.4, 0.55]} />
        <meshStandardMaterial color="#d9e3df" roughness={0.48} />
      </mesh>
      <mesh position={[0, 7.3, 0]} castShadow>
        <boxGeometry args={[6.6, 0.48, 0.55]} />
        <meshStandardMaterial color="#e6eeea" roughness={0.46} />
      </mesh>
      <mesh position={[0, 3.4, -0.15]}>
        <planeGeometry args={[5.7, 6.8]} />
        <meshBasicMaterial color="#a9fff0" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 6.9, -0.45]}>
        <torusGeometry args={[0.7, 0.09, 12, 28]} />
        <meshStandardMaterial color="#78e5d7" emissive="#54cabd" emissiveIntensity={0.95} />
      </mesh>
    </group>
  );
}

export default function World({ mode, runRef, signalsRef, audio, onObstacleContact }) {
  const textures = useSurfaceTextures();
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const heaven = mode === 'heaven';
    scene.background = new THREE.Color(heaven ? '#b9dff1' : '#111923');
    scene.fog = new THREE.Fog(heaven ? '#d9edf4' : '#17222d', heaven ? 30 : 42, heaven ? 112 : 162);
  }, [mode, scene]);
  if (mode === 'heaven') return <HeavenWorld runRef={runRef} signalsRef={signalsRef} />;
  const metal = textures[0];
  const zones = [
    { start: 8, end: -127, section: 0 },
    { start: -127, end: -257, section: 1 },
    { start: -257, end: -372, section: 2 },
  ];
  const obstacles = HELL.obstacles.map((spec, index) => spec.kind === 'press' ? (
    <Press key={spec.id} spec={spec} index={index} runRef={runRef} signalsRef={signalsRef} onContact={onObstacleContact} />
  ) : spec.kind === 'overhead' ? (
    <Overhead key={spec.id} spec={spec} onContact={onObstacleContact} signalsRef={signalsRef} />
  ) : spec.lanes.map((lane) => spec.kind === 'hurdle' ? (
    <Hurdle key={`${spec.id}-${lane}`} spec={spec} lane={lane} onContact={onObstacleContact} signalsRef={signalsRef} />
  ) : (
    <Block key={`${spec.id}-${lane}`} spec={spec} lane={lane} onContact={onObstacleContact} signalsRef={signalsRef} />
  )));
  return (
    <group>
      {zones.map((zone) => <IndustrialBay key={zone.section} {...zone} texture={metal} />)}
      {obstacles}
      <HellExit />
    </group>
  );
}
