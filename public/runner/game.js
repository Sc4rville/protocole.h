import {
  LANES,
  RULES,
  STEP,
  createRun,
  getCourse,
  restartRun,
  stepRun,
} from './simulation.js';
import { createHumanPlaceholder } from './visuals.js';

const THREE = window.THREE;

const MODE_INFO = {
  hell: {
    title: 'Enfer · course',
    instructions:
      'Trois voies, obstacles signalés à l’avance. Saute les barrières, glisse sous les barres, change de voie devant les blocs. La presse centrale a un cycle régulier. Rejoins la sortie.',
  },
  heaven: {
    title: 'Paradis · glisse',
    instructions:
      'Îles suspendues sans poursuite. Les ressorts te relancent au-dessus des vides. Maintiens Espace en l’air pour planer, attrape les chaînes d’énergie, rejoins la sortie.',
  },
};

const stateEl = document.getElementById('runner-state');
const els = {
  menu: document.getElementById('menu'),
  menuInfo: document.getElementById('menu-info'),
  play: document.getElementById('btn-play'),
  hud: document.getElementById('hud'),
  hudMode: document.getElementById('hud-mode'),
  hudDistance: document.getElementById('hud-distance'),
  hudCheckpoint: document.getElementById('hud-checkpoint'),
  hudEnergy: document.getElementById('hud-energy'),
  hudCombo: document.getElementById('hud-combo'),
  pauseBtn: document.getElementById('btn-pause'),
  selectBtns: document.querySelectorAll('.btn-select'),
  dead: document.getElementById('dead-screen'),
  deadRetry: document.getElementById('btn-retry'),
  win: document.getElementById('win-screen'),
  winReplay: document.getElementById('btn-replay'),
  pause: document.getElementById('pause-screen'),
  resume: document.getElementById('btn-resume'),
  status: document.getElementById('live-status'),
  touch: document.getElementById('touch-controls'),
  tLeft: document.getElementById('t-left'),
  tRight: document.getElementById('t-right'),
  tJump: document.getElementById('t-jump'),
  tSlide: document.getElementById('t-slide'),
};

const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

let run = null;
let course = null;
let pendingMode = null;
let paused = false;
let accumulator = 0;
let lastTime = null;
const edge = { left: false, right: false, jump: false, slide: false };
const held = { jump: false };

const container = document.getElementById('game-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 4.5, 9);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', 'Parcours 3D');
container.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xcfe8ff, 1.0);
sun.position.set(20, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 24;
sun.shadow.camera.bottom = -24;
scene.add(sun);

const actorRoot = new THREE.Group();
const actor = createHumanPlaceholder(THREE);
actor.rotation.y = Math.PI;
actorRoot.add(actor);
scene.add(actorRoot);

let worldGroup = null;
let worldRefs = null;

function makeSignTexture(text, fg, bg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg;
  let size = 56;
  ctx.font = `bold ${size}px sans-serif`;
  const wide = ctx.measureText(text).width;
  if (wide > 470) size = Math.floor((size * 470) / wide);
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  return new THREE.CanvasTexture(canvas);
}

function makeSign(text, fg, bg, w = 6, h = 1.5) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: makeSignTexture(text, fg, bg),
      side: THREE.DoubleSide,
    }),
  );
  return mesh;
}

function disposeWorld() {
  if (worldGroup) {
    scene.remove(worldGroup);
    worldGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
    worldGroup = null;
    worldRefs = null;
  }
}

