import assert from 'node:assert/strict';
import test from 'node:test';
import { createInteractionAudio } from '../public/lobby-test/interaction-audio.js';

const paths = [
  'mechanics/tool_pickup_01.ogg',
  'mechanics/tool_putdown_01.ogg',
  'mechanics/restraint_click_01.ogg',
  'mechanics/restraint_click_02.ogg',
  'mechanics/restraint_mechanism_01.ogg',
  'mechanics/restraint_mechanism_02.ogg',
  'mechanics/metal_impact_01.ogg',
  'electricity/probe_charge_01.ogg',
  'electricity/probe_connect_01.ogg',
  'electricity/probe_disconnect_01.ogg',
  'electricity/probe_arc_snap_01.ogg',
  'ui/ui_confirm_01.ogg',
  'ui/ui_warning_01.ogg',
  'metal/metal_strain_01.ogg',
  'impacts/metal_impact_low_01.ogg',
];
const base = new URL('../public/audio/', import.meta.url);

function fixture(t, options = {}) {
  const contexts = [];
  const requests = [];
  const originals = Object.fromEntries(
    ['AudioContext', 'webkitAudioContext', 'fetch'].map(key => [
      key, Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  function param(value = 1) {
    return {
      value,
      automation: [],
      setValueAtTime(value, time) { this.automation.push(['set', value, time]); },
      linearRampToValueAtTime(value, time) { this.automation.push(['ramp', value, time]); },
    };
  }
  function node() {
    return {
      connections: [],
      disconnected: false,
      connect(target) { this.connections.push(target); return target; },
      disconnect() { this.disconnected = true; },
    };
  }
  class Context {
    constructor() {
      if (options.constructorFailure) throw new Error('unavailable');
      this.currentTime = 10;
      this.destination = {};
      this.sources = [];
      this.gains = [];
      this.decodes = [];
      this.resumes = 0;
      this.closes = 0;
      contexts.push(this);
    }
    async resume() {
      this.resumes++;
      if (options.resumeFailure) throw new Error('locked');
    }
    async close() {
      this.closes++;
      if (options.closeFailure) throw new Error('close failed');
    }
    createGain() {
      const gain = { ...node(), gain: param() };
      this.gains.push(gain);
      return gain;
    }
    createBufferSource() {
      const source = {
        ...node(),
        playbackRate: param(),
        starts: [],
        stops: [],
        start(time) { this.starts.push(time); },
        stop(time) { this.stops.push(time); },
        end() { this.onended?.(); },
      };
      this.sources.push(source);
      return source;
    }
    async decodeAudioData(data) {
      const label = new TextDecoder().decode(data);
      this.decodes.push(label);
      if (options.decodeFailure || (options.oggFailure && label.endsWith('.ogg'))) {
        throw new Error('unsupported codec');
      }
      return { label, duration: options.duration ?? 3 };
    }
  }
  globalThis.AudioContext = options.unsupported || options.webkit ? undefined : Context;
  globalThis.webkitAudioContext = options.webkit ? Context : undefined;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), signal: init.signal });
    if (options.fetchGate) await options.fetchGate;
    if (options.fetchFailure) throw new Error('offline');
    return {
      ok: !options.httpFailure,
      arrayBuffer: async () => new TextEncoder().encode(String(url)).buffer,
    };
  };
  t.after(() => {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const audio = createInteractionAudio();
  t.after(() => audio.dispose());
  return { audio, contexts, requests, get ctx() { return contexts[0]; } };
}

test('does not create a context, fetch, or play until start; pre-start cues are dropped', async t => {
  const f = fixture(t);
  f.audio.cue('probe.selected');
  f.audio.update({ active: true, charging: true, charge: 0.5 });
  assert.equal(f.contexts.length, 0);
  assert.equal(f.requests.length, 0);
  assert.equal(await f.audio.start(), true);
  assert.equal(f.ctx.sources.length, 0);
});

test('unsupported AudioContext is a safe no-op', async t => {
  const f = fixture(t, { unsupported: true });
  assert.equal(await f.audio.start(), false);
  f.audio.update({ active: true, charging: true, charge: 1 });
  f.audio.cue('probe.selected');
  f.audio.setMuted(true);
  f.audio.dispose();
  assert.equal(f.contexts.length, 0);
  assert.equal(f.requests.length, 0);
});

test('repeated starts preload once and use only the 15 fixed local URLs', async t => {
  const f = fixture(t, { webkit: true });
  const first = f.audio.start();
  assert.equal(f.audio.start(), first);
  assert.equal(await first, true);
  assert.equal(await f.audio.start(), true);
  assert.equal(f.contexts.length, 1);
  assert.equal(f.ctx.resumes, 1);
  assert.deepEqual(f.requests.map(r => r.url).sort(), paths.map(p => new URL(p, base).href).sort());
  f.audio.cue('https://invalid.example/evil.ogg');
  f.audio.cue('__proto__');
  f.audio.cue('toString');
  f.audio.cue('probe.charging');
  assert.equal(f.ctx.sources.length, 0);
  assert.equal(f.requests.length, 15);
});

for (const failure of ['constructorFailure', 'resumeFailure', 'fetchFailure', 'httpFailure', 'decodeFailure']) {
  test(`${failure} is caught and start resolves false`, async t => {
    const f = fixture(t, { [failure]: true });
    assert.equal(await f.audio.start(), false);
    f.audio.cue('probe.selected');
    f.audio.update({ active: true, charging: true, charge: 1 });
    assert.equal(f.ctx?.sources.length ?? 0, 0);
    if (failure === 'resumeFailure') assert.equal(f.requests.length, 0);
  });
}

test('OGG decode failures request precisely the matching MP3 fallbacks', async t => {
  const f = fixture(t, { oggFailure: true });
  assert.equal(await f.audio.start(), true);
  const expected = paths.flatMap(p => [p, p.replace('.ogg', '.mp3')]);
  assert.deepEqual(f.requests.map(r => r.url).sort(), expected.map(p => new URL(p, base).href).sort());
  assert.equal(f.ctx.decodes.length, 30);
  f.audio.cue('probe.connected');
  assert.equal(f.ctx.sources[0].buffer.label, new URL('electricity/probe_connect_01.mp3', base).href);
});

test('events and charging updates during loading never replay when buffers arrive', async t => {
  let release;
  const fetchGate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { fetchGate });
  const started = f.audio.start();
  await Promise.resolve();
  f.audio.cue('overload_caused');
  f.audio.update({ active: true, charging: true, charge: 0.8 });
  assert.equal(f.ctx.sources.length, 0);
  release();
  assert.equal(await started, true);
  assert.equal(f.ctx.sources.length, 0);
  f.audio.update({ active: true, charging: true, charge: 0.8 });
  assert.equal(f.ctx.sources.length, 1);
});

