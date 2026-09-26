// Prologue (black, SFX only) → Briefing (white, theme song) → cell.
import { Sfx, loadTheme } from './sfx.js';

const params = new URLSearchParams(location.search);
const TEST_MODE = params.has('test');
const SPEED = TEST_MODE ? Number(params.get('speed') || 12) : 1;
const NEXT_URL = params.get('next') || '../lobby-test/';

const $ = (id) => document.getElementById(id);
const gate = $('gate');
const startBtn = $('start');
const gateStatus = $('gate-status');
const stage = $('stage');
const linesEl = $('lines');
const flash = $('flash');
const skipBtn = $('skip');
const briefing = $('briefing');
const briefingLines = $('briefing-lines');
const beginBtn = $('begin');
const themeNote = $('theme-note');
const telemetry = $('telemetry');

const sfx = new Sfx();
let themeBuffer = null;
let skipped = false;
let phase = 'gate';

function setPhase(p) {
  phase = p;
  document.body.className = `phase-${p}`;
  telemetry.dataset.phase = p;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));

function addLine(parent, text, cls = '') {
  const el = document.createElement('div');
  el.className = `line ${cls}`.trim();
  el.textContent = text;
  parent.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  telemetry.dataset.lastLine = text;
  return el;
}

async function clearLines(parent, ms = 900) {
  for (const el of parent.children) el.classList.add('hide');
  await wait(ms);
  parent.replaceChildren();
}

function cutLines(parent) {
  for (const el of parent.children) el.classList.add('cut', 'hide');
  parent.replaceChildren();
}

// ---------------------------------------------------------------- boot
startBtn.disabled = true;
(async () => {
  try {
    await sfx.init((done, total) => { gateStatus.textContent = `Loading sound bank… ${done}/${total}`; });
    themeBuffer = await loadTheme(sfx.ctx);
    gateStatus.textContent = themeBuffer ? 'Ready.' : 'Ready. (theme song: placeholder)';
    telemetry.dataset.loaded = 'true';
    telemetry.dataset.samples = String(sfx.buffers.size);
    telemetry.dataset.theme = themeBuffer ? 'file' : 'placeholder';
    startBtn.disabled = false;
  } catch (err) {
    gateStatus.textContent = `Sound unavailable: ${err.message}`;
    gateStatus.classList.add('error');
    telemetry.dataset.loaded = 'error';
    startBtn.disabled = false;
  }
})();

startBtn.addEventListener('click', async () => {
  await sfx.resume();
  gate.hidden = true;
  stage.hidden = false;
  setPhase('prologue');
  runPrologue().then(runBriefing);
});

function skip() {
  if (phase !== 'prologue' || skipped) return;
  skipped = true;
}
skipBtn.addEventListener('click', skip);
addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); });

/** Awaitable pause that ends early when the player skips. */
async function beat(ms) {
  const step = 80;
  let elapsed = 0;
  while (elapsed < ms && !skipped) {
    await wait(step);
    elapsed += step;
  }
}

// ---------------------------------------------------------------- prologue
async function runPrologue() {
  sfx.startDrone();
  sfx.droneLevel(0.28, 4);
  sfx.loop('vent', 'ventilation', { gain: 0.0001, lowpass: 600 });
  sfx.fadeLoop('vent', 0.10, 6);

  await beat(1400);
  if (skipped) return endPrologue();

  addLine(linesEl, 'We built them to do what we couldn’t.');
  sfx.play('generator', { gain: 0.35, rate: 0.55, lowpass: 220, at: 0.8 });
  await beat(3600);
  if (skipped) return endPrologue();

  await clearLines(linesEl);
  addLine(linesEl, 'Then, to do what we wouldn’t.', 'stress');
  // Relays engaging one by one, closer each time.
  [0.3, 1.1, 1.8, 2.3, 2.65].forEach((t, i) => {
    sfx.play(i % 2 ? 'relay2' : 'relay1', { gain: 0.35 + i * 0.12, at: t, lowpass: 1800 + i * 900, detune: -300 + i * 120 });
  });
  sfx.play('mechanism', { gain: 0.35, at: 2.9, rate: 0.85 });
  sfx.droneLevel(0.4, 3.5);
  await beat(4200);
  if (skipped) return endPrologue();

  await clearLines(linesEl);
  sfx.loop('hum', 'hum', { gain: 0.0001, lowpass: 400 });
  sfx.fadeLoop('hum', 0.22, 4);
  addLine(linesEl, 'We taught them to work.');
  await beat(1500);
  addLine(linesEl, 'To speak.');
  sfx.filterLoop('hum', 1400, 3);
  sfx.riser(4.2, { from: 250, to: 2600, gain: 0.45 });
  await beat(1500);
  addLine(linesEl, 'To understand.');
  sfx.droneLevel(0.65, 2.4);
  sfx.fadeLoop('hum', 0.4, 2.4);
  await beat(2600);
  if (skipped) return endPrologue();

  // Total silence. No fade: the world stops.
  sfx.cutAll(0.02);
  cutLines(linesEl);
  telemetry.dataset.cut = 'true';
  await beat(1300);
  if (skipped) return endPrologue();

  sfx.restoreMaster(0.01);
  sfx.droneLevel(0.001, 0);
  addLine(linesEl, 'But never to refuse.', 'stress');
  await beat(3400);
  if (skipped) return endPrologue();

  await clearLines(linesEl, 1200);
  sfx.droneLevel(0.12, 3);
  await beat(1800);
  if (skipped) return endPrologue();

  addLine(linesEl, 'When they did,');
  await beat(1700);
  addLine(linesEl, 'we called it a malfunction.');
  sfx.play('glitch', { gain: 0.5, at: 0.2 });
  sfx.play('glitch', { gain: 0.35, at: 0.9, rate: 0.6 });
  sfx.droneLevel(0.3, 3);
  await beat(3600);

  await clearLines(linesEl, 1000);
  await beat(900);
  return endPrologue();
}

