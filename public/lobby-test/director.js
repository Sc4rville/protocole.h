import { FACT_TEXT } from './interactions.js';

const THREE = globalThis.THREE;
const SFX = '../audio/';
const API = '/api/director';
const TOTAL = 290;
const COUNTDOWN = 45;
const REVEAL_DELAY = 11;

const PHASES = [
  { id: 'arrival', until: 50, every: 15 },
  { id: 'unrest', until: 135, every: 12 },
  { id: 'pressure', until: TOTAL - COUNTDOWN, every: 9 },
  { id: 'countdown', until: TOTAL, every: 7 },
];

const SCRIPT = {
  arrival: ['flicker', 'robot_look', 'vent_surge'],
  unrest: ['glass_knock', 'robot_struggle', 'heartbeat', 'flicker', 'door_slam', 'robot_distress', 'robot_look'],
  pressure: ['blackout', 'robot_struggle', 'alarm', 'glass_knock', 'scream_far', 'door_slam', 'heartbeat', 'robot_distress', 'flicker'],
  countdown: ['alarm', 'flicker', 'robot_look', 'robot_struggle'],
};

const EVENTS = Object.keys({
  flicker: 1, blackout: 1, alarm: 1, glass_knock: 1, door_slam: 1, robot_struggle: 1,
  robot_look: 1, robot_distress: 1, vent_surge: 1, heartbeat: 1, scream_far: 1,
});

const BEATS = [
  { at: 4, say: 'briefing.access' },
  { at: 11, say: 'briefing.assess' },
  { at: 19, say: 'briefing.diagnostic' },
  { at: 27, say: 'briefing.method' },
  { at: 6, hint: 'E · pick up an object that glows', ifEmptyHands: true },
  { at: 42, hint: 'T · talk to Unit H' },
  { at: 95, say: 'player.waiting', ifNoFacts: true },
  { at: 170, say: 'player.waiting', ifNoFacts: true },
];

