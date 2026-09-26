// protocole.h — cinematic trailer runtime.
//   ?render=1   deterministic mode: no audio, no rAF; window.__trailer.seek(t)
//               draws the frame at trailer time t (used by scripts/trailer).
//   ?t=SECONDS  start (or preview) from that time.
//   ?speed=N    playback speed (live mode only).
import { createAudioEngine, loadVoiceIndex } from './audio.js';
import { createCameraRig, sampleTrack, shotAt } from './camera.js';
import { createOverlay } from './overlay.js';
import { createStage } from './stage.js';
import * as timeline from './timeline.js';

const THREE = globalThis.THREE;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const START_AT = Math.max(0, Number(params.get('t')) || 0);
const SPEED = Math.max(0.1, Number(params.get('speed')) || 1);

const host = document.getElementById('stage');
const gate = document.getElementById('gate');
const gateBtn = document.getElementById('gate-play');
const gateStatus = document.getElementById('gate-status');
const progress = document.getElementById('progress');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: RENDER });
renderer.setPixelRatio(RENDER ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
host.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 40);
const rig = createCameraRig(camera);
const stage = createStage(renderer);

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let overlay = null;
let voiceIndex = {};
let lastT = -1;
let lastShotId = null;

function drawFrame(t, dt) {
  const shot = shotAt(timeline.SHOTS, t);
  const tracks = {};
  for (const [name, keys] of Object.entries(timeline.TRACKS)) tracks[name] = sampleTrack(keys, t);
  // a new shot resets the smoothing so poses snap on the cut
  const cut = shot && shot.id !== lastShotId;
  lastShotId = shot ? shot.id : null;
  const step = cut ? 1 : dt;
  stage.apply(shot ? shot.scene : null, tracks, t, step);
  if (cut) {
    stage.robot.update(1, t);
    stage.apply(shot ? shot.scene : null, tracks, t, 1 / timeline.FPS);
  }
  rig.apply(shot, t);
  renderer.toneMappingExposure = tracks.exposure;
  renderer.render(stage.scene, camera);
  overlay.update(t);
  if (progress) progress.style.width = `${(t / timeline.DURATION) * 100}%`;
  lastT = t;
}

async function boot() {
  voiceIndex = await loadVoiceIndex();
  overlay = createOverlay(document.getElementById('overlay'), timeline, voiceIndex);

  if (RENDER) {
    for (const v of Object.values(voiceIndex)) v.duration = v.duration || 3;
    // durations for subtitles come from the renderer through voiceDurations
    globalThis.__trailer = {
      ready: true,
      duration: timeline.DURATION,
      fps: timeline.FPS,
      setVoiceDurations(map) {
        for (const [id, d] of Object.entries(map)) if (voiceIndex[id]) voiceIndex[id].duration = d;
      },
      probe() {
        const v = new THREE.Vector3();
        const out = {};
        for (const j of ['head', 'chest', 'elbowL', 'wristL', 'pelvis']) {
          stage.robot.joints[j].getWorldPosition(v);
          out[j] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
        }
        return out;
      },
      seek(t) {
        const dt = lastT >= 0 && t > lastT ? Math.min(0.1, t - lastT) : 1 / timeline.FPS;
        drawFrame(t, dt);
        return true;
      },
    };
    gate.hidden = true;
    drawFrame(START_AT, 1 / timeline.FPS);
    return;
  }

  const audio = createAudioEngine();
  gateStatus.textContent = 'loading audio…';
  await audio.preload(voiceIndex);
  gateStatus.textContent = '';
  gateBtn.disabled = false;
  drawFrame(START_AT, 1 / timeline.FPS);

  gateBtn.addEventListener('click', async () => {
    gate.hidden = true;
    const t0 = await audio.start(START_AT);
    let prev = null;
    function frame() {
      const now = audio.ctx.currentTime;
      const t = START_AT + (now - t0) * SPEED;
      if (t >= timeline.DURATION) {
        drawFrame(timeline.DURATION - 1e-3, 1 / timeline.FPS);
        audio.stop();
        gate.hidden = false;
        gateBtn.textContent = 'replay';
        gateBtn.onclick = () => location.reload();
        return;
      }
      const dt = prev === null ? 1 / timeline.FPS : Math.max(0, t - prev);
      prev = t;
      if (t >= 0) drawFrame(t, dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

boot().catch((err) => {
  console.error(err);
  if (gateStatus) gateStatus.textContent = String(err);
});
