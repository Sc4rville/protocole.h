import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
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

import { director, ENV, TYPES } from './director-core.mjs';

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
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const size = data.length;
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(size - 1, end);
      if (start > end) return send(res, 416, '', { 'Content-Range': `bytes */${size}` });
      const part = data.subarray(start, end + 1);
      return send(res, 206, req.method === 'HEAD' ? '' : part, { 'Content-Type': type, 'Content-Length': part.length, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes' });
    }
    return send(res, 200, req.method === 'HEAD' ? '' : data, { 'Content-Type': type, 'Content-Length': data.length, 'Accept-Ranges': 'bytes' });
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
