#!/usr/bin/env node
// Offline audio mix of the trailer: reproduces public/trailer/audio.js with
// ffmpeg so the MP4 hears exactly what the browser plays.
//   node scripts/trailer/mix.mjs out/trailer/mix.wav
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = join(ROOT, 'public');
const timeline = await import(join(PUBLIC, 'trailer/timeline.js'));
const { DURATION, MUSIC, SFX, VOICE } = timeline;

const out = resolve(process.argv[2] || join(ROOT, 'out/trailer/mix.wav'));
mkdirSync(dirname(out), { recursive: true });
const SR = 48000;

function probeDuration(file) {
  const s = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(String(s));
}

const generated = JSON.parse(readFileSync(join(PUBLIC, 'dialogue/generated.json'), 'utf8'));
function voiceFile(id) {
  const clip = generated.clips?.[id];
  if (!clip) return null;
  for (const f of Object.values(clip.files || {})) {
    if (typeof f === 'string' && /\.(mp3|ogg)$/i.test(f)) return join(PUBLIC, 'dialogue', f);
  }
  return null;
}

const inputs = [];
const chains = [];
const durations = {};

function addCue(file, cue) {
  if (!existsSync(file)) {
    console.warn('missing', file);
    return;
  }
  const idx = inputs.length;
  inputs.push(file);
  const rate = cue.rate || 1;
  const natural = probeDuration(file) / rate;
  let length = natural;
  if (cue.loopUntil) length = cue.loopUntil - cue.at;
  if (cue.cut) length = Math.min(length, cue.cut);
  length = Math.min(length, DURATION - cue.at);
  if (length <= 0) return;
  const f = [`aresample=${SR}`, 'aformat=channel_layouts=stereo'];
  if (rate !== 1) f.push(`asetrate=${SR * rate}`, `aresample=${SR}`);
  if (cue.loopUntil) f.push('aloop=loop=-1:size=2147483647');
  f.push(`atrim=0:${length.toFixed(3)}`, 'asetpts=PTS-STARTPTS');
  if (cue.lowpass) f.push(`lowpass=f=${cue.lowpass}`);
  f.push(`volume=${(cue.gain ?? 1).toFixed(3)}`);
  if (cue.fadeIn) f.push(`afade=t=in:st=0:d=${Math.min(cue.fadeIn, length).toFixed(3)}`);
  if (cue.fadeOut) {
    const fo = Math.min(cue.fadeOut, length);
    f.push(`afade=t=out:st=${(length - fo).toFixed(3)}:d=${fo.toFixed(3)}`);
  }
  f.push(`adelay=${Math.round(cue.at * 1000)}:all=1`);
  chains.push(`[${idx}:a]${f.join(',')}[c${idx}]`);
  return idx;
}

addCue(join(PUBLIC, 'intro/theme', MUSIC.file.split('/').pop()), {
  at: MUSIC.at, gain: MUSIC.gain, fadeIn: MUSIC.fadeIn,
  cut: MUSIC.fadeOut[1] - MUSIC.at, fadeOut: MUSIC.fadeOut[1] - MUSIC.fadeOut[0],
});
for (const s of SFX) addCue(join(PUBLIC, 'audio', s.sample + '.mp3'), s);
for (const v of VOICE) {
  const file = voiceFile(v.id);
  if (!file) continue;
  durations[v.id] = probeDuration(file);
  addCue(file, { at: v.at, gain: v.gain });
}

const mixLabels = chains.map((c) => c.match(/(\[c\d+\])$/)[1]).join('');
const graph = [
  ...chains,
  `${mixLabels}amix=inputs=${chains.length}:duration=longest:normalize=0,alimiter=limit=0.95:level=false,atrim=0:${DURATION}[mix]`,
].join(';');

const graphFile = out.replace(/\.\w+$/, '.filter');
writeFileSync(graphFile, graph);
writeFileSync(out.replace(/\.\w+$/, '.voices.json'), JSON.stringify(durations, null, 2));

const args = ['-y', '-hide_banner', '-loglevel', 'error'];
for (const f of inputs) args.push('-i', f);
args.push('-filter_complex_script', graphFile, '-map', '[mix]', '-ar', String(SR), '-ac', '2', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log('wrote', out, `(${inputs.length} cues)`);
