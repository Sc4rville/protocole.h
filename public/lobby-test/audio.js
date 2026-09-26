// Procedural room tone: no audio files, everything is synthesised so the cell
// can breathe before any asset arrives.
export function createAudio() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return null;

  let ctx = null;
  let master = null;
  let ventGain = null;
  let humGain = null;
  let muted = false;

  function noiseBuffer(seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    const vent = ctx.createBufferSource();
    vent.buffer = noiseBuffer(4);
    vent.loop = true;
    const ventFilter = ctx.createBiquadFilter();
    ventFilter.type = 'lowpass';
    ventFilter.frequency.value = 420;
    ventGain = ctx.createGain();
    ventGain.gain.value = 0.04;
    vent.connect(ventFilter).connect(ventGain).connect(master);
    vent.start();

    humGain = ctx.createGain();
    humGain.gain.value = 0;
    humGain.connect(master);
    for (const [freq, gain] of [[100, 0.05], [201, 0.025], [303, 0.012]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(humGain);
      osc.start();
    }
  }

  function setLevels(levels) {
    if (!ctx) return;
    const now = ctx.currentTime;
    ventGain.gain.setTargetAtTime(0.025 + levels.fan * 0.07, now, 0.6);
    humGain.gain.setTargetAtTime(levels.lamp * 0.5, now, 0.5);
  }

  function burst({ duration, frequency, q, gain, sweep }) {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(duration + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(sweep, now + duration);
    src.connect(filter).connect(g).connect(master);
    src.start();
    src.stop(now + duration + 0.05);
  }

  function thump(frequency, duration, gain) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.45, now + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(now + duration + 0.05);
  }

  const CUES = {
    lamp_warmup: () => burst({ duration: 0.35, frequency: 1800, q: 1.2, gain: 0.05, sweep: 700 }),
    restraint_servo: () => {
      burst({ duration: 0.45, frequency: 620, q: 6, gain: 0.12, sweep: 900 });
      thump(140, 0.12, 0.12);
    },
    diagnostic_start: () => burst({ duration: 0.12, frequency: 2600, q: 9, gain: 0.06 }),
    vent_shift: () => burst({ duration: 0.8, frequency: 300, q: 0.8, gain: 0.05, sweep: 480 }),
    glass_thud: () => {
      thump(62, 0.55, 0.32);
      burst({ duration: 0.3, frequency: 180, q: 1.5, gain: 0.1 });
    },
    presence: () => thump(48, 1.1, 0.22),
    wake: () => burst({ duration: 0.2, frequency: 900, q: 3, gain: 0.04 }),
    spark: () => {
      burst({ duration: 0.08, frequency: 5200, q: 2.5, gain: 0.09, sweep: 2400 });
      burst({ duration: 0.22, frequency: 3100, q: 1.2, gain: 0.03 });
    },
    lamp_stutter: () => burst({ duration: 0.06, frequency: 1500, q: 4, gain: 0.025 }),
  };

  return {
    start,
    setLevels,
    cue(name) {
      const fn = CUES[name];
      if (fn && ctx) fn();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.1);
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
