import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, PLAYER_RADIUS, CHAIR, PROPS, movePlayer, directionFromKeys, clampToRoom, distanceToChair }
  from '../public/lobby-test/movement.js';

const LIM_X = ROOM.halfX - PLAYER_RADIUS;
const LIM_Z = ROOM.halfZ - PLAYER_RADIUS;
const CORNER_LIMIT = ROOM.halfX + ROOM.halfZ - ROOM.chamfer - PLAYER_RADIUS * Math.SQRT2;
const EX = {
  minX: CHAIR.minX - PLAYER_RADIUS,
  maxX: CHAIR.maxX + PLAYER_RADIUS,
  minZ: CHAIR.minZ - PLAYER_RADIUS,
  maxZ: CHAIR.maxZ + PLAYER_RADIUS,
};
const inside = (p) => p.x > EX.minX && p.x < EX.maxX && p.z > EX.minZ && p.z < EX.maxZ;

test('dt 0 produces no movement', () => {
  const p = movePlayer({ x: 1, z: 2 }, { x: 1, z: 0 }, 0);
  assert.deepEqual(p, { x: 1, z: 2 });
});

test('forward at yaw 0 decreases z', () => {
  const keys = new Set(['KeyW']);
  const dir = directionFromKeys(keys, 0);
  const p = movePlayer({ x: 0, z: 2 }, dir, 0.016);
  assert.ok(p.z < 2);
  assert.equal(p.x, 0);
});

test('forward at yaw PI/2 moves x negative', () => {
  const dir = directionFromKeys(new Set(['KeyW']), Math.PI / 2);
  const p = movePlayer({ x: 1, z: 2 }, dir, 0.016);
  assert.ok(p.x < 1);
});

test('diagonal covers same path length as axis movement', () => {
  const axis = movePlayer({ x: 0, z: 3 }, { x: 1, z: 0 }, 0.016);
  const diag = movePlayer({ x: 0, z: 3 }, { x: 1, z: 1 }, 0.016);
  const dAxis = Math.abs(axis.x);
  const dDiag = Math.hypot(diag.x, diag.z - 3);
  assert.ok(Math.abs(dAxis - dDiag) < 1e-9);
});

test('wall limit stays within interior', () => {
  let p = { x: 0, z: 2 };
  for (let i = 0; i < 500; i++) p = movePlayer(p, { x: 1, z: 0 }, 0.016);
  assert.equal(p.x, LIM_X);
  let q = { x: 2, z: 0 };
  for (let i = 0; i < 500; i++) q = movePlayer(q, { x: 0, z: 1 }, 0.016);
  assert.ok(q.z <= LIM_Z + 1e-9);
});

test('chamfered corners push the player back onto the diagonal', () => {
  let p = { x: 2, z: 2 };
  for (let i = 0; i < 500; i++) p = movePlayer(p, { x: 1, z: 1 }, 0.016);
  assert.ok(Math.abs(p.x) + Math.abs(p.z) <= CORNER_LIMIT + 1e-9);
  assert.ok(Math.abs(Math.abs(p.x) + Math.abs(p.z) - CORNER_LIMIT) < 1e-6);
});

test('clampToRoom keeps every direction inside the octagon', () => {
  for (let a = 0; a < 64; a++) {
    const angle = (a / 64) * Math.PI * 2;
    const p = clampToRoom(Math.cos(angle) * 20, Math.sin(angle) * 20);
    assert.ok(Math.abs(p.x) <= LIM_X + 1e-9);
    assert.ok(Math.abs(p.z) <= LIM_Z + 1e-9);
    assert.ok(Math.abs(p.x) + Math.abs(p.z) <= CORNER_LIMIT + 1e-9);
  }
});

test('distanceToChair is zero inside the collider and grows outside', () => {
  assert.equal(distanceToChair(0, 0), 0);
  assert.ok(distanceToChair(0, 2) > distanceToChair(0, 1.5));
  assert.ok(Math.abs(distanceToChair(0, CHAIR.maxZ + 1) - 1) < 1e-9);
});

test('cannot cross center collider walking forward from z=1.3', () => {
  let p = { x: 0, z: 1.3 };
  const dir = { x: 0, z: -1 };
  for (let i = 0; i < 120; i++) p = movePlayer(p, dir, 0.016);
  assert.ok(!inside(p));
  assert.ok(p.z >= EX.maxZ - 1e-9);
});

test('can walk beside the chair from x=1.4', () => {
  let p = { x: 1.4, z: 0 };
  for (let i = 0; i < 200; i++) p = movePlayer(p, { x: 0, z: -1 }, 0.016);
  assert.ok(p.z < -2);
});

test('wallward plus tangential input slides along obstacle', () => {
  let p = { x: 0, z: 1.5 };
  for (let i = 0; i < 200; i++) p = movePlayer(p, { x: 1, z: -1 }, 0.016);
  assert.ok(!inside(p));
  assert.ok(p.x > 1);
});

test('input objects are not mutated', () => {
  const pos = { x: 1, z: 1 };
  const dir = { x: 0.6, z: 0.8 };
  movePlayer(pos, dir, 0.016);
  assert.deepEqual(pos, { x: 1, z: 1 });
  assert.deepEqual(dir, { x: 0.6, z: 0.8 });
});

test('dt 10 is capped, no teleport', () => {
  const p = movePlayer({ x: 0, z: 2.5 }, { x: 1, z: 0 }, 10);
  assert.ok(Math.abs(p.x) <= 2.2 * 0.05 + 1e-9);
});

test('props block the player and let them slide around', () => {
  const tray = PROPS.tray;
  let p = { x: tray.x, z: tray.z + 1.2 };
  for (let i = 0; i < 200; i++) p = movePlayer(p, { x: 0, z: -1 }, 0.016);
  assert.ok(Math.hypot(p.x - tray.x, p.z - tray.z) >= tray.radius + PLAYER_RADIUS - 1e-9);
  assert.ok(p.z > tray.z);
  let q = { x: tray.x, z: tray.z + 1.2 };
  for (let i = 0; i < 400; i++) q = movePlayer(q, { x: 0.4, z: -1 }, 0.016);
  assert.ok(q.z < tray.z - 0.5);
});

test('props sit inside the room and clear of the chair', () => {
  for (const prop of Object.values(PROPS)) {
    assert.ok(Math.abs(prop.x) + prop.radius <= ROOM.halfX + 1e-9);
    assert.ok(Math.abs(prop.z) + prop.radius <= ROOM.halfZ + 1e-9);
    assert.ok(distanceToChair(prop.x, prop.z) > prop.radius + PLAYER_RADIUS * 2);
  }
});