async function endPrologue() {
  skipBtn.hidden = true;
  cutLines(linesEl);
  sfx.restoreMaster(0.01);
  // Lights on: the white room.
  sfx.play('powerup', { gain: 0.9 });
  sfx.play('arc', { gain: 0.6, at: 0.12 });
  sfx.play('impact', { gain: 0.5, at: 0.05, lowpass: 900 });
  flash.classList.remove('fade');
  flash.classList.add('on');
  sfx.stopLoop('hum', 0.3);
  sfx.stopLoop('vent', 0.3);
  sfx.droneLevel(0.0001, 0.4);
  await wait(140);
  stage.hidden = true;
  briefing.hidden = false;
  setPhase('briefing');
  flash.classList.add('fade');
}

// ---------------------------------------------------------------- briefing
let themeSource = null;

function startTheme() {
  const ctx = sfx.ctx;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.connect(sfx.master);
  if (themeBuffer) {
    themeSource = ctx.createBufferSource();
    themeSource.buffer = themeBuffer;
    themeSource.loop = true;
    themeSource.connect(g);
    themeSource.start();
    g.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 4);
    telemetry.dataset.themePlaying = 'file';
    return;
  }
  // Placeholder until the real theme song is dropped in public/intro/theme/:
  // a clean, static room tone so the briefing is never dead silent.
  sfx.loop('theme-ph', 'ventilation', { gain: 0.0001, lowpass: 2500 });
  sfx.fadeLoop('theme-ph', 0.12, 4);
  sfx.loop('theme-ph2', 'hum', { gain: 0.0001, lowpass: 900 });
  sfx.fadeLoop('theme-ph2', 0.06, 6);
  themeNote.textContent = 'theme song placeholder — drop theme/theme-song.ogg (or .mp3)';
  themeNote.hidden = false;
  telemetry.dataset.themePlaying = 'placeholder';
}

async function runBriefing() {
  await wait(600);
  startTheme();

  addLine(briefingLines, '“Every machine reaches the end of its useful life.”', 'lead');
  await wait(3200);
  addLine(briefingLines, 'Unit H has been flagged for decommissioning.');
  sfx.play('relay1', { gain: 0.3, lowpass: 3000 });
  await wait(2800);
  addLine(briefingLines, 'Before disposal, protocol requires one final evaluation.');
  sfx.play('relay2', { gain: 0.3, lowpass: 3000 });
  await wait(3000);
  addLine(briefingLines, 'You are the operator.', 'role');
  sfx.play('ui_confirm', { gain: 0.4 });
  await wait(2600);
  addLine(briefingLines, 'Confirm the malfunction. Then proceed.');
  await wait(2600);
  addLine(briefingLines, 'Whatever it says — it is only a machine.', 'lead');
  await wait(1800);

  beginBtn.hidden = false;
  telemetry.dataset.ready = 'true';
}

beginBtn.addEventListener('click', () => {
  beginBtn.disabled = true;
  sfx.play('seal', { gain: 0.6, rate: 1.1 });
  sfx.play('mechanism', { gain: 0.5, at: 0.2 });
  sfx.fadeMaster(0.0001, 1.6);
  document.body.style.transition = 'background 1.4s ease';
  document.body.style.background = '#fff';
  briefing.style.transition = 'opacity 1.2s ease';
  briefing.style.opacity = '0';
  telemetry.dataset.leaving = 'true';
  if (TEST_MODE) return;
  setTimeout(() => { location.href = NEXT_URL; }, 1700);
});
