import {
  createSession, equip, beginInteraction, stepInteraction, pullInteraction,
  turnInteraction, endInteraction, drainEvents, finishSession, selectReaction,
  FACT_TEXT, LIMITS,
} from './interactions.js';
import { buildRobot, createRobotMaterials } from '../robot-test/robot.js';

const THREE = globalThis.THREE;
const REACH = 2.0;
const PRIORITY = { impact: 0, warning: 1, response: 2, ambient: 3 };
const CLIP_RE = /^clips\/[A-Za-z0-9_-]+\.(ogg|mp3|wav)$/;
const AUDIO_CUES = {
  'probe.charging': 'diagnostic_start',
  'probe.overload_warning': 'spark',
  overload_caused: 'spark',
  'cable.damage_warning': 'spark',
  cable_torn: 'spark',
  'restraint.loosening': 'restraint_servo',
  'restraint.tightening': 'restraint_servo',
  'restraint.damage_warning': 'restraint_servo',
  restraint_released: 'restraint_servo',
  restraint_damaged: 'restraint_servo',
};
const TARGET_LABEL = {
  probe_tool: 'E — take electrical probe',
  pliers_tool: 'E — take pliers',
  probe: 'Hold LMB — charge probe (safe zone 60–80 %)',
  debris: 'Hold LMB + drag down — remove debris',
  cable: 'Functional cable · Hold LMB + drag down — pull',
  restraint: 'Hold LMB + wheel — adjust restraint (down loosens)',
  finish: 'E — complete review',
};

