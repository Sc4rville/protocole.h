import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequence, CUES, WAKE_DISTANCE, SLEEP_DISTANCE }
  from '../public/lobby-test/sequence.js';
import { clampToRoom, distanceToChair, ROOM } from '../public/lobby-test/movement.js';

test('the player can physically walk far enough to rearm the room', () => {
  let reachable = 0;
  for (let a = 0; a < 64; a++) {
    const angle = (a / 64) * Math.PI * 2;
    const far = clampToRoom(Math.cos(angle) * ROOM.halfZ * 2, Math.sin(angle) * ROOM.halfZ * 2);
    reachable = Math.max(reachable, distanceToChair(far.x, far.z));
  }
  assert.ok(reachable > SLEEP_DISTANCE, `reachable ${reachable} <= sleep ${SLEEP_DISTANCE}`);
  assert.ok(SLEEP_DISTANCE > WAKE_DISTANCE);
});

function run(seq, seconds, distance, step = 1 / 60) {
  const events = [];
  for (let t = 0; t < seconds; t += step) {
    events.push(...seq.update(step, { distance }).events);
  }
  return events;
}

test('the room stays at rest while the player keeps away', () => {
  const seq = createSequence();
  const events = run(seq, 8, 3.2);
  assert.equal(seq.state, 'repos');
  assert.deepEqual(events, []);
  assert.ok(seq.levels.lamp < 0.1);
});

test('walking into the treatment zone wakes the room', () => {
  const seq = createSequence();
  const events = run(seq, 0.2, WAKE_DISTANCE - 0.1);
  assert.equal(events[0], 'wake');
  assert.equal(seq.state, 'eveil');
});

test('the wake-up fires every cue once, in order', () => {
  const seq = createSequence();
  const events = run(seq, 6, 0.5).filter((e) => e !== 'wake');
  assert.deepEqual(events, CUES.map((c) => c.name));
  assert.equal(seq.state, 'intervention');
});

test('intervention lights the chair and leaves the periphery readable', () => {
  const seq = createSequence();
  run(seq, 8, 0.5);
  assert.ok(seq.levels.lamp > 0.9);
  assert.ok(seq.levels.cove > 0.3);
  assert.ok(seq.levels.restraint > 0.9);
});

test('judgement kills the periphery, keeps the chair lit and reveals the glass', () => {
  const seq = createSequence();
  run(seq, 8, 0.5);
  seq.setState('jugement');
  const events = run(seq, 10, 0.5);
  assert.ok(events.includes('presence'));
  assert.ok(seq.levels.cove < 0.08, `cove ${seq.levels.cove}`);
  assert.ok(seq.levels.ambient < 0.08);
  assert.ok(seq.levels.lamp > 0.7);
  assert.ok(seq.levels.window > 0.6);
});

test('the wake-up does not retrigger until the player has left the zone', () => {
  const seq = createSequence();
  run(seq, 8, 0.5);
  seq.setState('repos');
  assert.deepEqual(run(seq, 4, 0.5), []);
  run(seq, 2, SLEEP_DISTANCE + 0.3);
  assert.deepEqual(run(seq, 1, 0.5).slice(0, 1), ['wake']);
});

test('levels never jump instantly between states', () => {
  const seq = createSequence();
  seq.setState('intervention');
  seq.update(1 / 60, { distance: 3 });
  assert.ok(seq.levels.lamp < 0.2);
});

test('a huge dt is clamped instead of skipping the timeline', () => {
  const seq = createSequence();
  const events = seq.update(30, { distance: 0.5 }).events;
  assert.deepEqual(events, ['wake', 'lamp_warmup']);
  assert.equal(seq.state, 'eveil');
});
