const bank = document.getElementById('bank');
const stateEl = document.getElementById('state');
const subtitle = document.getElementById('subtitle');
const player = document.getElementById('player');
const nowPlaying = document.getElementById('now-playing');
const stopBtn = document.getElementById('stop');
const volume = document.getElementById('volume');
const loopChk = document.getElementById('loop');
const search = document.getElementById('search');
const category = document.getElementById('category');

player.volume = 0.25;
let sounds = [];
let currentId = null;
let playRequestId = 0;

function showError(msg) {
  stateEl.textContent = msg;
  stateEl.classList.add('err');
}

function pickSource(s) {
  const ogg = document.createElement('audio');
  if (s.files && s.files.ogg && ogg.canPlayType('audio/ogg; codecs="vorbis"')) return s.files.ogg;
  return s.files.mp3;
}

function play(s, card) {
  const requestId = ++playRequestId;
  const src = pickSource(s);
  if (!src) return;
  player.src = src;
  loopChk.checked = false;
  player.loop = false;
  currentId = s.id;
  nowPlaying.textContent = s.id;
  document.querySelectorAll('.card.playing').forEach((c) => c.classList.remove('playing'));
  card.classList.add('playing');
  const p = player.play();
  if (p && p.catch) p.catch((err) => {
    if (requestId === playRequestId && err.name !== 'AbortError') {
      nowPlaying.textContent = s.id + ' — lecture impossible';
    }
  });
}

function render() {
  bank.querySelectorAll('.card').forEach((c) => c.remove());
  const q = search.value.trim().toLowerCase();
  const cat = category.value;
  let shown = 0;
  for (const s of sounds) {
    const hay = (s.id + ' ' + s.title + ' ' + s.intendedUse + ' ' + s.author).toLowerCase();
    if (cat && s.category !== cat) continue;
    if (q && !hay.includes(q)) continue;
    shown++;
    const card = document.createElement('article');
    card.className = 'card' + (s.id === currentId ? ' playing' : '');
    card.dataset.category = s.category;
    card.dataset.id = s.id;
    const h = document.createElement('h2');
    h.textContent = s.id;
    const use = document.createElement('p');
    use.className = 'use';
    use.textContent = s.intendedUse;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.append(document.createTextNode(s.title + ' — ' + s.author + ' (' + s.sourceName + ')'));
    meta.append(document.createElement('br'));
    const link = document.createElement('a');
    link.href = s.sourcePage;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Page source';
    meta.append(link, document.createTextNode(' · '));
    const lic = document.createElement('a');
    lic.href = s.licenseUrl;
    lic.target = '_blank';
    lic.rel = 'noopener';
    lic.textContent = s.license;
    meta.append(lic);
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = s.reviewStatus + (s.loopCandidate ? ' · loopCandidate (non validé)' : '');
    const kindParts = [];
    if (s.kind === 'derived') kindParts.push('dérivé de ' + s.derivedFrom);
    if (s.kind === 'synthesis') kindParts.push('synthèse');
    if (kindParts.length) badge.textContent += ' · ' + kindParts.join(' · ');
    const row = document.createElement('div');
    row.className = 'row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Écouter';
    btn.addEventListener('click', () => play(s, card));
    row.append(btn);
    card.append(h, use, meta, badge);
    if (s.contentWarning) {
      const warn = document.createElement('p');
      warn.className = 'warn';
      warn.textContent = '⚠ ' + s.contentWarning;
      card.append(warn);
    }
    card.append(row);
    bank.append(card);
  }
  stateEl.hidden = shown > 0;
  if (!shown) {
    stateEl.classList.remove('err');
    stateEl.textContent = 'Aucun candidat pour ce filtre.';
  }
}

stopBtn.addEventListener('click', () => {
  playRequestId++;
  player.pause();
  player.currentTime = 0;
});
volume.addEventListener('input', () => { player.volume = parseFloat(volume.value); });
player.addEventListener('volumechange', () => { volume.value = String(player.volume); });
loopChk.addEventListener('change', () => { player.loop = loopChk.checked; });
search.addEventListener('input', render);
category.addEventListener('change', render);

fetch('manifest.json')
  .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then((d) => {
    sounds = d.sounds || [];
    subtitle.textContent = sounds.length + ' candidats CC0 · à écouter et mixer · pas encore intégrés au jeu';
    render();
  })
  .catch((e) => showError('Manifeste indisponible : ' + e.message));

player.addEventListener('error', () => {
  if (player.src) nowPlaying.textContent = (currentId || '') + ' — erreur de lecture';
});