function buildWorld(mode) {
  disposeWorld();
  course = getCourse(mode);
  worldGroup = new THREE.Group();
  worldRefs = { obstacles: [], pads: [], pickups: [], press: null, signs: [] };
  const heaven = mode === 'heaven';

  scene.background = new THREE.Color(heaven ? 0xa8d8f0 : 0x232830);
  scene.fog = new THREE.FogExp2(heaven ? 0xa8d8f0 : 0x232830, heaven ? 0.006 : 0.011);
  sun.color.set(heaven ? 0xfff2dd : 0xffb08a);
  sun.intensity = heaven ? 0.85 : 1.25;
  ambient.intensity = heaven ? 0.6 : 0.62;

  const floorMat = new THREE.MeshStandardMaterial({
    color: heaven ? 0xc3d0d8 : 0x6f767f,
    roughness: 0.85,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: heaven ? 0x6fc8d8 : 0x9aa4ae,
    roughness: 0.6,
  });
  const laneMat = new THREE.MeshStandardMaterial({
    color: heaven ? 0xc8d4da : 0x40464e,
    roughness: 0.9,
  });

  if (heaven) {
    for (const [a, b] of course.islands) {
      const len = b - a;
      const zc = -(a + b) / 2;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 0.6, len),
        floorMat,
      );
      slab.position.set(0, -0.3, zc);
      slab.receiveShadow = true;
      worldGroup.add(slab);
      for (const seamX of [-1.6, 1.6]) {
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.02, len),
          laneMat,
        );
        seam.position.set(seamX, 0.01, zc);
        worldGroup.add(seam);
      }
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.9, len),
          edgeMat,
        );
        rail.position.set(side * 5.4, 0.45, zc);
        worldGroup.add(rail);
      }
    }
    for (const pad of course.pads) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 0.2, 2.4),
        new THREE.MeshStandardMaterial({
          color: 0x34c8c0,
          emissive: 0x1a8a84,
          emissiveIntensity: 0.5,
        }),
      );
      stripe.position.set(0, 0.1, -pad);
      worldGroup.add(stripe);
      worldRefs.pads.push(stripe);
    }
    const pickupMat = new THREE.MeshStandardMaterial({
      color: 0x60e0d8,
      emissive: 0x2aa89f,
      emissiveIntensity: 0.8,
    });
    for (const p of course.energy) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 10, 10),
        pickupMat,
      );
      orb.position.set(LANES[p.lane], p.y, -p.at);
      orb.userData.pickupId = p.id;
      worldGroup.add(orb);
      worldRefs.pickups.push(orb);
    }
    const teach = makeSign('Maintiens Espace en l’air pour planer', '#0a3a3f', '#9fe8e0');
    teach.position.set(0, 5.5, -60);
    worldGroup.add(teach);
    worldRefs.signs.push(teach);
  } else {
    const len = course.length + 60;
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.4, len),
      floorMat,
    );
    road.position.set(0, -0.2, -(len / 2) + 10);
    road.receiveShadow = true;
    worldGroup.add(road);
    for (const seam of [-1.6, 1.6]) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.42, len),
        laneMat,
      );
      line.position.set(seam, 0, -(len / 2) + 10);
      worldGroup.add(line);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 1.0, len),
        edgeMat,
      );
      rail.position.set(side * 5.4, 0.5, -(len / 2) + 10);
      worldGroup.add(rail);
    }

    const markMat = new THREE.MeshBasicMaterial({ color: 0xd8b060 });
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xc8503c,
      emissive: 0x6a1a10,
      emissiveIntensity: 0.4,
    });
    const overheadMat = new THREE.MeshStandardMaterial({
      color: 0xd07840,
      emissive: 0x5a2a10,
      emissiveIntensity: 0.4,
    });
    const blockMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a30,
      emissive: 0x8a2020,
      emissiveIntensity: 0.5,
    });

    for (const ob of course.obstacles) {
      const group = new THREE.Group();
      group.position.set(LANES[ob.lane], 0, -ob.at);
      if (ob.kind === 'barrier') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.25, 0.6), barrierMat);
        m.position.y = 0.62;
        m.castShadow = true;
        group.add(m);
      } else if (ob.kind === 'overhead') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.85, 0.6), overheadMat);
        m.position.y = 2.07;
        m.castShadow = true;
        group.add(m);
      } else if (ob.kind === 'block') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6, 1.0), blockMat);
        m.position.y = 3;
        m.castShadow = true;
        group.add(m);
      } else if (ob.kind === 'press') {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(2.9, 0.4, 1.6),
          blockMat,
        );
        frame.position.y = 4.6;
        group.add(frame);
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 4.6, 0.3),
            blockMat,
          );
          post.position.set(side * 1.3, 2.3, 0);
          group.add(post);
        }
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 0.6, 1.4),
          new THREE.MeshStandardMaterial({
            color: 0xb04030,
            emissive: 0x701810,
            emissiveIntensity: 0.6,
          }),
        );
        plate.castShadow = true;
        group.add(plate);
        worldRefs.press = plate;
      }
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 1.2),
        markMat,
      );
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(0, 0.02, 40);
      group.add(mark);
      worldGroup.add(group);
      worldRefs.obstacles.push(group);
    }

    const cpSign = makeSign('POINT DE CONTRÔLE', '#0a2a3f', '#8fd0e8');
    cpSign.position.set(0, 5.5, -course.checkpoint);
    worldGroup.add(cpSign);
    worldRefs.signs.push(cpSign);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 4, 0.3),
        edgeMat,
      );
      post.position.set(side * 4.6, 2, -course.checkpoint);
      worldGroup.add(post);
    }
  }

  const exitSign = makeSign('SORTIE', '#062a1a', '#8ae8b0', 8, 2);
  exitSign.position.set(0, 7.2, -course.length);
  worldGroup.add(exitSign);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 6, 0.6),
      new THREE.MeshStandardMaterial({
        color: heaven ? 0x7ad8c8 : 0xd07840,
        emissive: heaven ? 0x2a8a7a : 0x8a3a10,
        emissiveIntensity: 0.6,
      }),
    );
    pillar.position.set(side * 5, 3, -course.length);
    worldGroup.add(pillar);
  }
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({
      color: heaven ? 0x7ad8c8 : 0xd07840,
      emissive: heaven ? 0x2a8a7a : 0x8a3a10,
      emissiveIntensity: 0.6,
    }),
  );
  beam.position.set(0, 6, -course.length);
  worldGroup.add(beam);

  scene.add(worldGroup);
}