test('charging maintains one loop across frames and clamps playback rate', async t => {
  const f = fixture(t);
  await f.audio.start();
  for (let i = 0; i < 100; i++) f.audio.update({ active: true, charging: true, charge: 0.5 });
  assert.equal(f.ctx.sources.length, 1);
  const source = f.ctx.sources[0];
  assert.equal(source.loop, true);
  assert.equal(source.buffer.label, new URL('electricity/probe_charge_01.ogg', base).href);
  assert.equal(source.playbackRate.value, 1.075);
  assert.equal(source.connections[0].gain.value, 0.13);
  for (const [charge, rate] of [[-2, 0.85], [4, 1.3], [NaN, 0.85], [Infinity, 1.3]]) {
    f.audio.update({ active: true, charging: true, charge });
    assert.equal(source.playbackRate.value, rate);
  }
  f.audio.update({ active: true, charging: false, charge: 0 });
  assert.deepEqual(source.stops, [undefined]);
  assert.equal(source.disconnected, true);
  f.audio.update({ active: true, charging: true, charge: 0 });
  assert.equal(f.ctx.sources.length, 2);
});

test('inactive immediately stops all sources and unpausing does not resurrect shots', async t => {
  const f = fixture(t);
  await f.audio.start();
  f.audio.update({ active: true, charging: true, charge: 0.5 });
  f.audio.cue('cable_torn');
  assert.equal(f.ctx.sources.length, 3);
  f.audio.update({ active: false, charging: true, charge: 0.5 });
  for (const source of f.ctx.sources) {
    assert.equal(source.stops.at(-1), undefined);
    assert.equal(source.disconnected, true);
    assert.equal(source.connections[0].disconnected, true);
  }
  f.audio.cue('probe.selected');
  f.audio.update({ active: true, charging: false, charge: 0 });
  f.audio.setMuted(true);
  f.audio.setMuted(false);
  assert.equal(f.ctx.sources.length, 3);
  f.audio.update({ active: true, charging: true, charge: 0 });
  assert.equal(f.ctx.sources.length, 4);
  assert.equal(f.ctx.sources[3].loop, true);
});

test('mute only changes master gain and works before start', async t => {
  const f = fixture(t);
  f.audio.setMuted(true);
  await f.audio.start();
  assert.equal(f.ctx.gains[0].gain.value, 0);
  f.audio.cue('probe.selected');
  const source = f.ctx.sources[0];
  assert.equal(source.connections[0].gain.value, 0.4);
  assert.equal(source.connections[0].connections[0], f.ctx.gains[0]);
  f.audio.setMuted(false);
  assert.equal(f.ctx.gains[0].gain.value, 0.25);
  f.audio.setMuted(true);
  assert.equal(f.ctx.gains[0].gain.value, 0);
  assert.equal(source.disconnected, false);
  source.end();
  f.audio.setMuted(false);
  assert.equal(f.ctx.sources.length, 1);
});

