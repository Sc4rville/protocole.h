// WebAudio scheduler for the theme, the SFX bank and the Gradium clips.
// Everything is scheduled against one AudioContext clock from a start time,
// so the mix is identical each run and can be reproduced offline by ffmpeg.
import { MUSIC, SFX, VOICE } from './timeline.js';

const AUDIO_BASE = '../audio/';
const DIALOGUE_BASE = '../dialogue/';
const CLIP_RE = /\.(mp3|ogg)$/i;

function pickClipFile(clip) {
  for (const f of Object.values(clip.files || {})) {
    if (typeof f === 'string' && CLIP_RE.test(f)) return DIALOGUE_BASE + f;
  }
  return null;
}

export async function loadVoiceIndex() {
  const res = await fetch(DIALOGUE_BASE + 'generated.json');
  const gen = res.ok ? await res.json() : { clips: {} };
  const out = {};
  for (const v of VOICE) {
    const clip = gen.clips?.[v.id];
    if (!clip) continue;
    out[v.id] = { text: clip.text, speaker: clip.speaker === 'unit_h' ? 'h' : 'sys', file: pickClipFile(clip) };
  }
  return out;
}

export function createAudioEngine() {
  const ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  const buffers = new Map();
  let voiceIndex = {};
  const live = [];

  async function load(url) {
    if (buffers.has(url)) return buffers.get(url);
    const p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))))
      .then((b) => ctx.decodeAudioData(b))
      .catch(() => null);
    buffers.set(url, p);
    return p;
  }

  async function preload(index) {
    voiceIndex = index;
    const urls = new Set([MUSIC.file]);
    for (const s of SFX) urls.add(AUDIO_BASE + s.sample + '.mp3');
    for (const v of Object.values(index)) if (v.file) urls.add(v.file);
    await Promise.all([...urls].map(load));
    for (const [id, v] of Object.entries(index)) {
      const buf = buffers.get(v.file) && (await buffers.get(v.file));
      v.duration = buf ? buf.duration : 2.5;
      index[id] = v;
    }
    return index;
  }

  // Start a buffer at trailer time `at` given the ctx time `t0` that maps to
  // trailer time `offset` (used for seeking).
  function schedule(buf, cue, t0, offset) {
    const start = cue.at - offset;
    const rate = cue.rate || 1;
    const natural = buf.duration / rate;
    let length = natural;
    if (cue.loopUntil) length = cue.loopUntil - cue.at;
    if (cue.cut) length = Math.min(length, cue.cut);
    const end = cue.at + length - offset;
    if (end <= 0) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = !!cue.loopUntil;
    const g = ctx.createGain();
    let node = src;
    if (cue.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cue.lowpass;
      src.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(master);

    const gain = cue.gain ?? 1;
    const fi = cue.fadeIn || 0;
    const fo = cue.fadeOut || 0;
    const when = t0 + Math.max(0, start);
    const skip = Math.max(0, -start);
    const a = g.gain;
    a.cancelScheduledValues(0);
    if (fi > 0 && skip < fi) {
      a.setValueAtTime((skip / fi) * gain, when);
      a.linearRampToValueAtTime(gain, when + fi - skip);
    } else {
      a.setValueAtTime(gain, when);
    }
    if (fo > 0) {
      a.setValueAtTime(gain, Math.max(when, t0 + end - fo));
      a.linearRampToValueAtTime(0, t0 + end);
    }
    src.start(when, src.loop ? (skip * rate) % buf.duration : skip * rate);
    src.stop(t0 + end + 0.02);
    live.push(src);
  }

  async function start(offset = 0) {
    await ctx.resume();
    const t0 = ctx.currentTime + 0.15;
    const theme = await buffers.get(MUSIC.file);
    if (theme) {
      schedule(theme, {
        at: MUSIC.at, gain: MUSIC.gain, fadeIn: MUSIC.fadeIn,
        cut: MUSIC.fadeOut[1] - MUSIC.at, fadeOut: MUSIC.fadeOut[1] - MUSIC.fadeOut[0],
      }, t0, offset);
    }
    for (const s of SFX) {
      const buf = await buffers.get(AUDIO_BASE + s.sample + '.mp3');
      if (buf) schedule(buf, s, t0, offset);
    }
    for (const v of VOICE) {
      const info = voiceIndex[v.id];
      const buf = info?.file && (await buffers.get(info.file));
      if (buf) schedule(buf, { at: v.at, gain: v.gain }, t0, offset);
    }
    return t0;
  }

  function stop() {
    for (const s of live) {
      try { s.stop(); } catch { /* already stopped */ }
    }
    live.length = 0;
  }

  return { ctx, preload, start, stop, master };
}
