// Sound layer for the intro: bank samples (public/audio, CC0) + synthesized tension.
// Everything routes through `master` so the whole layer can be cut or faded at once.

const BANK = '../audio/';

export const SAMPLES = {
  generator: 'ambience/room_generator_01',
  hum: 'ambience/room_electrical_hum_01',
  ventilation: 'ambience/room_ventilation_01',
  relay1: 'mechanics/restraint_click_01',
  relay2: 'mechanics/restraint_click_02',
  mechanism: 'mechanics/restraint_mechanism_01',
  impact: 'mechanics/metal_impact_01',
  powerup: 'electricity/room_powerup_01',
  arc: 'electricity/probe_arc_snap_01',
  glitch: 'ui/robot_glitch_01',
  ui_confirm: 'ui/ui_confirm_01',
  ui_select: 'ui/ui_select_01',
  ui_click: 'ui/ui_click_01',
  rattle: 'mechanics/robot_rattle_01',
  crackle: 'electricity/probe_crackle_01',
  arc_long: 'electricity/probe_arc_continuous_01',
  servo: 'robot/robot_servo_01',
  seal: 'fluids/seal_release_01',
};

function pickExt() {
  const a = document.createElement('audio');
  if (a.canPlayType('audio/ogg; codecs=vorbis')) return 'ogg';
  return 'mp3';
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.master = null;
    this.drone = null;
    this.loops = new Map();
  }

  get now() { return this.ctx.currentTime; }

  async init(onProgress) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);

    const ext = pickExt();
    const names = Object.keys(SAMPLES);
    let done = 0;
    await Promise.all(names.map(async (name) => {
      try {
        const res = await fetch(`${BANK}${SAMPLES[name]}.${ext}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(name, buf);
      } catch (err) {
        console.warn('[sfx] missing sample', name, err);
      }
      done += 1;
      onProgress?.(done, names.length);
    }));
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  /** One-shot sample. */
  play(name, { gain = 1, rate = 1, lowpass = null, at = 0, detune = 0 } = {}) {
    const buf = this.buffers.get(name);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let tail = src;
    if (lowpass) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      tail = src.connect(lp);
    }
    tail.connect(g).connect(this.master);
    src.start(this.now + at);
    return src;
  }

  /** Looping bed with its own gain, addressable by id. */
  loop(id, name, { gain = 0, rate = 1, lowpass = null } = {}) {
    this.stopLoop(id, 0);
    const buf = this.buffers.get(name);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let tail = src;
    let filter = null;
    if (lowpass) {
      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      tail = src.connect(filter);
    }
    tail.connect(g).connect(this.master);
    src.start();
    this.loops.set(id, { src, gain: g, filter });
    return g;
  }

  fadeLoop(id, level, seconds) {
    const l = this.loops.get(id);
    if (!l) return;
    ramp(l.gain.gain, level, this.now, seconds);
  }

  filterLoop(id, hz, seconds) {
    const l = this.loops.get(id);
    if (!l?.filter) return;
    ramp(l.filter.frequency, hz, this.now, seconds);
  }

  stopLoop(id, seconds = 0.5) {
    const l = this.loops.get(id);
    if (!l) return;
    this.loops.delete(id);
    ramp(l.gain.gain, 0.0001, this.now, seconds);
    try { l.src.stop(this.now + seconds + 0.05); } catch { /* already stopped */ }
  }

  /** Synthesized sub drone + brown noise; level 0..1. */
  startDrone() {
    if (this.drone) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.master);

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 38;
    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 57.2;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1.8;
    lfo.connect(lfoGain).connect(oscB.frequency);
    oscA.connect(oscGain);
    oscB.connect(oscGain);
    oscGain.connect(out);

    const noise = ctx.createBufferSource();
    noise.buffer = brownNoise(ctx, 4);
    noise.loop = true;
    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 180;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(noiseLp).connect(noiseGain).connect(out);

    const riser = ctx.createBiquadFilter();
    riser.type = 'bandpass';
    riser.Q.value = 6;
    riser.frequency.value = 400;
    const riserGain = ctx.createGain();
    riserGain.gain.value = 0.0001;
    noise.connect(riser).connect(riserGain).connect(out);

    oscA.start(); oscB.start(); lfo.start(); noise.start();
    this.drone = { out, noiseLp, riser, riserGain, nodes: [oscA, oscB, lfo, noise] };
  }

  droneLevel(level, seconds) {
    if (!this.drone) return;
    ramp(this.drone.out.gain, Math.max(level, 0.0001), this.now, seconds);
  }

  /** Random scatter of one sample over `spread` seconds: distant knocks, creaks. */
  sprinkle(name, count, spread, { gain = [0.1, 0.3], rate = [0.5, 1], lowpass = 700, at = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      this.play(name, {
        gain: lerp(gain, Math.random()),
        rate: lerp(rate, Math.random()),
        lowpass,
        at: at + Math.random() * spread,
      });
    }
  }

  /** Synthesized sub pulse (a slow heartbeat) that can accelerate over its span. */
  pulse({ seconds, fromInterval = 1.2, toInterval = 0.6, gain = 0.5, freq = 48, at = 0 } = {}) {
    const ctx = this.ctx;
    let t = this.now + at;
    const end = t + seconds;
    const total = seconds;
    while (t < end) {
      const p = 1 - (end - t) / total;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 1.4, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * (0.6 + 0.4 * p), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.4);
      t += fromInterval + (toInterval - fromInterval) * p;
    }
  }

  /** Bandpass sweep of the noise bed: the "something is coming" riser. */
  riser(seconds, { from = 300, to = 2400, gain = 0.5 } = {}) {
    if (!this.drone) return;
    const t = this.now;
    this.drone.riser.frequency.cancelScheduledValues(t);
    this.drone.riser.frequency.setValueAtTime(from, t);
    this.drone.riser.frequency.exponentialRampToValueAtTime(to, t + seconds);
    ramp(this.drone.riserGain.gain, gain, t, seconds);
  }

  riserOff(seconds = 0.05) {
    if (!this.drone) return;
    ramp(this.drone.riserGain.gain, 0.0001, this.now, seconds);
  }

  /** Hard cut of everything (the silence must be total). */
  cutAll(seconds = 0.03) {
    ramp(this.master.gain, 0.0001, this.now, seconds);
    for (const id of [...this.loops.keys()]) this.stopLoop(id, seconds);
    this.riserOff(seconds);
  }

  /** Bring the master back (after a cut) to reuse the same layer. */
  restoreMaster(seconds = 0.5) {
    ramp(this.master.gain, 1, this.now, seconds);
  }

  fadeMaster(level, seconds) {
    ramp(this.master.gain, Math.max(level, 0.0001), this.now, seconds);
  }
}

function lerp([a, b], x) { return a + (b - a) * x; }

function ramp(param, value, t, seconds) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(Math.max(param.value, 0.0001), t);
  if (seconds <= 0) param.setValueAtTime(value, t);
  else param.exponentialRampToValueAtTime(Math.max(value, 0.0001), t + seconds);
}

function brownNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

/** Theme song: optional file dropped by the team; resolves null if absent. */
export async function loadTheme(ctx) {
  const ext = pickExt();
  const urls = ext === 'ogg' ? ['theme/theme-song.ogg', 'theme/theme-song.mp3'] : ['theme/theme-song.mp3'];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const type = res.headers.get('content-type') || '';
      if (type.includes('text/html')) continue; // SPA fallback page, not audio
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch { /* try next */ }
  }
  return null;
}
