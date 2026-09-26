const AUDIO_IDS = [
  'step-metal-a', 'step-metal-b', 'step-stone-a', 'step-stone-b', 'jump', 'land-soft', 'land-hard',
  'lane-whoosh', 'slide', 'air-dive', 'glider-open', 'rebound', 'perfect-rebound', 'collect', 'checkpoint',
  'press-warning', 'press-impact', 'hit', 'recover', 'finish', 'ui-confirm', 'hell-room', 'heaven-air', 'flight-air',
];

export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.analyser = null;
    this.buffers = new Map();
    this.manifest = new Map();
    this.loops = new Map();
    this.lastPlay = new Map();
    this.activeByFamily = new Map();
    this.muted = false;
    this.paused = false;
    this.state = 'locked';
    this.ready = Promise.resolve(false);
    this.unavailable = false;
    this.peakBuffer = null;
  }

  async unlock() {
    if (this.unavailable) return false;
    if (!this.context) {
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        this.context = new Context();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 18;
        this.compressor.ratio.value = 8;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.32;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 1024;
        this.peakBuffer = new Float32Array(this.analyser.fftSize);
        this.compressor.connect(this.master);
        this.master.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        this.state = 'loading';
        this.ready = this.loadBuffers();
      } catch {
        this.unavailable = true;
        this.state = 'unavailable';
        return false;
      }
    }
    try {
      await this.context.resume();
      this.paused = false;
      if (this.state !== 'loading') this.state = 'running';
      return await this.ready;
    } catch {
      this.unavailable = true;
      this.state = 'unavailable';
      return false;
    }
  }

  async loadBuffers() {
    try {
      const base = new URL('media/sfx/', document.baseURI);
      const manifestUrl = new URL('manifest.json', base);
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error('SFX manifest unavailable');
      const manifest = await response.json();
      for (const entry of manifest.effects) this.manifest.set(entry.id, entry);
      for (const id of AUDIO_IDS) {
        const entry = this.manifest.get(id);
        if (!entry) throw new Error(`SFX missing: ${id}`);
        const asset = new URL(entry.file.replace(/^media\/sfx\//, ''), base);
        const fileResponse = await fetch(asset);
        if (!fileResponse.ok) throw new Error(`SFX unavailable: ${id}`);
        this.buffers.set(id, await this.context.decodeAudioData(await fileResponse.arrayBuffer()));
      }
      this.state = this.paused ? 'paused' : 'running';
      return true;
    } catch {
      this.unavailable = true;
      this.state = 'unavailable';
      return false;
    }
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.32, now, 0.015);
    }
  }

  setPaused(value) {
    this.paused = Boolean(value);
    if (!this.context || this.unavailable) return;
    if (this.paused) {
      this.state = 'paused';
      this.context.suspend().catch(() => {});
    } else if (!this.muted) {
      this.context.resume().then(() => {
        if (!this.unavailable) this.state = 'running';
      }).catch(() => {
        this.unavailable = true;
        this.state = 'unavailable';
      });
    }
  }

  play(id, { gain = 1, rate = 1, pan = 0 } = {}) {
    if (this.unavailable || this.muted || this.paused || !this.context) return;
    const family = id.startsWith('step-') ? 'steps' : id.includes('press') || id.includes('hit') ? 'impacts' : id;
    const nowMs = performance.now();
    if (nowMs - (this.lastPlay.get(id) || -Infinity) < 80) return;
    const max = family === 'steps' ? 2 : family === 'impacts' ? 2 : 6;
    if ((this.activeByFamily.get(family) || 0) >= max) return;
    this.lastPlay.set(id, nowMs);
    this.ready.then((ok) => {
      if (!ok || this.muted || this.paused || !this.context || !this.buffers.has(id)) return;
      const buffer = this.buffers.get(id);
      const source = this.context.createBufferSource();
      const panner = this.context.createStereoPanner();
      const level = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      level.gain.value = Math.max(0, Math.min(1, gain));
      source.connect(panner);
      panner.connect(level);
      level.connect(this.compressor);
      this.activeByFamily.set(family, (this.activeByFamily.get(family) || 0) + 1);
      source.onended = () => {
        const count = Math.max(0, (this.activeByFamily.get(family) || 1) - 1);
        this.activeByFamily.set(family, count);
        source.disconnect();
        panner.disconnect();
        level.disconnect();
      };
      source.start();
    });
  }

  setLoop(id, gain) {
    if (!this.context || this.unavailable || this.muted || this.paused) return;
    this.ready.then((ok) => {
      if (!ok || this.muted || this.paused || !this.context) return;
      const entry = this.manifest.get(id);
      const buffer = this.buffers.get(id);
      if (!entry?.loop || !buffer) return;
      let track = this.loops.get(id);
      if (!track) {
        const source = this.context.createBufferSource();
        const level = this.context.createGain();
        source.buffer = buffer;
        source.loop = true;
        level.gain.value = 0;
        source.connect(level);
        level.connect(this.compressor);
        source.start();
        track = { source, level, target: gain };
        this.loops.set(id, track);
      }
      track.target = gain;
      track.level.gain.setTargetAtTime(gain, this.context.currentTime, 0.12);
    });
  }

  stopLoop(id) {
    const track = this.loops.get(id);
    if (!track || !this.context) return;
    track.level.gain.setTargetAtTime(0, this.context.currentTime, 0.12);
    const source = track.source;
    window.setTimeout(() => {
      if (this.loops.get(id)?.source !== source) return;
      source.stop();
      source.disconnect();
      track.level.disconnect();
      this.loops.delete(id);
    }, 500);
  }

  ambience(mode) {
    const target = mode === 'hell' ? 'hell-room' : mode === 'heaven' ? 'heaven-air' : null;
    for (const id of ['hell-room', 'heaven-air']) {
      if (id === target) this.setLoop(id, 0.35);
      else this.stopLoop(id);
    }
  }

  flight(speed, active) {
    if (!active) {
      this.stopLoop('flight-air');
      return;
    }
    this.setLoop('flight-air', Math.min(0.45, 0.1 + Math.max(0, speed) / 80));
  }

  dispose() {
    for (const id of [...this.loops.keys()]) this.stopLoop(id);
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.state = 'closed';
    this.context = null;
    this.loops.clear();
  }

  probe() {
    if (this.analyser && this.peakBuffer) this.analyser.getFloatTimeDomainData(this.peakBuffer);
    let peak = 0;
    if (this.peakBuffer) for (const sample of this.peakBuffer) peak = Math.max(peak, Math.abs(sample));
    return {
      state: this.state,
      muted: this.muted,
      masterGain: this.master?.gain.value ?? 0,
      activeLoops: [...this.loops.keys()],
      peak,
    };
  }
}
