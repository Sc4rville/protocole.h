import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recipes } from '../sound-recipes.mjs';

globalThis.AudioContext = class {};
const { ZZFX } = await import('zzfx');
ZZFX.volume = 1;
const rate = 44100;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public/media/sfx');
await mkdir(root, { recursive: true });

function wave(recipe) {
  const samples = [];
  for (const layer of recipe.layers) {
    const rendered = ZZFX.buildSamples(...layer.params);
    const start = Math.round(layer.at * rate);
    for (let i = 0; i < rendered.length; i += 1) {
      const at = start + i;
      samples[at] = (samples[at] || 0) + rendered[i] * layer.gain;
    }
  }
  let data = Float32Array.from(samples, (x) => x || 0);
  if (recipe.loop) {
    const fade = Math.round(0.4 * rate);
    const length = data.length;
    for (let i = 0; i < fade; i += 1) {
      const t = i / fade;
      const head = data[i];
      const tail = data[length - fade + i];
      const mixed = head * t + tail * (1 - t);
      data[i] = mixed;
      data[length - fade + i] = mixed;
    }
  } else {
    const fade = Math.round(0.004 * rate);
    for (let i = 0; i < fade && i < data.length; i += 1) {
      const t = i / fade;
      data[i] *= t;
      data[data.length - 1 - i] *= t;
    }
  }
  let peak = 0;
  for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  const scale = Math.min(1, 0.8 / Math.max(peak, 1e-9));
  for (let i = 0; i < data.length; i += 1) data[i] *= scale;
  return data;
}

function wav(samples) {
  const dataBytes = samples.length * 2;
  const out = Buffer.alloc(44 + dataBytes);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + dataBytes, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    out.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return out;
}

const manifest = [];
for (const recipe of recipes) {
  const file = `${recipe.id}.wav`;
  await writeFile(resolve(root, file), wav(wave(recipe)));
  manifest.push({ id: recipe.id, file: `media/sfx/${file}`, loop: recipe.loop === true, source: 'synthesized-zzfx' });
}
await writeFile(resolve(root, 'manifest.json'), `${JSON.stringify({ sampleRate: rate, format: 'PCM16-mono', effects: manifest }, null, 2)}\n`);