function show(el, on) {
  el.style.display = on ? 'flex' : 'none';
}

function announce(text) {
  els.status.textContent = text;
}

function setOverlay(which) {
  show(els.menu, which === 'menu');
  show(els.dead, which === 'dead');
  show(els.win, which === 'win');
  show(els.pause, which === 'pause');
  if (which === 'dead') {
    els.deadRetry.focus();
  } else if (which === 'win') {
    els.winReplay.focus();
  } else if (which === 'pause') {
    els.resume.focus();
  }
}

function syncHud() {
  if (!run) return;
  els.hudMode.textContent = MODE_INFO[run.mode].title;
  els.hudDistance.textContent = `${Math.min(
    Math.floor(run.distance),
    RULES[run.mode].length,
  )} m / ${RULES[run.mode].length} m`;
  els.hudCheckpoint.textContent = run.checkpoint
    ? `Checkpoint ${run.checkpoint} m`
    : 'Checkpoint · aucun';
  const heaven = run.mode === 'heaven';
  els.hudEnergy.parentElement.style.display = heaven ? '' : 'none';
  els.hudCombo.parentElement.style.display = heaven ? '' : 'none';
  els.hudEnergy.textContent = String(run.energy);
  els.hudCombo.textContent = String(run.bestCombo);
}

function updateStateAttrs() {
  if (!run) {
    stateEl.dataset.state = 'menu';
    delete stateEl.dataset.distance;
    delete stateEl.dataset.playerY;
    delete stateEl.dataset.lane;
    delete stateEl.dataset.checkpoint;
    delete stateEl.dataset.gliding;
    return;
  }
  stateEl.dataset.state = paused ? 'paused' : run.status;
  stateEl.dataset.distance = run.distance.toFixed(2);
  stateEl.dataset.playerY = run.y.toFixed(2);
  stateEl.dataset.lane = String(run.lane);
  stateEl.dataset.checkpoint = String(run.checkpoint);
  stateEl.dataset.gliding = String(run.gliding);
}

function startRun(mode) {
  run = createRun(mode);
  buildWorld(mode);
  restartRun(run, false);
  paused = false;
  accumulator = 0;
  lastTime = null;
  edge.left = edge.right = edge.jump = edge.slide = false;
  held.jump = false;
  setOverlay('none');
  els.tSlide.style.display = mode === 'hell' ? '' : 'none';
  els.tJump.textContent = mode === 'hell' ? 'Saut' : 'Saut / Planer';
  els.tJump.setAttribute(
    'aria-label',
    mode === 'hell' ? 'Sauter' : 'Sauter et planer',
  );
  els.hud.style.display = 'flex';
  camera.position.y = baseCameraY;
  renderer.domElement.focus({ preventScroll: true });
  syncHud();
  updateStateAttrs();
  announce(MODE_INFO[mode].title);
}

function retryRun() {
  if (!run) return;
  restartRun(run, run.checkpoint > 0);
  paused = false;
  accumulator = 0;
  lastTime = null;
  edge.left = edge.right = edge.jump = edge.slide = false;
  held.jump = false;
  setOverlay('none');
  renderer.domElement.focus({ preventScroll: true });
  syncHud();
  announce('Reprise');
}

function fullReplay() {
  if (!run) return;
  startRun(run.mode);
}