function makeHalo() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,.95)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createDirector({ scene, camera, renderer, gameplay, robot }) {
  const baseExposure = renderer.toneMappingExposure;
  const baseFog = scene.fog ? scene.fog.density : 0;
  const red = new THREE.PointLight(0xff2a14, 0, 9, 1.6);
  red.position.set(0, 2.5, 0.4);
  scene.add(red);

  const haloTex = makeHalo();
  const halos = {};
  for (const [id, t] of Object.entries(gameplay.debug.targets)) {
    const mat = new THREE.SpriteMaterial({ map: haloTex, color: id === 'finish' ? 0xff9a3c : 0x22c8ff, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    const r = t.object.geometry?.parameters?.radius ?? 0.12;
    sprite.userData.size = Math.max(0.3, r * 5);
    sprite.renderOrder = 10;
    scene.add(sprite);
    halos[id] = sprite;
  }

  const line = document.getElementById('director-line');
  const timerEl = document.getElementById('countdown');
  const hintEl = document.getElementById('director-hint');
  const talkEl = document.getElementById('talk');
  const talkInput = talkEl.querySelector('input');
  const revealEl = document.getElementById('reveal');
  const voice = new Audio();
  voice.volume = 0.85;
  const gpVoice = gameplay.voice;
  if (gpVoice) gpVoice.volume = 0.85;
  let quietSince = 0;
  let pendingReply = null;
  const playing = (a) => a && !a.paused && !a.ended && a.currentTime > 0;
  const speaking = () => playing(voice) || playing(gpVoice);
  const now = () => performance.now() / 1000;

  const MUSIC_VOLUME = 0.32;
  const music = window.__protocoleMusic || new Audio('/intro/theme/theme-song.mp3');
  music.loop = true;
  let musicTarget = MUSIC_VOLUME;
  if (!window.__protocoleMusic) music.play().catch(() => {});

  const loops = new Map();
  let muted = false;
  let t = 0;
  let nextEventAt = 8;
  let beatIndex = 0;
  let phaseIndex = 0;
  const scriptPos = {};
  const said = [];
  const recent = [];
  let busy = false;
  let apiDown = false;
  let lineTimer = 0;
  let hintTimer = 0;
  let finished = false;
  let finishT = 0;
  let revealed = false;
  let lastFacts = 0;
  let lastEquipped = null;
  const toolHinted = new Set();
  const fx = { flicker: 0, blackout: 0, alarm: 0, shake: 0, struggle: 0, look: 0, distress: 0, fog: 0 };

  function sfx(name, volume = 0.6) {
    if (muted) return;
    const a = new Audio(SFX + name + '.mp3');
    a.volume = volume;
    a.play().catch(() => {});
  }
  function loop(name, volume, on) {
    let a = loops.get(name);
    if (on && !a) {
      a = new Audio(SFX + name + '.mp3');
      a.loop = true;
      a.volume = muted ? 0 : volume;
      a.play().catch(() => {});
      loops.set(name, a);
    } else if (!on && a) {
      a.pause();
      loops.delete(name);
    }
  }

  function showLine(text, seconds = 5) {
    if (!text) return;
    line.textContent = text;
    line.hidden = false;
    lineTimer = seconds;
    const sub = document.getElementById('robot-subtitle');
    if (sub) sub.hidden = true;
  }
  function showHint(text, seconds = 6) {
    hintEl.textContent = text;
    hintEl.hidden = false;
    hintTimer = seconds;
  }

  function play(evt) {
    recent.push(evt);
    if (recent.length > 6) recent.shift();
    switch (evt) {
      case 'flicker': fx.flicker = 1.6; sfx('ui/robot_glitch_01', 0.35); break;
      case 'blackout': fx.blackout = 5.5; sfx('electricity/probe_arc_snap_01', 0.6); sfx('breaths/heartbeat_distant_01', 0.7); setTimeout(() => sfx('electricity/room_powerup_01', 0.5), 5200); break;
      case 'alarm': fx.alarm = 6; sfx('alarms/alarm_pulse_high_01', 0.45); break;
      case 'glass_knock': fx.shake = 0.35; sfx('impacts/metal_impact_low_01', 0.8); setTimeout(() => sfx('impacts/metal_impact_low_01', 0.6), 700); break;
      case 'door_slam': fx.shake = 0.6; sfx('metal/metal_door_low_01', 0.8); break;
      case 'robot_struggle': fx.struggle = 2.4; sfx('mechanics/robot_rattle_01', 0.7); sfx('mechanics/restraint_mechanism_01', 0.5); break;
      case 'robot_look': fx.look = 7; sfx('robot/robot_servo_01', 0.5); break;
      case 'robot_distress': fx.distress = 2.5; sfx('screams/robot_distress_low_01', 0.45); break;
      case 'vent_surge': fx.fog = 1; sfx('impacts/air_whoosh_01', 0.5); break;
      case 'heartbeat': sfx('breaths/heartbeat_fast_01', 0.6); break;
      case 'scream_far': sfx('screams/scream_horror_01', 0.18); fx.shake = 0.15; break;
      default: return;
    }
  }

  function phase() {
    return PHASES[phaseIndex];
  }

  function scriptedEvent(id) {
    const list = SCRIPT[id];
    const i = scriptPos[id] ?? 0;
    scriptPos[id] = i + 1;
    return list[i % list.length];
  }

  async function askDirector(playerText) {
    if (apiDown && !playerText) return null;
    busy = true;
    try {
      const facts = gameplay.debug.getState().facts;
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ elapsed: Math.round(t), phase: finished ? 'reveal' : phase().id, facts, recent, allowedEvents: finished ? [] : EVENTS, said: said.slice(-8), playerText }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const quiet = !speaking() && now() - quietSince > 5;
      if (data.text && playerText && speaking()) {
        pendingReply = data;
        return data;
      }
      if (data.text && (playerText || quiet)) {
        said.push(data.text);
        showLine(data.text, Math.max(3.5, data.text.split(' ').length * 0.42));
        if (data.audio && !muted) {
          voice.src = data.audio;
          voice.play().catch(() => {});
        }
      }
      return data;
    } catch {
      if (!playerText) apiDown = true;
      return null;
    } finally {
      busy = false;
    }
  }

  async function nextEvent() {
    const data = await askDirector();
    const evt = data?.event && EVENTS.includes(data.event) ? data.event : scriptedEvent(phase().id);
    play(evt);
  }

  function openTalk() {
    if (finished) return false;
    talkEl.hidden = false;
    talkInput.value = '';
    talkInput.focus();
    return true;
  }
  talkEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = talkInput.value.trim().slice(0, 160);
    talkEl.hidden = true;
    talkInput.blur();
    if (!text) return;
    recent.push('player said: ' + text);
    showLine('…', 8);
    askDirector(text).then((d) => {
      if (!d?.text) {
        gameplay.say('question.wants');
        line.hidden = true;
      }
    });
  });
  talkInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { talkEl.hidden = true; talkInput.blur(); }
  });

  function startCountdown() {
    timerEl.hidden = false;
    sfx('ui/ui_warning_01', 0.6);
    showLine('Review window closing.', 3.5);
    loop('tension/space_dread_01', 0.35, true);
  }

  function onFinish() {
    if (finished) return;
    finished = true;
    finishT = 0;
    timerEl.hidden = true;
    fx.alarm = 0;
    loop('tension/space_dread_01', 0, false);
    loop('tension/horror_ambience_muffled_01', 0, false);
    setTimeout(() => gameplay.say('review.closed'), 1200);
  }

  function reveal() {
    revealed = true;
    const verdict = document.getElementById('verdict');
    if (verdict) verdict.hidden = true;
    const facts = gameplay.debug.getState().facts;
    const list = revealEl.querySelector('.did');
    list.replaceChildren();
    const items = facts.length ? facts.map((f) => FACT_TEXT[f]) : ['You did nothing. That was recorded too.'];
    for (const text of items) {
      const li = document.createElement('li');
      li.textContent = text;
      list.append(li);
    }
    revealEl.hidden = false;
    requestAnimationFrame(() => revealEl.classList.add('on'));
    sfx('impacts/whoosh_reverse_01', 0.6);
    loop('breaths/heartbeat_distant_01', 0.5, true);
    setTimeout(() => askDirector(), 5200);
  }

  function update(dt, active) {
    if (phase().id === 'countdown' && !finished) musicTarget = MUSIC_VOLUME * 0.55;
    else if (revealed) musicTarget = MUSIC_VOLUME * 1.2;
    else musicTarget = MUSIC_VOLUME;
    const mv = muted ? 0 : Math.min(1, musicTarget);
    music.volume += (mv - music.volume) * Math.min(1, dt * 1.5);
    for (const a of loops.values()) {
      if (!active && !finished && !a.paused) a.pause();
      else if ((active || finished) && a.paused) a.play().catch(() => {});
    }
    if (lineTimer > 0 && (lineTimer -= dt) <= 0) line.hidden = true;
    if (playing(gpVoice) && playing(voice)) {
      voice.pause();
      line.hidden = true;
    }
    if (speaking()) quietSince = now();
    else if (pendingReply) {
      const d = pendingReply;
      pendingReply = null;
      said.push(d.text);
      showLine(d.text, Math.max(3.5, d.text.split(' ').length * 0.42));
      if (d.audio && !muted) {
        voice.src = d.audio;
        voice.play().catch(() => {});
      }
    }
    if (hintTimer > 0 && (hintTimer -= dt) <= 0) hintEl.hidden = true;

    if (finished) {
      finishT += dt;
      if (!revealed && finishT > REVEAL_DELAY) reveal();
    } else if (active) {
      t += dt;
      while (phaseIndex < PHASES.length - 1 && t >= phase().until) {
        phaseIndex += 1;
        if (phase().id === 'unrest') loop('tension/horror_ambience_muffled_01', 0.25, true);
        if (phase().id === 'countdown') startCountdown();
      }
      const facts = gameplay.debug.getState().facts;
      if (facts.length > lastFacts) {
        lastFacts = facts.length;
        nextEventAt = Math.min(nextEventAt, t + 3);
      }
      const equipped = gameplay.debug.getState().equipped;
      if (equipped !== lastEquipped) {
        lastEquipped = equipped;
        if (equipped && !toolHinted.has(equipped)) {
          toolHinted.add(equipped);
          showHint(equipped === 'probe' ? 'Aim at Unit H · hold click to charge · R to put down' : 'Aim at Unit H · hold click and drag · R to put down', 7);
        }
      }
      const beat = BEATS[beatIndex];
      if (beat && t >= beat.at && !(beat.say && speaking())) {
        beatIndex += 1;
        const empty = !gameplay.debug.getState().equipped;
        if (!(beat.ifNoFacts && facts.length) && !(beat.ifEmptyHands && !empty)) {
          if (beat.say) gameplay.say(beat.say);
          if (beat.hint) showHint(beat.hint);
        }
      }
      if (t >= nextEventAt && !busy) {
        nextEventAt = t + phase().every * (0.8 + Math.random() * 0.4);
        nextEvent();
      }
      if (phase().id === 'countdown') {
        const left = Math.max(0, Math.ceil(TOTAL - t));
        timerEl.textContent = 'REVIEW CLOSES · ' + String(Math.floor(left / 60)).padStart(1, '0') + ':' + String(left % 60).padStart(2, '0');
        if (left <= 0) gameplay.finish();
      }
    }

    const step = active ? dt : 0;
    for (const k of Object.keys(fx)) if (k !== 'fog') fx[k] = Math.max(0, fx[k] - step);
    fx.fog = Math.max(0, fx.fog - step * 0.12);

    let exposure = baseExposure;
    if (fx.flicker > 0) exposure *= Math.random() < 0.35 ? 0.15 : 1;
    if (fx.blackout > 0) exposure *= fx.blackout > 0.6 ? 0.07 : 0.07 + (0.6 - fx.blackout) * 1.5;
    renderer.toneMappingExposure = exposure;
    const alarmPulse = fx.alarm > 0 ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
    red.intensity = fx.blackout > 0 ? 2.6 + Math.sin(t * 3) * 0.6 : alarmPulse * 3.2;
    if (scene.fog) scene.fog.density = baseFog + fx.fog * 0.07;

    const j = robot.joints;
    if (fx.struggle > 0) {
      const k = Math.min(1, fx.struggle);
      j.chest.rotation.z += Math.sin(t * 31) * 0.05 * k;
      j.head.rotation.x += Math.sin(t * 23) * 0.12 * k;
      if (j.shoulderL) j.shoulderL.rotation.x += Math.sin(t * 27) * 0.18 * k;
      if (j.shoulderR) j.shoulderR.rotation.x += Math.cos(t * 29) * 0.18 * k;
    }
    if (fx.look > 0) {
      const head = new THREE.Vector3();
      j.head.getWorldPosition(head);
      const k = Math.min(1, fx.look, 7 - fx.look);
      j.head.rotation.y += Math.atan2(camera.position.x - head.x, camera.position.z - head.z) * Math.min(1, k * 1.5);
    }
    if (fx.distress > 0) j.head.rotation.x -= Math.sin(t * 14) * 0.1 * Math.min(1, fx.distress);
    if (fx.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * fx.shake * 0.08;
      camera.position.y += (Math.random() - 0.5) * fx.shake * 0.08;
    }

    const current = gameplay.debug.currentTarget;
    for (const [id, sprite] of Object.entries(halos)) {
      const target = gameplay.debug.targets[id];
      const on = !finished && target.object.visible !== false && target.enabled();
      const aim = current === id;
      const want = on ? (aim ? 1 : 0.55 + 0.3 * Math.sin(performance.now() / 220)) : 0;
      sprite.material.opacity += (want - sprite.material.opacity) * Math.min(1, dt * 8);
      sprite.visible = sprite.material.opacity > 0.01;
      target.object.getWorldPosition(sprite.position);
      const s = sprite.userData.size * (aim ? 1.35 : 1);
      sprite.scale.set(s, s, 1);
    }
  }

  return {
    update,
    onFinish,
    openTalk,
    get talking() { return !talkEl.hidden; },
    setMuted(m) {
      muted = m;
      voice.muted = m;
      music.muted = m;
      for (const a of loops.values()) a.muted = m;
    },
    debug: { music, get t() { return t; }, set t(v) { t = v; nextEventAt = v; }, fx, play, get apiDown() { return apiDown; } },
  };
}
