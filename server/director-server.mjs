import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ROOT = path.resolve(arg('root', path.join(REPO, 'dist')));
const PORT = Number(arg('port', 5190));
const HOST = '127.0.0.1';

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

const ENV = loadEnv();
const GEMINI_MODELS = [ENV.GEMINI_TEXT_MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean);
const VOICES = { unit_h: 'bwRhQrJel4IuvxLF', system: 'wFDijtvOAybUq2GR' };
const FACTS = new Set(['charge_restored', 'overload_caused', 'debris_removed', 'cable_torn', 'restraint_released', 'restraint_damaged']);
const TIMEOUT_MS = 6000;

const TYPES = {
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
Your job on every call: pick the next staging beat so that a LOT happens across a 5 minute session, with escalating tension, surprises and variety (lights, sounds, the figure behind the glass, the robot's memories, questions to the player, procedural announcements).
Rules:
- "event" must be exactly one id from allowedEvents, or null if none fits.
- "text" is ONE short English line, at most 18 words, spoken by "speaker". Natural, specific, unsettling or moving. No stage directions, no quotes, no emojis.
- React to the facts: helping (charge_restored, debris_removed, restraint_released) earns trust and quiet gratitude; harm (overload_caused, cable_torn, restraint_damaged) is remembered, never forgiven by later help, and makes the robot guarded or wounded. Never claim an act that is not in facts.
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
    phase: typeof body.phase === 'string' ? body.phase.slice(0, 40) : 'unknown',
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

async function director(body) {
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

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

async function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, 'bad request');
  }
  const target = path.resolve(ROOT, '.' + path.posix.normalize('/' + rel));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return send(res, 403, 'forbidden');
  let file = target;
  try {
    let s = await stat(file);
    if (s.isDirectory()) {
      if (!pathname.endsWith('/')) return send(res, 301, '', { Location: pathname + '/' });
      file = path.join(file, 'index.html');
      s = await stat(file);
    }
    const data = await readFile(file);
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    return send(res, 200, req.method === 'HEAD' ? '' : data, { 'Content-Type': type, 'Content-Length': data.length });
  } catch {
    return send(res, 302, '', { Location: '/intro/index.html' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  if (url.pathname === '/api/director') {
    if (req.method !== 'POST') return send(res, 405, '');
    const t0 = Date.now();
    let body;
    try {
      body = JSON.parse(await readBody(req) || '{}');
    } catch {
      return send(res, 400, JSON.stringify({ error: 'invalid json' }), { 'Content-Type': 'application/json' });
    }
    const { out, note } = await director(body || {});
    console.log(`[director] ${Date.now() - t0}ms source=${out.source} event=${out.event ?? '-'} ${note || ''}`.trim());
    return send(res, 200, JSON.stringify(out), { 'Content-Type': 'application/json' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '');
  if (url.pathname === '/') return send(res, 302, '', { Location: '/intro/index.html' });
  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`[director] http://${HOST}:${PORT} root=${path.relative(REPO, ROOT) || '.'} gemini=${ENV.GEMINI_API_KEY ? 'on' : 'off'} gradium=${ENV.GRADIUM_API_KEY ? 'on' : 'off'}`);
});