function backToMenu() {
  run = null;
  paused = false;
  disposeWorld();
  els.hud.style.display = 'none';
  setOverlay('menu');
  els.menuInfo.textContent = '';
  els.play.style.display = 'none';
  pendingMode = null;
  updateStateAttrs();
  document.querySelector('.mode-btn').focus();
  announce('Choisis un parcours');
}

function setPaused(on) {
  if (!run) return;
  const pausable =
    run.status === 'running' ||
    (run.mode === 'heaven' && run.status === 'dead');
  if (!pausable) return;
  paused = on;
  accumulator = 0;
  lastTime = null;
  edge.left = edge.right = edge.jump = edge.slide = false;
  held.jump = false;
  setOverlay(on ? 'pause' : 'none');
  if (!on) {
    renderer.domElement.focus({ preventScroll: true });
  }
  announce(on ? 'Pause' : 'Reprise');
}

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    pendingMode = btn.dataset.mode;
    els.menuInfo.textContent = MODE_INFO[pendingMode].instructions;
    els.play.style.display = '';
    els.play.focus();
  });
});

els.play.addEventListener('click', () => {
  if (pendingMode) startRun(pendingMode);
});
els.deadRetry.addEventListener('click', retryRun);
els.winReplay.addEventListener('click', fullReplay);
els.resume.addEventListener('click', () => setPaused(false));
els.pauseBtn.addEventListener('click', () => setPaused(true));
els.selectBtns.forEach((btn) => btn.addEventListener('click', backToMenu));

const JUMP_KEYS = new Set([' ', 'ArrowUp', 'w', 'W', 'z', 'Z']);
const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A', 'q', 'Q']);
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D']);
const SLIDE_KEYS = new Set(['ArrowDown', 's', 'S']);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const pausable =
      run &&
      (run.status === 'running' ||
        (run.mode === 'heaven' && run.status === 'dead'));
    if (pausable) {
      e.preventDefault();
      setPaused(!paused);
    }
    return;
  }
  const tag = e.target && e.target.tagName;
  if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') {
    return;
  }
  if (!run || run.status !== 'running' || paused) return;
  if (JUMP_KEYS.has(e.key)) {
    if (e.key === ' ') e.preventDefault();
    if (!e.repeat) edge.jump = true;
    held.jump = true;
  } else if (!e.repeat) {
    if (LEFT_KEYS.has(e.key)) edge.left = true;
    else if (RIGHT_KEYS.has(e.key)) edge.right = true;
    else if (SLIDE_KEYS.has(e.key)) edge.slide = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (JUMP_KEYS.has(e.key)) held.jump = false;
});

window.addEventListener('blur', () => {
  held.jump = false;
  edge.left = edge.right = edge.jump = edge.slide = false;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});

function bindTap(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    fn();
  });
}

bindTap(els.tLeft, () => {
  if (run && run.status === 'running' && !paused) edge.left = true;
});
bindTap(els.tRight, () => {
  if (run && run.status === 'running' && !paused) edge.right = true;
});
bindTap(els.tSlide, () => {
  if (run && run.status === 'running' && !paused) edge.slide = true;
});

els.tJump.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  els.tJump.setPointerCapture(e.pointerId);
  if (run && run.status === 'running' && !paused) {
    edge.jump = true;
    held.jump = true;
  }
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  els.tJump.addEventListener(ev, () => {
    held.jump = false;
  });
}
els.tJump.addEventListener('blur', () => {
  held.jump = false;
});

function animateActor() {
  const t = run ? run.elapsed : 0;
  if (!run || run.status !== 'running') {
    actor.limbs.leftLeg.rotation.x = 0;
    actor.limbs.rightLeg.rotation.x = 0;
    actor.limbs.leftArm.rotation.x = 0;
    actor.limbs.rightArm.rotation.x = 0;
    actor.scale.set(1, 1, 1);
    return;
  }
  actorRoot.position.x = run.x;
  actorRoot.position.y = run.y;

  if (run.mode === 'hell' && run.slideLeft > 0) {
    actor.scale.set(1.15, 0.35, 1.15);
  } else if (run.bounceFlash > 0) {
    actor.scale.set(0.9, 1.15, 0.9);
  } else {
    actor.scale.set(1, 1, 1);
  }

  if (run.gliding) {
    actor.limbs.leftArm.rotation.x = -2.6;
    actor.limbs.rightArm.rotation.x = -2.6;
    actor.limbs.leftLeg.rotation.x = 0.4;
    actor.limbs.rightLeg.rotation.x = 0.4;
  } else if (!run.grounded) {
    actor.limbs.leftLeg.rotation.x = 0.6;
    actor.limbs.rightLeg.rotation.x = -0.4;
    actor.limbs.leftArm.rotation.x = -0.8;
    actor.limbs.rightArm.rotation.x = 0.8;
  } else if (!reducedMotion) {
    const swing = Math.sin(t * 16) * 0.65;
    actor.limbs.leftLeg.rotation.x = swing;
    actor.limbs.rightLeg.rotation.x = -swing;
    actor.limbs.leftArm.rotation.x = -swing;
    actor.limbs.rightArm.rotation.x = swing;
  }
}