test('every cue maps to the exact local buffers, including layered damage', async t => {
  const f = fixture(t);
  await f.audio.start();
  const events = [
    ['probe.selected', [0]], ['pliers.selected', [0]], ['tools.put_down', [1]],
    ['probe.connected', [8]], ['probe.disconnected_early', [9]],
    ['probe.disconnected_before_damage', [9]], ['probe.disconnected_after_damage', [9]],
    ['charge_restored', [9]], ['probe.safe_charge_reached', [11]],
    ['probe.overload_warning', [12]], ['cable.damage_warning', [12]],
    ['restraint.damage_warning', [12]], ['overload_caused', [10]],
    ['probe.harm_repeated', [10]], ['debris.gripped', [2]],
    ['debris.extraction_started', [13]], ['debris_removed', [3]],
    ['cable_torn', [10, 6]], ['restraint.tightening', [4]],
    ['restraint.loosening', [5]], ['restraint_released', [3]],
    ['restraint_damaged', [14]], ['review.ending', [11]],
  ];
  for (const [event, indices] of events) {
    const offset = f.ctx.sources.length;
    f.audio.cue(event);
    const sources = f.ctx.sources.slice(offset);
    assert.deepEqual(sources.map(s => s.buffer.label), indices.map(i => new URL(paths[i], base).href), event);
    if (sources.length === 2) assert.equal(sources[0].starts[0], sources[1].starts[0]);
    for (const source of sources) source.end();
  }
});

for (const duration of [3, 0.3, 0.01]) {
  test(`one-shots cap duration and fade for buffer duration ${duration}`, async t => {
    const f = fixture(t, { duration });
    await f.audio.start();
    f.audio.cue('probe.selected');
    const source = f.ctx.sources[0];
    const length = Math.min(duration, 1.2);
    assert.deepEqual(source.starts, [10]);
    assert.deepEqual(source.stops, [10 + length]);
    assert.deepEqual(source.connections[0].gain.automation, [
      ['set', 0.4, 10 + Math.max(0, length - 0.02)],
      ['ramp', 0, 10 + length],
    ]);
    source.end();
    assert.equal(source.disconnected, true);
    assert.equal(source.connections[0].disconnected, true);
    assert.equal(source.onended, null);
  });
}

test('caps one-shots at eight, stopping oldest without stopping charge loop', async t => {
  const f = fixture(t);
  await f.audio.start();
  f.audio.update({ active: true, charging: true, charge: 0 });
  for (let i = 0; i < 8; i++) f.audio.cue('probe.selected');
  assert.equal(f.ctx.sources.filter(s => !s.disconnected).length, 9);
  const oldest = f.ctx.sources[1];
  f.audio.cue('cable_torn');
  assert.equal(oldest.disconnected, true);
  assert.equal(oldest.stops.at(-1), undefined);
  assert.equal(f.ctx.sources[2].disconnected, true);
  assert.equal(f.ctx.sources[0].disconnected, false);
  assert.equal(f.ctx.sources.filter(s => !s.disconnected).length, 9);
  f.ctx.sources[3].end();
  const nextOldest = f.ctx.sources[4];
  f.audio.cue('probe.selected');
  assert.equal(nextOldest.disconnected, false);
  assert.equal(f.ctx.sources.filter(s => !s.disconnected).length, 9);
});

test('dispose is idempotent, stops everything, closes context, and prevents future play', async t => {
  const f = fixture(t, { closeFailure: true });
  await f.audio.start();
  f.audio.update({ active: true, charging: true, charge: 1 });
  f.audio.cue('probe.selected');
  f.audio.dispose();
  f.audio.dispose();
  assert.equal(f.ctx.closes, 1);
  assert.equal(f.ctx.gains[0].disconnected, true);
  assert.ok(f.ctx.sources.every(s => s.disconnected && s.stops.at(-1) === undefined));
  assert.ok(f.requests.every(r => r.signal.aborted));
  assert.equal(await f.audio.start(), false);
  f.audio.update({ active: true, charging: true, charge: 1 });
  f.audio.cue('cable_torn');
  f.audio.setMuted(false);
  assert.equal(f.contexts.length, 1);
  assert.equal(f.ctx.sources.length, 2);
});

test('dispose during preload aborts requests without fallback or late playback', async t => {
  let release;
  const fetchGate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { fetchGate, fetchFailure: true });
  const started = f.audio.start();
  await Promise.resolve();
  assert.equal(f.requests.length, 15);
  f.audio.dispose();
  assert.ok(f.requests.every(r => r.signal.aborted));
  release();
  assert.equal(await started, false);
  assert.equal(f.requests.length, 15);
  assert.equal(f.ctx.sources.length, 0);
  assert.equal(f.ctx.closes, 1);
});

test('dispose before start never creates a context', async t => {
  const f = fixture(t);
  f.audio.dispose();
  assert.equal(await f.audio.start(), false);
  assert.equal(f.contexts.length, 0);
  assert.equal(f.requests.length, 0);
});