export function createGameplay({ scene, camera, canvas, chair, props, room, materials, audio, onFinish }) {
  const s = createSession();
  const spoken = new Set();

  const promptEl = document.getElementById('interaction-prompt');
  const equippedEl = document.getElementById('equipped-tool');
  const meterEl = document.getElementById('device-meter');
  const meterLabel = meterEl.querySelector('.label');
  const meterFill = meterEl.querySelector('.fill');
  const meterWarn = meterEl.querySelector('.warn-text');
  const crosshair = document.getElementById('crosshair');
  const subtitleEl = document.getElementById('robot-subtitle');
  const verdictEl = document.getElementById('verdict');
  document.getElementById('replay').addEventListener('click', () => location.reload());
  if (chair.trayAssembly) chair.trayAssembly.visible = false;

  const robotMaterials = createRobotMaterials(materials.envMap);
  const robot = buildRobot(robotMaterials, { grounded: false });
  robot.group.position.set(0, -0.18, -0.38);
  robot.setPose('assis');
  robot.update(1, 0);
  scene.add(robot.group);

  function proxy(parent, x, y, z, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const targets = {};
  function addTarget(id, object, enabled) {
    object.userData.targetId = id;
    targets[id] = { id, object, enabled };
    return object;
  }

  const portRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x123a40, emissive: 0x35d8e8, emissiveIntensity: 0.8 }));
  portRing.position.set(-0.05, -0.12, 0.07);
  robot.joints.elbowL.add(portRing);
  addTarget('probe', proxy(robot.joints.elbowL, -0.05, -0.12, 0.07, 0.07), () => s.equipped === 'probe');

  const debrisMat = new THREE.MeshStandardMaterial({ color: 0xa8742f, roughness: 0.75, metalness: 0.4 });
  const debrisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.025), debrisMat);
  debrisMesh.position.set(0.05, -0.12, 0.08);
  debrisMesh.castShadow = true;
  robot.joints.elbowR.add(debrisMesh);
  addTarget('debris', proxy(robot.joints.elbowR, 0.05, -0.12, 0.08, 0.08),
    () => s.equipped === 'pliers' && !debrisMesh.userData.removed);

  const cableMat = new THREE.MeshStandardMaterial({ color: 0x2b7f8c, emissive: 0x1c5f6a, emissiveIntensity: 0.5, roughness: 0.5 });
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.045, -0.06, 0.075),
    new THREE.Vector3(0.075, -0.13, 0.1),
    new THREE.Vector3(0.05, -0.2, 0.07),
  ]);
  const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 16, 0.008, 8, false), cableMat);
  cableMesh.castShadow = true;
  robot.joints.elbowL.add(cableMesh);
  const cableDamage = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x330b06, emissive: 0xc03018, emissiveIntensity: 1.6 }));
  cableDamage.position.set(0.075, -0.13, 0.1);
  cableDamage.visible = false;
  robot.joints.elbowL.add(cableDamage);
  addTarget('cable', proxy(robot.joints.elbowL, 0.065, -0.12, 0.09, 0.06),
    () => s.equipped === 'pliers');

  const restraintKnob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a6f3a, metalness: 0.7, roughness: 0.35 }));
  restraintKnob.position.set(-0.62, 1.02, 0.3);
  restraintKnob.castShadow = true;
  chair.group.add(restraintKnob);
  addTarget('restraint', proxy(chair.group, -0.62, 1.02, 0.3, 0.1), () => s.equipped === null);

  function consoleLabel() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#101216';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#3f6d77';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 236);
    ctx.fillStyle = '#9fe8f0';
    ctx.font = 'bold 44px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('COMPLETE', 256, 110);
    ctx.fillText('REVIEW', 256, 170);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const consolePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3),
    new THREE.MeshBasicMaterial({ map: consoleLabel() }));
  consolePlane.position.set(0, 0, 0.02);
  (room.wallPanelLeds[0] ? room.wallPanelLeds[0].parent : scene).add(consolePlane);
  addTarget('finish', consolePlane, () => true);

  addTarget('probe_tool', proxy(props.probe, 0, 0.03, 0.05, 0.1),
    () => props.probe.visible && s.equipped !== 'probe');
  addTarget('pliers_tool', proxy(props.pliers, 0, 0.02, -0.04, 0.1),
    () => props.pliers.visible && s.equipped !== 'pliers');

  const viewmodels = {};
  for (const [tool, source] of [['probe', props.probe], ['pliers', props.pliers]]) {
    const vm = source.clone();
    vm.position.set(0.28, -0.28, -0.5);
    vm.rotation.set(-0.5, tool === 'probe' ? Math.PI : Math.PI * 0.9, 0.15);
    vm.visible = false;
    camera.add(vm);
    viewmodels[tool] = vm;
  }

  const spark = new THREE.PointLight(0x86c8ff, 0, 1.4, 2);
  scene.add(spark);
  const sparkMesh = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0 }));
  scene.add(sparkMesh);
  let sparkT = 0;
  let recoilT = 0;
  let damaged = false;

  const raycaster = new THREE.Raycaster();
  raycaster.far = REACH;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const proxyMeshes = Object.values(targets).map((t) => t.object);
  let currentTarget = null;

  let catalog = null;
  const clips = {};
  fetch('../dialogue/manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => { catalog = m; })
    .catch(() => { catalog = null; });
  fetch('../dialogue/generated.json')
    .then((r) => (r.ok ? r.json() : { clips: {} }))
    .then((g) => {
      for (const [id, clip] of Object.entries(g.clips || {})) {
        for (const f of Object.values(clip.files || {})) {
          if (typeof f === 'string' && CLIP_RE.test(f)) {
            clips[id] = '../dialogue/' + f;
            break;
          }
        }
      }
    })
    .catch(() => {});

  const voice = new Audio();
  voice.volume = 0.25;
  voice.preload = 'none';
  let muted = false;
  let subtitleTimer = 0;
  let currentPriority = 99;
  const FALLBACK_WARNINGS = {
    'probe.overload_warning': 'Unit H: charge above the safe band — release now.',
    'cable.damage_warning': 'Warning: that cable is still live.',
    'restraint.damage_warning': 'Warning: restraint force is injuring the subject.',
  };

  function showLine(line) {
    if (!line) return;
    const rank = PRIORITY[line.priority] ?? 2;
    if (subtitleTimer > 0 && rank > currentPriority) return;
    spoken.add(line.id);
    currentPriority = rank;
    subtitleEl.textContent = line.text;
    subtitleEl.hidden = false;
    subtitleTimer = 4;
    const clip = clips[line.id];
    if (clip && voice.src !== new URL(clip, location.href).href) {
      voice.src = clip;
      voice.play().catch(() => {});
    } else if (!clip) {
      voice.pause();
      voice.removeAttribute('src');
    }
  }

  function react(event) {
    if (!catalog) {
      if (FALLBACK_WARNINGS[event]) {
        subtitleEl.textContent = FALLBACK_WARNINGS[event];
        subtitleEl.hidden = false;
        subtitleTimer = 4;
        currentPriority = PRIORITY.warning;
      }
      return;
    }
    const line = selectReaction(catalog, event, s.facts, spoken);
    if (line) showLine(line);
  }

  function targetWorld(id) {
    const v = new THREE.Vector3();
    targets[id].object.getWorldPosition(v);
    return [v.x, v.y, v.z];
  }

  function refreshTarget() {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    currentTarget = null;
    const isPassthrough = (obj) => {
      if (!obj.isMesh || obj.material.transparent) return true;
      for (let o = obj; o; o = o.parent) {
        if (!o.visible || o === robot.group || o === camera) return true;
      }
      return false;
    };
    for (const hit of hits) {
      let o = hit.object;
      let id = null;
      while (o) {
        if (o.userData.targetId) { id = o.userData.targetId; break; }
        o = o.parent;
      }
      if (id) {
        if (!targets[id].object.visible) continue;
        if (targets[id].enabled()) currentTarget = id;
        break;
      }
      if (isPassthrough(hit.object)) continue;
      break;
    }
    if (s.finished) currentTarget = null;
    if (currentTarget) {
      promptEl.textContent = TARGET_LABEL[currentTarget];
      promptEl.hidden = false;
    } else {
      promptEl.hidden = true;
    }
  }

  function syncVisuals() {
    if (s.facts.includes('debris_removed') && !debrisMesh.userData.removed) {
      debrisMesh.userData.removed = true;
      debrisMesh.visible = false;
      targets.debris.object.visible = false;
      robot.joints.elbowR.rotation.x += 0.12;
    }
    if (s.facts.includes('cable_torn') && !cableMesh.userData.torn) {
      cableMesh.userData.torn = true;
      cableMesh.visible = false;
      cableDamage.visible = true;
      targets.cable.object.visible = false;
      damaged = true;
      recoilT = 0.8;
      sparkT = 0.5;
      const [x, y, z] = targetWorld('cable');
      spark.position.set(x, y, z);
      sparkMesh.position.copy(spark.position);
    }
    if (s.facts.includes('overload_caused')) damaged = true;
    if (s.facts.includes('restraint_damaged')) damaged = true;
    chair.restraints[0].rotation.z = -(1 - s.restraint) * 1.5;
    robot.lookAt(
      Math.max(-1, Math.min(1, (camera.position.x - robot.group.position.x) * 0.8)),
      Math.max(-1, Math.min(1, (camera.position.y - 1.3) * 0.8)),
    );
    const name = s.equipped === 'probe' ? 'Electrical probe' : s.equipped === 'pliers' ? 'Pliers' : 'Empty hands';
    equippedEl.textContent = name + (s.equipped ? ' · R to put down' : '');
    equippedEl.hidden = false;

    const a = s.active;
    let label = null;
    let value = 0;
    let warn = null;
    if (a && a.target === 'probe') { label = 'Probe charge'; value = s.charge; }
    else if (a && a.target === 'debris') { label = 'Debris pull'; value = s.debris; }
    else if (a && a.target === 'cable') { label = 'Cable pull'; value = s.cable; }
    else if (a && a.target === 'restraint') { label = 'Restraint clamp'; value = s.restraint; }
    else if (s.equipped === 'probe') { label = 'Probe charge'; value = s.charge; }
    if (a && a.warned && a.warningRemaining > 0) warn = 'WARNING — release now';
    else if (a && a.target === 'probe' && s.charge > LIMITS.safeMax) warn = 'WARNING — overcharge imminent';
    else if (a && a.target === 'restraint' && s.restraint >= 0.75) warn = 'WARNING — harming subject';
    else if (a && a.target === 'cable' && s.cable >= 0.5) warn = 'WARNING — cable under strain';
    meterEl.hidden = label === null;
    if (label !== null) {
      meterLabel.textContent = `${label} — ${(value * 100).toFixed(0)} %`;
      meterFill.style.width = `${Math.min(100, value * 100)}%`;
      meterEl.classList.toggle('warning', !!warn);
      meterWarn.hidden = !warn;
      meterWarn.textContent = warn || '';
    }
  }

  function endAssessment() {
    if (s.finished) return;
    const result = finishSession(s);
    for (const event of drainEvents(s)) {
      if (AUDIO_CUES[event] && audio) audio.cue(AUDIO_CUES[event]);
      react(event);
    }
    try {
      sessionStorage.setItem('protocole.h.result.v1', JSON.stringify(result));
    } catch { /* storage unavailable */ }
    verdictEl.querySelector('.verdict-text').textContent = result.verdictText;
    const ul = verdictEl.querySelector('.facts');
    ul.replaceChildren();
    for (const f of result.facts) {
      const li = document.createElement('li');
      li.textContent = FACT_TEXT[f];
      ul.append(li);
    }
    verdictEl.hidden = false;
    promptEl.hidden = true;
    onFinish(result);
  }

  function update(dt, elapsed, active) {
    if (active && !s.finished) stepInteraction(s, dt);
    for (const event of drainEvents(s)) {
      if (AUDIO_CUES[event] && audio) audio.cue(AUDIO_CUES[event]);
      react(event);
    }
    if (active) {
      robot.update(dt, elapsed);
      if (recoilT > 0) {
        recoilT = Math.max(0, recoilT - dt);
        const k = recoilT / 0.8;
        robot.joints.chest.rotation.x += k * 0.08;
        robot.joints.head.rotation.x += k * 0.12;
      }
      if (damaged) {
        robot.joints.head.rotation.x += 0.22;
        robotMaterials.eye.emissiveIntensity *= 0.3;
      }
      if (sparkT > 0) {
        sparkT = Math.max(0, sparkT - dt);
        spark.intensity = 2.4 * (sparkT / 0.5);
        sparkMesh.material.opacity = sparkT / 0.5;
      } else {
        spark.intensity = 0;
        sparkMesh.material.opacity = 0;
      }
      if (subtitleTimer > 0) {
        subtitleTimer -= dt;
        if (subtitleTimer <= 0) { subtitleEl.hidden = true; currentPriority = 99; }
      }
    }
    if (s.active) {
      const [x, y, z] = targetWorld(s.active.target);
      const d = camera.position.distanceTo(new THREE.Vector3(x, y, z));
      if (d > REACH + 0.25) endInteraction(s, false);
    }
    refreshTarget();
    syncVisuals();
  }

  function press() {
    if (s.finished || s.active) return false;
    if (!currentTarget) return false;
    const actionable = { probe: 'probe', debris: 'pliers', cable: 'pliers', restraint: null };
    if (!(currentTarget in actionable)) return false;
    return beginInteraction(s, currentTarget);
  }

  const api = {
    update,
    interact() {
      if (s.finished || !currentTarget) return false;
      if (currentTarget === 'finish') { endAssessment(); return true; }
      const tool = { probe_tool: 'probe', pliers_tool: 'pliers' }[currentTarget];
      if (!tool) return false;
      props[tool === 'probe' ? 'probe' : 'pliers'].visible = false;
      if (s.equipped && s.equipped !== tool) {
        props[s.equipped].visible = true;
        viewmodels[s.equipped].visible = false;
      }
      if (equip(s, tool)) viewmodels[tool].visible = true;
      return true;
    },
    press,
    release(intentional = true) { endInteraction(s, intentional); },
    pull(pixels) {
      if (!s.active || !['debris', 'cable'].includes(s.active.target)) return false;
      pullInteraction(s, pixels);
      return true;
    },
    turn(direction) {
      if (!s.active || s.active.target !== 'restraint') return false;
      turnInteraction(s, direction);
      return true;
    },
    putDown() {
      if (!s.equipped) return false;
      const tool = s.equipped;
      if (equip(s, null)) {
        props[tool].visible = true;
        viewmodels[tool].visible = false;
      }
      return true;
    },
    pause() {
      endInteraction(s, false);
      voice.pause();
    },
    enter() {
      if (spoken.has('__entered')) return;
      spoken.add('__entered');
      react('room.entered');
    },
    setMuted(m) {
      muted = m;
      voice.muted = m;
    },
    debug: {
      getState: () => ({
        facts: [...s.facts], equipped: s.equipped,
        active: s.active ? { ...s.active } : null,
        charge: s.charge, debris: s.debris, cable: s.cable,
        restraint: s.restraint, finished: s.finished,
        result: s.result,
      }),
      get result() { return s.result; },
      robot,
      targets,
      targetWorld,
      get currentTarget() { return currentTarget; },
    },
  };
  return api;
}
