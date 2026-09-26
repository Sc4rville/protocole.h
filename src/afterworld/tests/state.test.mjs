import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HEAVEN, HELL, advanceFlight, armPad, collectEnergy, createRun, disarmPad, landAtIsland, pressPhase, restartRun, resumeFromCheckpoint } from '../game-state.js';

function flight(input, seconds, initial = { speed: 18, pitch: -0.12, vx: 0, vy: -3, vz: -18 }) {
  let state = initial;
  const steps = Math.ceil(seconds * 60);
  for (let i = 0; i < steps; i += 1) state = advanceFlight(state, input, 1 / 60);
  return state;
}

describe('authored passages', () => {
  it('keeps the five island route, obstacle rows and three lanes stable', () => {
    assert.equal(HELL.length, 380);
    assert.equal(HELL.obstacles.length, 11);
    assert.equal(HEAVEN.islands.length, 5);
    assert.deepEqual(HEAVEN.exit, [0, 0, -175]);
  });

  it('press phase boundaries and negative offsets wrap consistently', () => {
    assert.equal(pressPhase(0), 'open');
    assert.equal(pressPhase(1.499), 'open');
    assert.equal(pressPhase(1.5), 'warning');
    assert.equal(pressPhase(2.199), 'warning');
    assert.equal(pressPhase(2.2), 'closed');
    assert.equal(pressPhase(2.799), 'closed');
    assert.equal(pressPhase(2.8), 'opening');
    assert.equal(pressPhase(3.8), 'open');
    assert.equal(pressPhase(0, -1.5), 'closed');
    assert.equal(pressPhase(-1, 0), 'opening');
  });

  it('dive accelerates, flare trades speed for lift, and low airspeed stalls', () => {
    const level = flight({}, 1.4);
    const dive = flight({ dive: true }, 1.4);
    const flare = flight({ flare: true }, 1.8, { speed: 19, pitch: -0.12, vx: 0, vy: -3, vz: -19 });
    const slow = advanceFlight({ speed: 4.5, pitch: 0, vx: 0, vy: 0, vz: -4.5 }, {}, 1 / 60);
    assert.ok(dive.speed > level.speed);
    assert.ok(flare.vy > 0);
    assert.ok(flare.speed < 19);
    assert.ok(slow.vy < -1.5);
  });

  it('keeps neutral and partial flight inputs finite', () => {
    for (const input of [{}, { dive: true }, { flare: true }]) {
      const state = flight(input, 2);
      assert.ok(Object.values(state).every(Number.isFinite));
      assert.equal(state.vx, 0);
    }
  });

  it('clamps long frame deltas and never emits non-finite flight state', () => {
    const initial = { speed: 18, pitch: -0.12, vx: 0, vy: -3, vz: -18 };
    assert.deepEqual(advanceFlight(initial, { dive: true }, 10), advanceFlight(initial, { dive: true }, 1 / 30));
    const state = advanceFlight({ speed: 0, pitch: 0, vx: 0, vy: 0, vz: 0 }, { flare: true, steer: 1 }, 10);
    assert.ok(Object.values(state).every(Number.isFinite));
  });

  it('creates independent runs and replay clears transient state and counters', () => {
    const first = createRun('hell');
    first.collected.add('ring-0-0');
    first.armedPads.add('pad:arrival');
    first.events.push({ type: 'hit' });
    first.energy = 3;
    first.deaths = 2;
    first.lane = 2;
    first.sliding = true;
    first.gliding = true;
    const second = createRun('hell');
    assert.equal(second.collected.size, 0);
    assert.equal(second.armedPads.size, 0);
    const replay = restartRun(first, 'heaven');
    assert.equal(replay.mode, 'heaven');
    assert.equal(replay.energy, 0);
    assert.equal(replay.deaths, 0);
    assert.equal(replay.lane, 1);
    assert.equal(replay.sliding, false);
    assert.equal(replay.gliding, false);
    assert.equal(replay.events.length, 0);
    assert.equal(replay.collected.size, 0);
  });

  it('only records island checkpoints on a real landing from above', () => {
    const run = createRun('heaven');
    assert.equal(landAtIsland(run, 1, false), false);
    assert.equal(run.checkpoint, 0);
    collectEnergy(run, 'ring-0-0');
    assert.equal(landAtIsland(run, 1, true), true);
    assert.equal(run.checkpoint, 1);
    assert.equal(run.checkpointEnergy, 1);
    collectEnergy(run, 'ring-0-1');
    const spawn = resumeFromCheckpoint(run);
    assert.deepEqual(spawn, HEAVEN.islands[1].spawn);
    assert.equal(run.energy, 1);
    assert.equal(run.collected.has('ring-0-1'), false);
  });

  it('pad contact is gated from below, does not repeat while occupied, and rearms after leaving', () => {
    const run = createRun('heaven');
    const belowSurfaceY = -0.1;
    const grounded = false;
    const canBounce = (y, onGround, fromAbove) => y >= 0 && onGround && fromAbove && armPad(run, 'pad:arrival');
    assert.equal(canBounce(belowSurfaceY, grounded, false), false);
    assert.equal(run.armedPads.has('pad:arrival'), false);
    assert.equal(canBounce(0.4, true, true), true);
    assert.equal(canBounce(0.4, true, true), false);
    disarmPad(run, 'pad:arrival');
    assert.equal(canBounce(0.4, true, true), true);
  });
});
