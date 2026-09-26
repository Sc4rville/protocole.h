const bank = document.getElementById('bank');
const stateEl = document.getElementById('state');
const subtitle = document.getElementById('subtitle');
const player = document.getElementById('player');
const nowPlaying = document.getElementById('now-playing');
const stopBtn = document.getElementById('stop');
const volume = document.getElementById('volume');
const search = document.getElementById('search');
const speaker = document.getElementById('speaker');
const group = document.getElementById('group');
const auditionBtn = document.getElementById('audition');
const voiceStatus = document.getElementById('voice-status');

player.volume = 0.25;
let manifest = null;
let clips = {};
let lines = [];
let auditionOnly = new URLSearchParams(location.search).has('audition');
let currentId = null;
let playRequestId = 0;

function showError(msg) {
  stateEl.hidden = false;
  stateEl.textContent = msg;
  stateEl.classList.add('err');
}

function clipPath(id) {
  const files = clips[id] && clips[id].files;
  if (!files) return null;
  const probe = document.createElement('audio');
  const order = probe.canPlayType('audio/ogg; codecs="vorbis"')
    ? ['ogg', 'mp3', 'wav'] : ['mp3', 'wav', 'ogg'];
  for (const fmt of order) {
    const f = files[fmt];
    if (typeof f === 'string' && /^clips\/[A-Za-z0-9_-]+\.(?:ogg|mp3|wav)$/.test(f)) {
      return f;
    }
  }
  return null;
}

function requiresText(req) {
  if (!req) return '—';
  const parts = [];
  if (req.allFacts && req.allFacts.length) parts.push('allFacts: ' + req.allFacts.join(', '));
  if (req.anyFacts && req.anyFacts.length) parts.push('anyFacts: ' + req.anyFacts.join(', '));
  if (req.noFacts && req.noFacts.length) parts.push('noFacts: ' + req.noFacts.join(', '));
  return parts.length ? parts.join(' ; ') : 'aucun';
}

function play(line, card) {
  const requestId = ++playRequestId;
  const src = clipPath(line.id);
  if (!src) return;
  player.src = src;
  currentId = line.id;
  nowPlaying.textContent = line.id;
  document.querySelectorAll('.card.playing').forEach((c) => c.classList.remove('playing'));
  card.classList.add('playing');
  const p = player.play();
  if (p && p.catch) p.catch((err) => {
    if (requestId === playRequestId && err.name !== 'AbortError') {
      nowPlaying.textContent = line.id + ' — lecture impossible';
    }
  });
}

function card(line) {
  const el = document.createElement('article');
  el.className = 'card' + (line.id === currentId ? ' playing' : '');
  el.dataset.id = line.id;
  const h = document.createElement('h2');
  h.textContent = line.id;
  const emo = document.createElement('span');
  emo.className = 'emotion';
  emo.textContent = line.emotion;
  const status = document.createElement('span');
  status.className = 'status';
  status.textContent = clipPath(line.id) ? 'Generated — not auditioned' : 'Not generated';
  const text = document.createElement('p');
  text.className = 'line-text';
  text.textContent = line.text;
  const det = document.createElement('details');
  const sum = document.createElement('summary');
  sum.textContent = 'Direction & conditions';
  const dl = document.createElement('dl');
  for (const [k, v] of [
    ['Événement', line.event],
    ['Voix', line.speaker + ' · ' + line.group],
    ['Conditions', requiresText(line.requires)],
    ['Direction', line.direction],
    ['bodyCue (note, pas animé)', line.bodyCue],
    ['Priorité', line.priority + (line.oncePerRun ? ' · une fois' : '')],
    ['Statut', line.reviewStatus],
  ]) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  det.append(sum, dl);
  const row = document.createElement('div');
  row.className = 'row';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Listen';
  btn.disabled = !clipPath(line.id);
  btn.addEventListener('click', () => play(line, el));
  row.append(btn);
  el.append(h, emo, status, text, det, row);
  return el;
}

function render() {
  if (!manifest) return;
  bank.querySelectorAll('.card').forEach((c) => c.remove());
  const q = search.value.trim().toLowerCase();
  const sp = speaker.value;
  const gr = group.value;
  const aud = new Set(manifest.auditionIds);
  let shown = 0;
  for (const line of lines) {
    if (auditionOnly && !aud.has(line.id)) continue;
    if (sp && line.speaker !== sp) continue;
    if (gr && line.group !== gr) continue;
    const hay = (line.id + ' ' + line.text + ' ' + line.emotion + ' ' + line.direction).toLowerCase();
    if (q && !hay.includes(q)) continue;
    shown++;
    bank.append(card(line));
  }
  stateEl.hidden = shown > 0;
  if (!shown) {
    stateEl.classList.remove('err');
    stateEl.textContent = 'Aucune réplique pour ce filtre.';
  }
}

stopBtn.addEventListener('click', () => {
  playRequestId++;
  player.pause();
  player.currentTime = 0;
});
volume.addEventListener('input', () => { player.volume = parseFloat(volume.value); });
player.addEventListener('volumechange', () => { volume.value = String(player.volume); });
search.addEventListener('input', render);
speaker.addEventListener('change', render);
group.addEventListener('change', render);
auditionBtn.addEventListener('click', () => {
  auditionOnly = !auditionOnly;
  auditionBtn.setAttribute('aria-pressed', String(auditionOnly));
  render();
});

player.addEventListener('error', () => {
  if (player.src) nowPlaying.textContent = (currentId || '') + ' — erreur de lecture';
});

auditionBtn.setAttribute('aria-pressed', String(auditionOnly));
auditionBtn.textContent = 'Audition (' + '6' + ')';

Promise.all([
  fetch('manifest.json').then((r) => { if (!r.ok) throw new Error('manifest HTTP ' + r.status); return r.json(); }),
  fetch('generated.json').then((r) => {
    if (r.status === 404) return { clips: {} };
    if (!r.ok) throw new Error('generated.json HTTP ' + r.status);
    return r.json().catch(() => { throw new Error('generated.json is not valid JSON'); });
  }),
]).then(([m, g]) => {
  manifest = m;
  clips = (g && g.clips) || {};
  lines = m.lines;
  auditionBtn.textContent = 'Audition (' + m.auditionIds.length + ')';
  const groups = [...new Set(lines.map((l) => l.group))].sort();
  for (const gr of groups) {
    const opt = document.createElement('option');
    opt.value = gr;
    opt.textContent = gr;
    group.append(opt);
  }
  const genCount = lines.filter((line) => clipPath(line.id)).length;
  subtitle.textContent = lines.length + ' répliques · ' + genCount + ' générées' +
    (genCount === 0 ? ' — aucune voix produite' : ' — à auditionner');
  voiceStatus.textContent = genCount
    ? 'Generated takes require listening and performance review.'
    : 'No voices generated yet.';
  render();
}).catch((e) => showError('Manifeste indisponible : ' + e.message));
