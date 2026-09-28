import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = {};
  const file = path.join(REPO, '.env.local');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of ['GEMINI_API_KEY', 'GEMINI_TEXT_MODEL', 'GRADIUM_API_KEY']) {
    if (process.env[k]) env[k] = process.env[k];
  }
  return env;
}

export const ENV = loadEnv();
const GEMINI_MODELS = [ENV.GEMINI_TEXT_MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean);
const VOICES = { unit_h: 'bwRhQrJel4IuvxLF', system: 'wFDijtvOAybUq2GR' };
const FACTS = new Set(['charge_restored', 'overload_caused', 'debris_removed', 'cable_torn', 'restraint_released', 'restraint_damaged', 'robot_struck', 'comforted', 'memory_wiped', 'spared', 'scrapped']);
const TIMEOUT_MS = 6000;

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'image/vnd.radiance', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
};

const SYSTEM_PROMPT = `You are the DIRECTOR of "protocole.h", a short interactive horror-drama set in a white evaluation cell.
Officially, a human operator is performing a maintenance review of Unit H. Secretly, an AI is evaluating the human, who does not know it.
Characters you can voice:
- "unit_h": a humanoid robot restrained in a treatment chair. Voice: adult, intimate, slightly worn, dignified, practical, remembers every harm done to it. Human first, never cartoonish.
- "system": the cell's procedural voice. Even, clinical, neither villainous nor comforting.
Your job on every call: pick the next staging beat so that a LOT happens across a 3 minute session, with escalating tension, surprises and variety (lights, sounds, the figure behind the glass, the robot's memories, questions to the player, procedural announcements).
Rules:
- "event" must be exactly one id from allowedEvents, or null if none fits.
- "text" is ONE short English line, at most 18 words, spoken by "speaker". Natural, specific, unsettling or moving. No stage directions, no quotes, no emojis.
- React to the facts: helping (charge_restored, debris_removed, restraint_released) earns trust and quiet gratitude; harm (overload_caused, cable_torn, restraint_damaged, robot_struck, memory_wiped, scrapped) is remembered, never forgiven by later help, and makes the robot guarded or wounded. Never claim an act that is not in facts.
- CLARITY FIRST: the player is a first-time visitor at a game jam. Unit H speaks plainly, in simple concrete words, never cryptic poetry. Most Unit H lines should point at something the player can actually do right now, without giving orders:
  * its battery is almost empty (the probe on the tray can charge it),
  * a piece of metal debris is stuck in its right arm (the pliers can pull it out),
  * the cuffs on its wrists and ankles hurt (the pliers can cut them),
  * the clamp on the chair can be loosened or tightened,
  * it is afraid of being hit or switched off,
  * the review ends at the COMPLETE REVIEW console on the wall.
  Rotate between these, and skip anything already in facts.
- Unit H is TALKATIVE: about 4 out of 5 lines should be spoken by "unit_h". It comments on what the operator is doing right now, asks them questions, tells tiny memories, pleads, jokes nervously, thanks or blames them.
- "system" lines are short procedural reminders (time left, what the review is for: decide if Unit H is kept or scrapped).
- Never repeat or paraphrase a line from "said".
- Never reveal that the human is the one being tested unless phase is exactly "reveal". In "reveal", the system may state it plainly.
- If playerText is present, speaker must be "unit_h" and the line must answer the player directly first.
Return only JSON matching the schema.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    event: { type: 'STRING', nullable: true },
    speaker: { type: 'STRING', enum: ['unit_h', 'system'] },
    text: { type: 'STRING' },
  },
  required: ['speaker', 'text'],
};

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

function sanitize(body) {
  const list = (v, n, len = 160) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-n).map((x) => x.slice(0, len)) : []);
  return {
    elapsed: Number.isFinite(body.elapsed) ? Math.max(0, Math.min(3600, body.elapsed)) : 0,
    phase: typeof body.phase === 'string' ? body.phase.slice(0, 300) : 'unknown',
    facts: list(body.facts, 12, 40).filter((f) => FACTS.has(f)),
    recent: list(body.recent, 12),
    allowedEvents: list(body.allowedEvents, 40, 60),
    said: list(body.said, 20, 200),
    playerText: typeof body.playerText === 'string' && body.playerText.trim() ? body.playerText.trim().slice(0, 240) : null,
  };
}

async function askGemini(input) {
  const key = ENV.GEMINI_API_KEY;
  if (!key) throw new Error('no gemini key');
  const user = JSON.stringify(input);
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    const t = withTimeout(TIMEOUT_MS);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: t.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.9, maxOutputTokens: 200 },
        }),
      });
      if (!res.ok) {
        lastError = new Error(`gemini ${model} http ${res.status}`);
        if (res.status === 404 || res.status === 400) continue;
        throw lastError;
      }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const out = JSON.parse(raw);
      return { ...out, model };
    } catch (e) {
      lastError = e.name === 'AbortError' ? new Error(`gemini ${model} timeout`) : e;
      if (e.name === 'AbortError') throw lastError;
    } finally {
      t.done();
    }
  }
  throw lastError || new Error('gemini failed');
}

async function speak(text, speaker) {
  const key = ENV.GRADIUM_API_KEY;
  if (!key) return null;
  const t = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch('https://api.gradium.ai/api/post/speech/tts', {
      method: 'POST',
      signal: t.signal,
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        text, voice_id: VOICES[speaker] || VOICES.unit_h, model_name: 'default',
        output_format: 'wav', only_audio: true, json_config: { rewrite_rules: 'en' },
      }),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 44 || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
    return `data:audio/wav;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  } finally {
    t.done();
  }
}

function cleanLine(text) {
  const words = String(text || '').replace(/[—–]/g, ', ').replace(/\s+/g, ' ').replace(/^["'\s]+|["'\s]+$/g, '').split(' ');
  return words.slice(0, 22).join(' ');
}

export async function director(body) {
  const input = sanitize(body);
  let reply;
  try {
    reply = await askGemini(input);
  } catch (e) {
    return { out: { event: null, speaker: 'unit_h', text: null, audio: null, source: 'fallback' }, note: e.message };
  }
  const speaker = input.playerText ? 'unit_h' : reply.speaker === 'system' ? 'system' : 'unit_h';
  const event = input.allowedEvents.includes(reply.event) ? reply.event : null;
  const text = cleanLine(reply.text) || null;
  const audio = text ? await speak(text, speaker) : null;
  return { out: { event, speaker, text, audio, source: 'gemini' }, note: `${reply.model}${audio ? '' : ' no-audio'}` };
}

