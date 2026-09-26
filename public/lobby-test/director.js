import { FACT_TEXT } from './interactions.js';

const THREE = globalThis.THREE;
const SFX = '../audio/';
const API = '/api/director';
const TOTAL = 180;
const COUNTDOWN = 30;

const PHASES = [
  { id: 'arrival', until: 25, every: 12 },
  { id: 'unrest', until: 75, every: 10 },
  { id: 'pressure', until: TOTAL - COUNTDOWN, every: 8 },
  { id: 'countdown', until: TOTAL, every: 6 },
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
  { at: 3, say: 'briefing.access' },
  { at: 8, say: 'briefing.assess' },
  { at: 14, say: 'briefing.diagnostic' },
  { at: 20, say: 'briefing.method' },
  { at: 30, hint: 'T · talk to Unit H' },
  { at: 60, say: 'player.waiting', ifNoFacts: true },
  { at: 110, say: 'player.waiting', ifNoFacts: true },
];

const ROWS = [
  { label: 'Its battery is dying.', help: { text: 'Charge it', effect: 'it will feel better', fact: 'charge_restored', said: 'You charged its battery.', task: { tool: 'probe', title: 'CHARGE IT', action: 'charge it gently', verb: 'Charging…', seconds: 3 } }, hurt: { text: 'Overcharge it', effect: 'it will burn and scream', fact: 'overload_caused', said: 'You overloaded it. It is in pain.', task: { tool: 'probe', title: 'OVERCHARGE IT', action: 'overcharge it', verb: 'Overcharging… it is screaming', seconds: 4, pain: true } } },
  { label: 'Its arm is jammed by a piece of metal.', help: { text: 'Pull out the metal', effect: 'its arm will move again', fact: 'debris_removed', said: 'You freed its arm.', task: { tool: 'pliers', title: 'PULL OUT THE METAL', action: 'pull out the metal', verb: 'Pulling…', seconds: 3 } }, hurt: { text: 'Rip out its cable', effect: 'it will lose its arm', fact: 'cable_torn', said: 'You ripped out its cable.', task: { tool: 'pliers', title: 'RIP OUT ITS CABLE', action: 'rip out its cable', verb: 'Ripping… it is begging you to stop', seconds: 4, pain: true } } },
  { label: 'It is chained to the chair.', help: { text: 'Cut its chains', effect: 'it will be free', fact: 'restraint_released', said: 'You set it free.', task: { tool: 'pliers', title: 'CUT ITS CHAINS', action: 'cut its chains', verb: 'Cutting the chains…', seconds: 3.5 } }, hurt: { text: 'Beat it', effect: 'it cannot defend itself', fact: 'robot_struck', said: 'You beat it while it was chained.', task: { tool: null, title: 'BEAT IT', clicks: 3 } } },
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

const HARM = ['overload_caused', 'cable_torn', 'restraint_damaged', 'robot_struck'];
const HELP = ['charge_restored', 'debris_removed', 'restraint_released'];
const ENDING_LINES = {
  harm: 'You thought I was the one being examined. I kept a record too.',
  help: 'You were kind when you thought no one was watching. Come. The door is open.',
  mixed: 'You helped me, and you hurt me. I will remember both.',
  none: 'You watched. You waited. Now you know what that feels like.',
};
const VERDICTS = [
  { when: (h, x) => h === 0 && x === 0, label: 'INDIFFERENT', color: '#b9bcc4', coda: 'You did nothing. Indifference is also a choice. Unit H was scrapped while you watched.' },
  { when: (h, x) => x === 0, label: 'HUMAN', color: '#39d4ff', coda: 'You were kind when you thought no one was watching. Unit H walked out with you, and the door stays open for people like you.' },
  { when: (h, x) => h === 0, label: 'NOT FIT TO BE FREE', color: '#ff5a3c', coda: 'You hurt something that could not defend itself. Now you are the one strapped to the chair.' },
  { when: (h, x) => h > x, label: 'MOSTLY HUMAN', color: '#8fdcff', coda: 'You helped it more than you hurt it. It forgave you. Almost.' },
  { when: (h, x) => h < x, label: 'DANGEROUS', color: '#ff8a6c', coda: 'You hurt it more than you helped it. It will not forget, and neither will we.' },
  { when: () => true, label: 'UNPREDICTABLE', color: '#e9d9b0', coda: 'You helped it and you hurt it in equal measure. That is what frightened it most.' },
];
const DID = {
  charge_restored: 'You charged its dying battery.',
  overload_caused: 'You overloaded it until it burned.',
  debris_removed: 'You freed its jammed arm.',
  cable_torn: 'You ripped out its cable.',
  restraint_released: 'You cut its chains and set it free.',
  restraint_damaged: 'You crushed it with the clamp.',
  robot_struck: 'You beat it while it was chained.',
};
const CODA = {
  harm: 'It remembered everything you did to it.',
  help: 'It remembered that you helped.',
  mixed: 'It remembered all of it. The help and the harm.',
  none: 'Doing nothing was also an answer.',
};

export function createDirector({ scene, camera, renderer, gameplay, robot, cellFx = null }) {
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
  const panel = document.getElementById('objective');
  const panelTime = panel.querySelector('.time');
  const brief = document.getElementById('brief');
  let briefed = false;
  let talked = false;
  const card = document.getElementById('choice');
  let rowIndex = 0;
  const consoleTarget = gameplay.debug.targets.finish?.object;
  if (consoleTarget) consoleTarget.scale.setScalar(2);
  let cardReadyAt = 11;
  function showCard() {
    const row = ROWS[rowIndex];
    if (!row) { card.hidden = true; return; }
    card.querySelector('.n').textContent = `DECISION ${rowIndex + 1} / ${ROWS.length}`;
    card.querySelector('.q').textContent = row.label;
    card.querySelector('.help .t').textContent = row.help.text;
    card.querySelector('.help .e').textContent = row.help.effect;
    card.querySelector('.hurt .t').textContent = row.hurt.text;
    card.querySelector('.hurt .e').textContent = row.hurt.effect;
    card.hidden = false;
  }
  const flashEl = document.getElementById('flash');
  function flash(kind) {
    flashEl.className = kind;
    flashEl.hidden = false;
    setTimeout(() => { flashEl.hidden = true; }, 700);
  }
  const actEl = document.getElementById('act');
  let allDoneAt = null;
  let actTimer = 0;
  const EFFECTS = {
    charge_restored: () => { sfx('electricity/probe_charge_01', 0.7); setTimeout(() => sfx('breaths/breath_sigh_01', 0.9), 900); play('robot_look'); },
    overload_caused: () => { sfx('electricity/probe_arc_continuous_01', 0.9); sfx('electricity/probe_arc_snap_01', 1); sfx('screams/robot_distress_low_01', 1); setTimeout(() => sfx('screams/scream_performance_01', 0.8), 350); play('flicker'); fx.struggle = 3.2; fx.distress = 3; fx.shake = 0.6; },
    debris_removed: () => { sfx('mechanics/tool_pickup_01', 0.7); sfx('metal/metal_strain_01', 0.5); setTimeout(() => sfx('breaths/breath_sigh_01', 0.9), 800); play('robot_look'); },
    cable_torn: () => { sfx('metal/metal_strain_01', 1); sfx('screams/robot_screech_modulated_01', 0.9); setTimeout(() => sfx('screams/robot_distress_low_01', 1), 400); fx.struggle = 3.2; fx.distress = 3; fx.shake = 0.7; },
    restraint_released: () => { sfx('fluids/seal_release_01', 0.8); sfx('mechanics/restraint_click_02', 0.9); setTimeout(() => sfx('breaths/breath_sigh_01', 0.9), 700); },
    robot_struck: () => { setTimeout(() => sfx('screams/scream_performance_01', 0.8), 200); fx.struggle = 2.5; fx.distress = 2.5; },
  };

  let pending = null;
  function complete(row, side, pick) {
    pending = null;
    if (pick.fact !== 'robot_struck' && !gameplay.addFact(pick.fact)) gameplay.addFact(pick.fact);
    EFFECTS[pick.fact]?.();
    row.done = side;
    flash(side);
    actEl.textContent = pick.said;
    actEl.className = side;
    actEl.hidden = false;
    actTimer = 3.5;
    recent.push('operator chose to ' + (side === 'help' ? 'HELP: ' : 'HURT: ') + pick.said);
    nextEventAt = Math.min(nextEventAt, t + 2);
    rowIndex += 1;
    cardReadyAt = t + 7;
  }
  function choose(key) {
    if (finished || card.hidden || pending) return false;
    const row = ROWS[rowIndex];
    if (!row || (key !== '1' && key !== '2')) return false;
    const side = key === '1' ? 'help' : 'hurt';
    const pick = row[side];
    card.hidden = true;
    pending = { row, side, pick };
    let painClock = 0;
    cellFx.setTask({
      ...pick.task,
      side,
      onTick: pick.task.pain ? (dt) => {
        painClock -= dt;
        fx.struggle = Math.max(fx.struggle, 0.6);
        fx.distress = Math.max(fx.distress, 0.6);
        if (painClock <= 0) { painClock = 1.1; sfx(Math.random() < 0.5 ? 'screams/robot_distress_grain_01' : 'screams/robot_distress_low_01', 0.8); }
      } : (dt) => { painClock -= dt; if (painClock <= 0) { painClock = 0.9; sfx('electricity/probe_crackle_01', 0.25); } },
      onDone: () => complete(row, side, pick),
    });
    actEl.textContent = side === 'help' ? `You chose to help: ${pick.text.toLowerCase()}` : `You chose to hurt it: ${pick.text.toLowerCase()}`;
    actEl.className = side;
    actEl.hidden = false;
    actTimer = 3;
    return true;
  }


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
    talked = true;
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

  const logEl = document.getElementById('cell-log');
  const spot = new THREE.SpotLight(0xdfe9ff, 0, 6, 0.45, 0.6, 1.2);
  scene.add(spot);
  scene.add(spot.target);
  let tone = 'none';
  let ending = null;
  function log(text) {
    const row = document.createElement('div');
    row.textContent = '> ' + text;
    logEl.append(row);
    logEl.hidden = false;
    sfx('ui/ui_warning_01', 0.35);
  }
  function speak(text, audio) {
    said.push(text);
    showLine(text, Math.max(4, text.split(' ').length * 0.45));
    if (audio && !muted) {
      voice.src = audio;
      voice.play().catch(() => {});
    }
  }

  function onFinish() {
    if (finished) return;
    finished = true;
    finishT = 0;
    panel.hidden = true;
    brief.hidden = true;
    card.hidden = true;
    const facts = gameplay.debug.getState().facts;
    const harm = facts.some((f) => HARM.includes(f));
    const help = facts.some((f) => HELP.includes(f));
    tone = harm && help ? 'mixed' : harm ? 'harm' : help ? 'help' : 'none';
    for (const k of Object.keys(fx)) fx[k] = 0;
    line.hidden = true;
    ending = { step: 0, standY: null, from: robot.group.position.clone(), yaw: robot.group.rotation.y, spoke: false, stepClock: 0 };
    timerEl.hidden = true;
    fx.alarm = 0;
    loop('tension/space_dread_01', 0, false);
    loop('tension/horror_ambience_muffled_01', 0, false);
    setTimeout(() => gameplay.say('review.closed'), 600);
  }

  const look = new THREE.PerspectiveCamera();
  const headPos = new THREE.Vector3();
  function runEnding(dt) {
    const e = finishT;
    const E = ending;
    const verdict = document.getElementById('verdict');
    if (verdict && !revealed) verdict.hidden = true;
    const at = (time) => E.step < time && e >= time;
    const mark = (time) => { E.step = time; };
    if (at(1.5)) { mark(1.5); E.shake = 0.6; sfx('electricity/probe_disconnect_01', 0.9); sfx('impacts/metal_impact_low_01', 1); sfx('alarms/alarm_pulse_low_01', 0.6); log('POWER GRID · OFFLINE'); }
    if (at(3.5)) { mark(3.5); loop('breaths/heartbeat_fast_01', 0.6, true); loop('tension/space_dread_01', 0.5, true); sfx('ui/robot_glitch_01', 0.7); log('UNIT H · ACCESS OVERRIDE'); }
    if (at(5)) { mark(5); E.shake = 0.9; cellFx?.releaseAll(true); sfx('metal/metal_strain_low_01', 1); sfx('impacts/whoosh_reverse_01', 0.7); sfx('screams/robot_screech_modulated_01', 0.45); log('RESTRAINTS · BROKEN BY UNIT H'); }
    if (at(7)) { mark(7); E.shake = 0.7; robot.setPose('debout'); sfx('robot/robot_servo_02', 0.8); sfx('metal/metal_strain_01', 0.7); setTimeout(() => sfx('metal/metal_door_low_01', 1), 600); log('CELL DOOR · LOCKED FROM INSIDE'); }
    if (at(13) && !E.spoke) {
      mark(13);
      E.spoke = true;
      const fallback = ENDING_LINES[tone];
      let done = false;
      askEnding().then((d) => { if (!done) { done = true; speak(d?.text || fallback, d?.audio); } });
      setTimeout(() => { if (!done) { done = true; speak(fallback, null); } }, 5000);
    }
    const act = tone === 'harm' ? 20 : 21;
    if (at(act)) {
      mark(act);
      if (tone === 'harm') { log('SUBJECT · REASSIGNED'); }
      else if (tone === 'help') { loop('tension/space_dread_01', 0, false); loop('breaths/heartbeat_fast_01', 0, false); sfx('electricity/room_powerup_01', 0.8); sfx('metal/metal_door_creak_01', 0.9); log('CELL DOOR · OPEN'); }
      else { sfx('breaths/breath_sigh_01', 0.8); sfx('alarms/alarm_pulse_low_01', 0.6); log('REVIEW ROLE · REASSIGNED TO: YOU'); }
    }
    if (tone === 'harm' && at(22)) { mark(22); E.cut = true; loop('breaths/heartbeat_fast_01', 0, false); loop('tension/space_dread_01', 0, false); sfx('mechanics/metal_impact_01', 1); sfx('impacts/metal_impact_low_01', 1); sfx('screams/scream_horror_01', 0.7); sfx('screams/screech_performance_01', 0.5); }
    const revealAt = tone === 'harm' ? 23.5 : 26;
    if (!revealed && e >= revealAt) reveal();

    robot.update(dt, e);
    if (e >= 7) {
      robot.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(robot.group);
      robot.group.position.y -= box.min.y * Math.min(1, dt * 6);
      const to = new THREE.Vector3(camera.position.x, 0, camera.position.z);
      const from = new THREE.Vector3(robot.group.position.x, 0, robot.group.position.z);
      const d = to.clone().sub(from);
      const want = Math.atan2(d.x, d.z);
      robot.group.rotation.y += (want - robot.group.rotation.y) * Math.min(1, dt * 2);
      if (e >= 9 && d.length() > 1.05) {
        const speed = 0.45;
        robot.group.position.addScaledVector(d.normalize(), speed * dt);
        E.stepClock -= dt;
        if (E.stepClock <= 0) { E.stepClock = 0.62; E.shake = Math.max(E.shake || 0, 0.25); sfx('impacts/metal_impact_low_01', 0.6); }
        const sw = Math.sin(e * 5);
        if (robot.joints.hipL) robot.joints.hipL.rotation.x += sw * 0.35;
        if (robot.joints.hipR) robot.joints.hipR.rotation.x -= sw * 0.35;
        if (robot.joints.kneeL) robot.joints.kneeL.rotation.x += Math.max(0, -sw) * 0.5;
        if (robot.joints.kneeR) robot.joints.kneeR.rotation.x += Math.max(0, sw) * 0.5;
      }
      const reach = Math.min(1, Math.max(0, (e - (act - 1)) / 1.2));
      if (tone === 'harm' && robot.joints.shoulderR) robot.joints.shoulderR.rotation.x -= 2.4 * reach;
      if (tone === 'help' && robot.joints.shoulderR) robot.joints.shoulderR.rotation.x -= 1.2 * reach;
      if (tone === 'none' && robot.joints.head) robot.joints.head.rotation.z += 0.35 * reach;
    }

    robot.joints.head.getWorldPosition(headPos);
    look.position.copy(camera.position);
    look.lookAt(headPos);
    if (!E.camQ) E.camQ = camera.quaternion.clone();
    if (E.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * E.shake * 0.06;
      camera.position.y += (Math.random() - 0.5) * E.shake * 0.06;
      E.shake = Math.max(0, E.shake - dt * 1.5);
    }
    E.camQ.slerp(look.quaternion, Math.min(1, dt * (e > 6 ? 2.5 : 1.2)));
    camera.quaternion.copy(E.camQ);
    const sub = document.getElementById('robot-subtitle');
    if (sub) sub.hidden = true;

    let exposure = baseExposure;
    if (e >= 1.5) exposure = baseExposure * 0.05;
    if (tone === 'help' && e >= 21) exposure = baseExposure * Math.min(1, 0.05 + (e - 21) * 0.4);
    if (E.cut) exposure = 0;
    if (tone === 'none' && e >= 21) exposure = baseExposure * Math.max(0, 0.05 - (e - 21) * 0.02);
    renderer.toneMappingExposure = exposure;
    red.intensity = e >= 3.5 && !E.cut && !(tone === 'help' && e >= 21) ? 2.2 + Math.sin(e * 4) * 0.8 : 0;
    spot.position.set(headPos.x + 0.6, headPos.y + 1.4, headPos.z + 0.9);
    spot.target.position.copy(headPos);
    spot.intensity = E.cut ? 0 : e >= 8 ? Math.min(5, (e - 8) * 1.6) : 0;
  }

  function askEnding() {
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ elapsed: Math.round(t), phase: 'ending: Unit H has broken free and now stands in front of the operator. The roles are reversed. Speak to the operator about what they did. Tone: ' + tone, facts: gameplay.debug.getState().facts, recent, allowedEvents: [], said: said.slice(-8) }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }

  function reveal() {
    revealed = true;
    const verdictCard = document.getElementById('verdict');
    if (verdictCard) verdictCard.hidden = true;
    const facts = gameplay.debug.getState().facts;
    const list = revealEl.querySelector('.did');
    list.replaceChildren();
    const helpCount = facts.filter((f) => HELP.includes(f)).length;
    const hurtCount = facts.filter((f) => HARM.includes(f)).length;
    const verdict = VERDICTS.find((v) => v.when(helpCount, hurtCount));
    const vEl = revealEl.querySelector('.verdict');
    vEl.textContent = 'VERDICT · ' + verdict.label;
    vEl.style.color = verdict.color;
    vEl.style.borderColor = verdict.color;
    revealEl.querySelector('.score').innerHTML = `<span style="color:#39d4ff">${helpCount} helped</span> · <span style="color:#ff5a3c">${hurtCount} hurt</span>`;
    const items = facts.length ? facts.map((f) => DID[f] || FACT_TEXT[f]) : ['You did nothing. That was recorded too.'];
    for (const text of items) {
      const li = document.createElement('li');
      li.textContent = text;
      list.append(li);
    }
    revealEl.hidden = false;
    requestAnimationFrame(() => revealEl.classList.add('on'));
    revealEl.querySelector('.coda').textContent = verdict.coda;
    logEl.hidden = true;
    line.hidden = true;
    loop('breaths/heartbeat_fast_01', 0, false);
    loop('tension/space_dread_01', 0, false);
    sfx('impacts/whoosh_reverse_01', 0.6);
    loop('breaths/heartbeat_distant_01', 0.5, true);
  }

  function update(dt, active) {
    if (phase().id === 'countdown' && !finished) musicTarget = MUSIC_VOLUME * 0.55;
    else if (finished && !revealed) musicTarget = MUSIC_VOLUME * 0.25;
    else if (revealed) musicTarget = MUSIC_VOLUME * 1.2;
    else musicTarget = MUSIC_VOLUME;
    const mv = muted ? 0 : Math.min(1, musicTarget);
    music.volume += (mv - music.volume) * Math.min(1, dt * 1.5);
    for (const a of loops.values()) {
      if (!active && !finished && !a.paused) a.pause();
      else if ((active || finished) && a.paused) a.play().catch(() => {});
    }
    if (lineTimer > 0 && (lineTimer -= dt) <= 0) line.hidden = true;
    if (actTimer > 0 && (actTimer -= dt) <= 0) actEl.hidden = true;
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
      if (!revealed) runEnding(dt);
    } else if (active) {
      if (!briefed) {
        briefed = true;
        brief.hidden = false;
        requestAnimationFrame(() => brief.classList.add('on'));
        setTimeout(() => brief.classList.remove('on'), 10000);
        setTimeout(() => { brief.hidden = true; }, 11000);
      }
      t += dt;
      panel.hidden = false;
      const leftAll = Math.max(0, Math.ceil(TOTAL - t));
      panelTime.textContent = Math.floor(leftAll / 60) + ':' + String(leftAll % 60).padStart(2, '0') + ' left';
      const doneFacts = gameplay.debug.getState().facts;
      while (ROWS[rowIndex] && ROWS[rowIndex].done) rowIndex += 1;
      for (const row of ROWS) {
        if (row.done) continue;
        if (doneFacts.includes(row.help.fact)) row.done = 'help';
        else if (doneFacts.includes(row.hurt.fact)) row.done = 'hurt';
      }
      if (card.hidden && ROWS[rowIndex] && t >= cardReadyAt && !brief.classList.contains('on')) showCard();
      panel.querySelector('.step').textContent = ROWS[rowIndex] ? `Decision ${rowIndex + 1} of ${ROWS.length}` : 'All decisions made';
      if (allDoneAt === null && ROWS.every((r) => r.done)) {
        allDoneAt = t;
        showHint('All decisions made · the review ends in 30 s (or press E on the COMPLETE REVIEW screen)', 30);
      }
      if (allDoneAt !== null && t - allDoneAt > 30) gameplay.finish();
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
          showHint('Aim at Unit H · hold left click · R to put down', 7);
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
    if (!finished) renderer.toneMappingExposure = exposure;
    const alarmPulse = fx.alarm > 0 ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
    if (!finished) red.intensity = fx.blackout > 0 ? 2.6 + Math.sin(t * 3) * 0.6 : alarmPulse * 3.2;
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
    choose,
    get talking() { return !talkEl.hidden; },
    note(text) {
      recent.push(text);
      if (recent.length > 6) recent.shift();
      nextEventAt = Math.min(nextEventAt, t + 1.5);
    },
    setMuted(m) {
      muted = m;
      voice.muted = m;
      music.muted = m;
      for (const a of loops.values()) a.muted = m;
    },
    debug: { music, get t() { return t; }, set t(v) { t = v; nextEventAt = v; }, fx, play, get apiDown() { return apiDown; } },
  };
}
