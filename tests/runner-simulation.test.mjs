import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LANES,
  RULES,
  STEP,
  createRun,
  getCourse,
  getSurface,
  restartRun,
  stepRun,
} from '../public/runner/simulation.js';

const IDLE = { left: false, right: false, jump: false, slide: false, heldJump: false };

function run(state, seconds, input = IDLE) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps && state.status !== 'won'; i++) {
    stepRun(state, input, STEP);
  }
}

function start(mode) {
  const s = createRun(mode);
  restartRun(s, false);
  return s;
}

function runUntil(state, distance, input = IDLE) {
  while (state.status === 'running' && state.distance < distance) {
    stepRun(state, input, STEP);
  }
}

describe('hell movement', () => {
  it('jump rises, lands, no auto-repeat while held', () => {
    const s = start('hell');
    stepRun(s, { ...IDLE, jump: true, heldJump: true }, STEP);
    assert.ok(s.vy > 0);
    run(s, 2, { ...IDLE, heldJump: true });
    assert.equal(s.y, 0);
    assert.equal(s.vy, 0);
    assert.equal(s.grounded, true);
    run(s, 0.5, { ...IDLE, heldJump: true });
    assert.equal(s.y, 0);
  });

  it('slide only works on ground, lane bounds clamp', () => {
    const s = start('hell');
    stepRun(s, { ...IDLE, jump: true }, STEP);
    stepRun(s, { ...IDLE, slide: true }, STEP);
    assert.equal(s.slideLeft, 0);
    run(s, 2);
    stepRun(s, { ...IDLE, slide: true }, STEP);
    assert.ok(s.slideLeft > 0);
    stepRun(s, { ...IDLE, left: true }, STEP);
    stepRun(s, { ...IDLE, left: true }, STEP);
    stepRun(s, { ...IDLE, left: true }, STEP);
    assert.equal(s.lane, 0);
    stepRun(s, { ...IDLE, right: true }, STEP);
    assert.equal(s.lane, 1);
  });

  it('barrier kills unless jumping', () => {
    const s = start('hell');
    runUntil(s, 71);
    assert.equal(s.status, 'dead');
    assert.equal(s.deaths, 1);

    const s2 = start('hell');
    runUntil(s2, 55);
    stepRun(s2, { ...IDLE, jump: true }, STEP);
    runUntil(s2, 140);
    assert.equal(s2.status, 'running');
  });

  it('overhead kills standing, slide survives', () => {
    const s = start('hell');
    runUntil(s, 55);
    stepRun(s, { ...IDLE, jump: true }, STEP);
    runUntil(s, 146);
    assert.equal(s.status, 'dead');

    const s2 = start('hell');
    runUntil(s2, 55);
    stepRun(s2, { ...IDLE, jump: true }, STEP);
    runUntil(s2, 133);
    stepRun(s2, { ...IDLE, slide: true }, STEP);
    runUntil(s2, 220);
    assert.equal(s2.status, 'running');
  });

  it('press safe vs lethal by elapsed phase', () => {
    const s = start('hell');
    s.distance = 555;
    s.elapsed = 0;
    runUntil(s, 561);
    assert.equal(s.status, 'running');

    const s2 = start('hell');
    s2.distance = 555;
    s2.elapsed = 2.6;
    runUntil(s2, 561);
    assert.equal(s2.status, 'dead');
  });

  it('block kills through max jump, lateral dodge survives', () => {
    const s = start('hell');
    stepRun(s, { ...IDLE, left: true }, STEP);
    runUntil(s, 205);
    stepRun(s, { ...IDLE, jump: true }, STEP);
    runUntil(s, 222);
    assert.equal(s.status, 'dead');

    const s2 = start('hell');
    runUntil(s2, 55);
    stepRun(s2, { ...IDLE, jump: true }, STEP);
    runUntil(s2, 133);
    stepRun(s2, { ...IDLE, slide: true }, STEP);
    runUntil(s2, 240);
    assert.equal(s2.status, 'running');
    assert.equal(s2.lane, 1);
  });

  it('restart clears every temporary flag', () => {
    const s = start('hell');
    stepRun(s, { ...IDLE, jump: true, heldJump: true }, STEP);
    stepRun(s, { ...IDLE, right: true }, STEP);
    s.slideLeft = 0.5;
    s.shield = true;
    s.gliding = true;
    s.lastBounce = 95;
    s.deadTimer = 0.3;
    restartRun(s, false);
    assert.equal(s.shield, false);
    assert.equal(s.gliding, false);
    assert.equal(s.slideLeft, 0);
    assert.equal(s.vy, 0);
    assert.equal(s.jumpBuffer, 0);
    assert.equal(s.lastBounce, 0);
    assert.equal(s.deadTimer, 0);
    assert.equal(s.grounded, true);
    assert.equal(s.lane, 1);
    assert.equal(s.x, LANES[1]);
    assert.equal(s.y, 0);
    assert.equal(s.heldJump, false);
    assert.equal(s.bounceFlash, 0);
  });

  it('checkpoint resume at 400, full replay resets all', () => {
    const s = start('hell');
    runUntil(s, 55);
    stepRun(s, { ...IDLE, jump: true }, STEP);
    runUntil(s, 133);
    stepRun(s, { ...IDLE, slide: true }, STEP);
    runUntil(s, 272);
    stepRun(s, { ...IDLE, jump: true }, STEP);
    runUntil(s, 330);
    stepRun(s, { ...IDLE, right: true }, STEP);
    runUntil(s, 401);
    assert.equal(s.checkpoint, 400);
    runUntil(s, 466);
    assert.equal(s.status, 'dead');
    restartRun(s, true);
    assert.equal(s.distance, 400);
    assert.equal(s.deaths, 1);
    assert.equal(s.status, 'running');
    restartRun(s, false);
    assert.equal(s.distance, 0);
    assert.equal(s.deaths, 0);
    assert.equal(s.checkpoint, 0);
  });
});