function animateWorld() {
  if (!run || !worldGroup) return;
  worldGroup.position.z = run.distance;
  for (const sign of worldRefs.signs) {
    sign.visible = sign.position.z + run.distance < -8;
  }
  for (const orb of worldRefs.pickups) {
    orb.visible = !run.consumed.has(orb.userData.pickupId);
    orb.rotation.y += 0.04;
  }
  for (const pad of worldRefs.pads) {
    if (!reducedMotion) {
      pad.scale.y = 1 + Math.sin(run.elapsed * 6) * 0.15;
    }
  }
  if (worldRefs.press) {
    const phase = run.elapsed % 3.6;
    const plate = worldRefs.press;
    if (phase < 1.8) {
      plate.position.y = 3.4;
      plate.material.emissive.setHex(0x701810);
    } else if (phase < 2.4) {
      plate.position.y = 2.4;
      plate.material.emissive.setHex(0x8a5a10);
    } else {
      plate.position.y = 0.8;
      plate.material.emissive.setHex(0xa02010);
    }
  }
}

let baseCameraY = 4.5;

function handleResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  if (aspect < 1.0) {
    camera.fov = 60 / Math.max(aspect, 0.55);
    baseCameraY = 5.2;
    camera.position.z = 10.5;
  } else {
    camera.fov = 60;
    baseCameraY = 4.5;
    camera.position.z = 9;
  }
  camera.position.y = baseCameraY;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleResize);
handleResize();

function frame(now) {
  requestAnimationFrame(frame);
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.1;

  if (run && run.status === 'running' && !paused) {
    accumulator += dt;
    while (accumulator >= STEP) {
      stepRun(
        run,
        {
          left: edge.left,
          right: edge.right,
          jump: edge.jump,
          slide: edge.slide,
          heldJump: held.jump,
        },
        STEP,
      );
      edge.left = edge.right = edge.jump = edge.slide = false;
      accumulator -= STEP;
      if (run.status !== 'running') break;
    }
    syncHud();
  } else if (
    run &&
    run.status === 'dead' &&
    run.mode === 'heaven' &&
    !paused &&
    !document.hidden
  ) {
    accumulator += dt;
    while (accumulator >= STEP) {
      stepRun(run, { heldJump: false }, STEP);
      accumulator -= STEP;
      if (run.status !== 'dead') break;
    }
    if (run.status === 'running') {
      announce('Retour sur la dernière plateforme');
    }
  }

  if (run && run.status === 'dead' && run.mode === 'hell' && !paused) {
    els.deadRetry.textContent = run.checkpoint
      ? `Reprendre au checkpoint (${run.checkpoint} m)`
      : 'Réessayer';
    if (els.dead.style.display !== 'flex') {
      setOverlay('dead');
      announce('Collision');
    }
  }
  if (run && run.status === 'won' && !paused) {
    if (els.win.style.display !== 'flex') {
      setOverlay('win');
      announce('Parcours terminé');
    }
  }

  animateActor();
  animateWorld();
  updateStateAttrs();

  const lift = Math.max(0, run ? run.y : 0);
  const camTargetY = baseCameraY + lift * 0.7;
  camera.position.y +=
    (camTargetY - camera.position.y) * (1 - Math.exp(-8 * dt));
  camera.position.x += (actorRoot.position.x * 0.4 - camera.position.x) * 0.08;
  camera.lookAt(actorRoot.position.x * 0.3, 1.4 + lift * 0.6, -4);
  renderer.render(scene, camera);
}

setOverlay('menu');
els.play.style.display = 'none';
els.hud.style.display = 'none';
requestAnimationFrame(frame);