describe('heaven glide and gaps', () => {
  it('held jump glides, hell never glides', () => {
    const s = start('heaven');
    stepRun(s, { ...IDLE, jump: true, heldJump: true }, STEP);
    run(s, 0.6, { ...IDLE, heldJump: true });
    assert.equal(s.gliding, true);
    assert.ok(s.vy >= -1.8);
    const h = start('hell');
    stepRun(h, { ...IDLE, jump: true, heldJump: true }, STEP);
    run(h, 0.6, { ...IDLE, heldJump: true });
    assert.equal(h.gliding, false);
  });

  it('first pad at 95 bounces once and held glide crosses the gap', () => {
    const s = start('heaven');
    runUntil(s, 95, { ...IDLE, heldJump: true });
    assert.equal(s.vy, 21);
    assert.equal(s.lastBounce, 95);
    runUntil(s, 200, { ...IDLE, heldJump: true });
    assert.equal(s.status, 'running');
    assert.equal(s.grounded, true);
    assert.ok(s.distance > 155);
  });

  it('falling below an island edge never snaps up, recovers instead', () => {
    const s = start('heaven');
    restartRun(s, false);
    s.distance = 154.9;
    s.y = -1;
    s.vy = -3;
    s.grounded = false;
    stepRun(s, IDLE, STEP);
    assert.ok(s.y < 0);
    assert.equal(s.grounded, false);
    run(s, 2);
    assert.equal(s.status, 'running');
    assert.ok(s.distance >= 8 && s.distance < 40);
    assert.ok(s.checkpoint < 155);
  });

  it('below-floor body crossing a pad never bounces', () => {
    const s = start('heaven');
    s.distance = 239.9;
    s.y = -1;
    s.vy = -2;
    s.grounded = false;
    stepRun(s, { ...IDLE, heldJump: true }, STEP);
    assert.ok(s.y < 0);
    assert.ok(s.vy < 0);
    assert.equal(s.lastBounce, 0);
    assert.equal(s.energy, 0);
  });

  it('crossing 720 below the floor does not win, falls and recovers', () => {
    const s = start('heaven');
    s.distance = 719.9;
    s.y = -1;
    s.vy = -2;
    s.grounded = false;
    stepRun(s, { ...IDLE, heldJump: true }, STEP);
    assert.notEqual(s.status, 'won');
    run(s, 3);
    assert.equal(s.status, 'running');
    assert.ok(s.distance < 719.9);
  });

  it('first three orbs collected by held glide in center lane', () => {
    const s = start('heaven');
    runUntil(s, 150, { ...IDLE, heldJump: true });
    for (const id of ['e0', 'e1', 'e2']) {
      assert.ok(s.consumed.has(id), `missing ${id}`);
    }
  });

  it('idle falls into gap and auto-recovers at island start', () => {
    const s = start('heaven');
    runUntil(s, 200);
    assert.equal(s.status, 'dead');
    run(s, 1);
    assert.equal(s.status, 'running');
    assert.ok(s.distance >= 8 && s.distance < 40);
    assert.equal(s.deaths, 0);
  });

  it('full heaven run with held jump reaches 720 and wins', () => {
    const s = start('heaven');
    runUntil(s, RULES.heaven.length + 1, { ...IDLE, heldJump: true });
    assert.equal(s.status, 'won');
    assert.ok(s.energy > 0);
  });

  it('energy checkpoint restore prevents farming', () => {
    const s = start('heaven');
    runUntil(s, 150, { ...IDLE, heldJump: true });
    const gained = s.energy;
    assert.ok(gained > 0);
    runUntil(s, 260, { ...IDLE, heldJump: true });
    const cp = s.checkpoint;
    assert.equal(cp, 163);
    const saved = s.energy;
    s.distance = 300;
    s.grounded = false;
    s.y = -11;
    s.vy = -5;
    stepRun(s, IDLE, STEP);
    assert.equal(s.status, 'dead');
    run(s, 1);
    assert.ok(s.distance >= cp && s.distance < cp + 40);
    assert.equal(s.energy, s.savedCheckpoint.energy);
    assert.ok(!s.consumed.has('pad:240'));
  });
});

describe('surfaces', () => {
  it('hell floor continuous, heaven has gaps', () => {
    assert.equal(getSurface('hell', 400, 1), 0);
    assert.equal(getSurface('heaven', 50, 1), 0);
    assert.equal(getSurface('heaven', 130, 1), null);
    assert.equal(getCourse('hell').length, 920);
    assert.equal(getCourse('heaven').length, 720);
  });
});
