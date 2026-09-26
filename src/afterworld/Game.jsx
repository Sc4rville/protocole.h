import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { TimeControl } from 'ecctrl/time';
import * as THREE from 'three';
import { HEAVEN, HELL, clamp, restartRun, resumeFromCheckpoint } from './game-state.js';
import Player from './Player.jsx';
import World from './World.jsx';
import { GameAudio } from './Sound.js';

const initialControls = () => ({ left: false, right: false, up: false, down: false, jump: false, slide: false, jumpPressed: false, slidePressed: false, leftPressed: false, rightPressed: false });
const actorSpawn = (mode) => mode === 'hell' ? [0, 0.92, 8] : HEAVEN.islands[0].spawn;
const movementKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'q', 'Q', 'd', 'D', 'w', 'W', 'z', 'Z', 's', 'S', ' ']);

function clearControls(controls) {
  Object.assign(controls, initialControls());
}

function FollowCamera({ mode, status, apiRef }) {
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDelta) => {
    const dt = Math.min(Math.max(rawDelta, 0), 1 / 30);
    const actor = apiRef.current?.read();
    if (!actor) return;
    const mobile = size.width < 700;
    const yOffset = mobile ? 4.35 : 3.55;
    const zOffset = mobile ? 10.2 : 8.6;
    target.set(actor.position.x, actor.position.y, actor.position.z);
    offset.set(actor.position.x * 0.3, actor.position.y + yOffset, actor.position.z + zOffset);
    camera.position.lerp(offset, 1 - Math.exp(-3.8 * dt));
    cameraTarget.set(target.x * 0.22, target.y + 0.85, target.z - (mode === 'hell' ? 5.3 : 3.3));
    camera.lookAt(cameraTarget);
    const perspective = camera;
    const speed = Math.hypot(actor.velocity.x, actor.velocity.z);
    const desiredFov = status === 'running' && mode === 'hell' ? 58 + clamp(speed / 18, 0, 1) * 7 : mobile ? 61 : 56;
    if (perspective.isPerspectiveCamera) {
      perspective.fov += (desiredFov - perspective.fov) * (1 - Math.exp(-2.6 * dt));
      perspective.updateProjectionMatrix();
    }
  });
  return null;
}

function ControlButton({ action, label, controlsRef, touchStateRef, className = '', onPress }) {
  const down = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const set = touchStateRef.current.get(action) || new Set();
    const wasHeld = set.size > 0;
    set.add(event.pointerId);
    touchStateRef.current.set(action, set);
    const controls = controlsRef.current;
    controls[action] = true;
    if (action === 'jump' && !wasHeld) controls.jumpPressed = true;
    if (action === 'slide' && !wasHeld) controls.slidePressed = true;
    if (action === 'left' && !wasHeld) controls.leftPressed = true;
    if (action === 'right' && !wasHeld) controls.rightPressed = true;
    onPress?.(true);
  };
  const up = (event) => {
    const set = touchStateRef.current.get(action);
    if (set) {
      set.delete(event.pointerId);
      controlsRef.current[action] = set.size > 0;
      if (!set.size) touchStateRef.current.delete(action);
    }
    onPress?.(false);
  };
  return (
    <button
      type="button"
      className={`touch-key ${className}`}
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(event) => event.preventDefault()}
    >{label}</button>
  );
}

export default function Game() {
  const [mode, setMode] = useState('hell');
  const [status, setStatus] = useState('menu');
  const [snapshot, setSnapshot] = useState(null);
  const [soundReady, setSoundReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const runRef = useRef(null);
  const controlsRef = useRef(initialControls());
  const signalsRef = useRef({ islandContacts: new Set(), padContacts: new Set(), padExited: new Set(), activePresses: new Set(), obstacleContacts: new Set() });
  const playerApiRef = useRef(null);
  const spawnRequestRef = useRef(null);
  const touchStateRef = useRef(new Map());
  const audioRef = useRef(null);
  const statusRef = useRef(status);
  const modeRef = useRef(mode);
  const snapshotRef = useRef(snapshot);
  const snapshotHandlerRef = useRef(null);
  const statusHandlerRef = useRef(null);
  if (!audioRef.current) audioRef.current = new GameAudio();
  statusRef.current = status;
  modeRef.current = mode;
  snapshotRef.current = snapshot;

  const publish = useCallback((next) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  const onSnapshotRef = useRef(publish);
  onSnapshotRef.current = publish;
  const onStatusRef = useRef(null);
  onStatusRef.current = (next) => {
    statusRef.current = next;
    setStatus(next);
  };

  const readTelemetry = useCallback(() => {
    const run = runRef.current;
    const actor = playerApiRef.current?.read();
    if (!run) {
      return { mode: modeRef.current, status: statusRef.current, elapsed: 0, position: actor?.position || { x: 0, y: 0, z: 0 }, velocity: actor?.velocity || { x: 0, y: 0, z: 0 }, grounded: actor?.grounded || false, sliding: false, gliding: false, flightSpeed: 0, checkpoint: 0, energy: 0, combo: 0, deaths: 0, collected: [], events: [] };
    }
    return {
      mode: run.mode,
      status: run.status,
      elapsed: run.elapsed,
      position: actor?.position || snapshotRef.current?.position || { x: 0, y: 0, z: 0 },
      velocity: actor?.velocity || snapshotRef.current?.velocity || { x: 0, y: 0, z: 0 },
      grounded: actor?.grounded ?? run.grounded,
      sliding: run.sliding,
      gliding: run.gliding,
      flightSpeed: run.flightSpeed,
      checkpoint: run.checkpoint,
      energy: run.energy,
      combo: run.combo,
      deaths: run.deaths,
      collected: [...run.collected],
      events: run.events.slice(-50),
    };
  }, []);

  useEffect(() => {
    const api = Object.freeze({ read: readTelemetry, audio: () => audioRef.current.probe() });
    window.__protocole = api;
    return () => {
      if (window.__protocole === api) delete window.__protocole;
      audioRef.current?.dispose();
    };
  }, [readTelemetry]);

  const begin = useCallback(async (selected = modeRef.current) => {
    clearControls(controlsRef.current);
    touchStateRef.current.clear();
    signalsRef.current.islandContacts.clear();
    signalsRef.current.padContacts.clear();
    signalsRef.current.padExited.clear();
    signalsRef.current.activePresses.clear();
    signalsRef.current.obstacleContacts.clear();
    const run = restartRun(runRef.current, selected);
    run.status = 'running';
    if (selected === 'heaven') {
      run.checkpointEnergy = 0;
      run.checkpointCollected = new Set();
    }
    runRef.current = run;
    setMode(selected);
    setStatus('running');
    setSnapshot(null);
    audioRef.current.setPaused(false);
    const unlocking = audioRef.current.unlock();
    const spawn = actorSpawn(selected);
    if (playerApiRef.current) playerApiRef.current.respawn(spawn);
    else spawnRequestRef.current = spawn;
    audioRef.current.ambience(selected);
    audioRef.current.play('ui-confirm', { gain: 0.45 });
    setSoundReady(await unlocking);
  }, []);

  const selectMenu = useCallback(() => {
    clearControls(controlsRef.current);
    touchStateRef.current.clear();
    audioRef.current.ambience(null);
    audioRef.current.setPaused(false);
    runRef.current = null;
    setStatus('menu');
    setSnapshot(null);
  }, []);

  const togglePause = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    if (statusRef.current === 'running') {
      run.status = 'paused';
      clearControls(controlsRef.current);
      touchStateRef.current.clear();
      audioRef.current.setPaused(true);
      setStatus('paused');
    } else if (statusRef.current === 'paused') {
      run.status = 'running';
      clearControls(controlsRef.current);
      audioRef.current.setPaused(false);
      audioRef.current.ambience(run.mode);
      setStatus('running');
    }
  }, []);

  const retry = useCallback(async () => {
    const run = runRef.current;
    if (!run) return;
    clearControls(controlsRef.current);
    signalsRef.current.islandContacts.clear();
    signalsRef.current.padContacts.clear();
    signalsRef.current.padExited.clear();
    signalsRef.current.activePresses.clear();
    signalsRef.current.obstacleContacts.clear();
    if (run.mode === 'hell') {
      const checkpoint = run.checkpoint || 0;
      run.lane = 1;
      run.sliding = false;
      run.slideLeft = 0;
      run.jumpBuffer = 0;
      run.coyote = 0;
      run.jumpSent = false;
      run.jumpCut = false;
      run.flightEligible = false;
      run.gliding = false;
      run.status = 'running';
      if (playerApiRef.current) playerApiRef.current.respawn([0, 0.92, 8 - checkpoint]);
    } else {
      const spawn = resumeFromCheckpoint(run);
      run.gliding = false;
      run.status = 'running';
      if (playerApiRef.current) playerApiRef.current.respawn(spawn);
    }
    audioRef.current.setPaused(false);
    const ready = await audioRef.current.unlock();
    setSoundReady(ready);
    audioRef.current.ambience(run.mode);
    setStatus('running');
  }, []);

  const setAction = useCallback((action, down) => {
    const controls = controlsRef.current;
    if (controls[action] === down) return;
    controls[action] = down;
    if (down && action === 'jump') controls.jumpPressed = true;
    if (down && action === 'slide') controls.slidePressed = true;
    if (down && action === 'left') controls.leftPressed = true;
    if (down && action === 'right') controls.rightPressed = true;
  }, []);

  useEffect(() => {
    const down = (event) => {
      if (event.key === 'Escape') {
        if (statusRef.current === 'running' || statusRef.current === 'paused') {
          event.preventDefault();
          togglePause();
        }
        return;
      }
      const tag = event.target?.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!movementKeys.has(event.key)) return;
      if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
      if (event.repeat) return;
      const controls = controlsRef.current;
      const hell = modeRef.current === 'hell';
      if (['ArrowLeft', 'a', 'A', 'q', 'Q'].includes(event.key)) {
        controls.left = true;
        if (hell) controls.leftPressed = true;
      }
      if (['ArrowRight', 'd', 'D'].includes(event.key)) {
        controls.right = true;
        if (hell) controls.rightPressed = true;
      }
      if (['ArrowUp', 'w', 'W', 'z', 'Z'].includes(event.key)) {
        if (hell) controls.jumpPressed = true;
        controls.up = true;
      }
      if (['ArrowDown', 's', 'S'].includes(event.key)) {
        controls.down = true;
        if (hell) controls.slidePressed = true;
      }
      if (event.key === ' ') {
        if (!controls.jump) controls.jumpPressed = true;
        controls.jump = true;
      }
    };
    const up = (event) => {
      const controls = controlsRef.current;
      if (['ArrowLeft', 'a', 'A', 'q', 'Q'].includes(event.key)) controls.left = false;
      if (['ArrowRight', 'd', 'D'].includes(event.key)) controls.right = false;
      if (['ArrowUp', 'w', 'W', 'z', 'Z'].includes(event.key)) controls.up = false;
      if (['ArrowDown', 's', 'S'].includes(event.key)) controls.down = false;
      if (event.key === ' ') controls.jump = false;
    };
    const blur = () => {
      clearControls(controlsRef.current);
      touchStateRef.current.clear();
      if (statusRef.current === 'running') togglePause();
    };
    const visibility = () => {
      if (document.hidden && statusRef.current === 'running') togglePause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [togglePause]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.dataset.state = status;
  }, [mode, status]);

  const updateObstacle = useCallback((spec, lane) => {
    const run = runRef.current;
    if (!run || run.status !== 'running') return;
    const pos = playerApiRef.current?.read()?.position;
    if (!pos) return;
    const progress = clamp(8 - pos.z, 0, HELL.length);
    if (Math.abs(progress - spec.distance) > 2.1) return;
    if (spec.kind === 'hurdle' && pos.y > 1.55) return;
    if (spec.kind === 'overhead' && run.sliding) return;
    if (spec.kind === 'press' && run.pressPhases?.[spec.id] !== 'closed') return;
    run.hitLabel = spec.kind === 'hurdle' ? 'La barrière' : spec.kind === 'overhead' ? 'La barre basse' : spec.kind === 'block' ? 'Le bloc' : 'La presse';
    run.events.push({ type: 'hit', id: spec.id, lane });
    run.deaths += 1;
    run.combo = 0;
    audioRef.current.play('hit', { gain: 0.82, pan: clamp(pos.x / 6, -0.6, 0.6) });
    audioRef.current.ambience(null);
    run.status = 'dead';
    setStatus('dead');
  }, []);

  const soundClick = useCallback(async () => {
    if (!audioRef.current.context) {
      const ready = await audioRef.current.unlock();
      setSoundReady(ready);
      audioRef.current.ambience(modeRef.current);
      return;
    }
    const next = !audioRef.current.probe().muted;
    audioRef.current.setMuted(next);
    setMuted(next);
  }, []);

  const screenSnapshot = snapshot || readTelemetry();
  const position = screenSnapshot.position || { x: 0, y: 0, z: 0 };
  const progress = mode === 'hell' ? clamp(8 - position.z, 0, HELL.length) : Math.max(0, HEAVEN.islands[runRef.current?.checkpoint || 0].z - position.z);
  const nextWorld = mode === 'hell' ? 'Sortie' : HEAVEN.islands[Math.min((runRef.current?.checkpoint || 0) + 1, 4)].id;

  return (
    <main className={`afterworld ${mode}`}>
      <div className="scene-shell">
        <Canvas
          dpr={Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.5)}
          camera={{ position: [0, 4, 16], fov: 56, near: 0.1, far: 240 }}
          gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
          shadows
          onCreated={({ gl }) => {
            gl.shadowMap.type = THREE.PCFShadowMap;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <ambientLight intensity={0.72} />
          <directionalLight position={[-8, 15, 8]} intensity={mode === 'heaven' ? 2.1 : 1.8} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-bias={-0.00018} />
          <Physics gravity={[0, -20, 0]} timeStep="vary" paused>
            <TimeControl paused={status !== 'running'} maxDelta={1 / 30} />
            <Suspense fallback={null}>
              <World mode={mode} runRef={runRef} signalsRef={signalsRef} audio={audioRef} onObstacleContact={updateObstacle} />
              <Player key={mode} mode={mode} status={status} runRef={runRef} controlsRef={controlsRef} signalsRef={signalsRef} audio={audioRef} apiRef={playerApiRef} spawnRequestRef={spawnRequestRef} onSnapshot={onSnapshotRef} onStatus={onStatusRef} />
            </Suspense>
            <FollowCamera mode={mode} status={status} apiRef={playerApiRef} />
          </Physics>
        </Canvas>
      </div>

      {status === 'menu' && (
        <section className="menu-screen">
          <header className="brand-row"><span className="brand-mark">P</span><span>protocole.h</span><span className="eyebrow">APRÈS-MONDES · PROTOTYPE</span></header>
          <div className="menu-copy">
            <p className="kicker">DEUX PASSAGES, DEUX RYTHMES</p>
            <h1>Choisis ta traversée.</h1>
            <p className="menu-subtitle">Les mouvements sont approuvés pour évaluation. Ces environnements et le personnage restent provisoires.</p>
            <div className="mode-cards">
              <button type="button" className={`mode-card ${mode === 'hell' ? 'selected' : ''}`} onClick={() => setMode('hell')}>
                <span className="card-index">01 / PRESSION</span>
                <strong>Enfer</strong>
                <span>Course à trois voies. Saute, glisse, lis le cycle des presses.</span>
                <kbd>← → · Espace · ↓</kbd>
              </button>
              <button type="button" className={`mode-card heaven-card ${mode === 'heaven' ? 'selected' : ''}`} onClick={() => setMode('heaven')}>
                <span className="card-index">02 / ÉLAN</span>
                <strong>Paradis</strong>
                <span>Rebondis, pilote ton plané et relie les chaînes d'énergie.</span>
                <kbd>WASD · Espace · ↑ ↓</kbd>
              </button>
            </div>
            <button type="button" className="primary-action" onClick={() => begin(mode)}>Jouer <span aria-hidden="true">↗</span></button>
            <div className="menu-foot"><span>Personnage provisoire animé</span><a href="licenses/ECCTRL-LICENSE" target="_blank" rel="noreferrer">Licences</a></div>
          </div>
        </section>
      )}

      {status === 'running' && (
        <>
          <header className="game-hud">
            <div className="hud-brand"><span className="brand-mark">P</span><span>{mode === 'hell' ? 'ENFER' : 'PARADIS'}</span></div>
            <div className="hud-progress"><div className="progress-label"><span>{mode === 'hell' ? `${Math.floor(progress)} m / 380 m` : `Terrasse ${Math.min((runRef.current?.checkpoint || 0) + 1, 5)} sur 5`}</span><span>{mode === 'hell' ? nextWorld : `${screenSnapshot.energy || runRef.current?.energy || 0} énergie · chaîne ${screenSnapshot.combo || runRef.current?.combo || 0}`}</span></div><div className="progress-track"><i style={{ width: `${mode === 'hell' ? clamp(progress / 3.8, 0, 100) : clamp(((runRef.current?.checkpoint || 0) + 1) * 20, 0, 100)}%` }} /></div></div>
            <div className="hud-actions"><button type="button" className="hud-button sound-button" onClick={soundClick} aria-label={muted ? 'Activer le son' : 'Couper le son'}>{soundReady ? (muted ? 'Son coupé' : 'Son') : 'Son'}</button><button type="button" className="hud-button" onClick={togglePause} aria-label="Mettre en pause">Pause</button><button type="button" className="hud-button quiet" onClick={selectMenu}>Parcours</button></div>
          </header>
          <div className="context-note">
            {mode === 'hell' && progress < 78 && <span>Saute les seuils · glisse sous les barres · change de voie devant les blocs</span>}
            {mode === 'heaven' && runRef.current?.elapsed < 13 && <span>Le ressort te lance. Maintiens Espace en l'air, puis corrige ta trajectoire.</span>}
          </div>
          <div className={`touch-controls ${mode}`}>
            <div className="touch-cluster dpad">
              {mode === 'heaven' && <ControlButton action="up" label="↑" controlsRef={controlsRef} touchStateRef={touchStateRef} />}
              <ControlButton action="left" label="←" controlsRef={controlsRef} touchStateRef={touchStateRef} />
              {mode === 'heaven' && <ControlButton action="down" label="↓" controlsRef={controlsRef} touchStateRef={touchStateRef} />}
              <ControlButton action="right" label="→" controlsRef={controlsRef} touchStateRef={touchStateRef} />
            </div>
            <div className="touch-cluster action-pad">
              {mode === 'hell' && <ControlButton action="slide" label="Glisse" controlsRef={controlsRef} touchStateRef={touchStateRef} className="secondary-touch" />}
              <ControlButton action="jump" label={mode === 'hell' ? 'Saut' : 'Planer'} controlsRef={controlsRef} touchStateRef={touchStateRef} className="jump-touch" />
            </div>
          </div>
        </>
      )}

      {status === 'paused' && (
        <div className="screen-shade pause-screen"><section className="modal-card"><p className="kicker">PASSAGE SUSPENDU</p><h2>Pause</h2><p>Le monde, les sons et les presses sont arrêtés.</p><button type="button" className="primary-action" onClick={togglePause}>Reprendre</button><button type="button" className="text-action" onClick={selectMenu}>Quitter le parcours</button></section></div>
      )}
      {status === 'dead' && (
        <div className="screen-shade"><section className="modal-card"><p className="kicker">IMPACT</p><h2>{runRef.current?.hitLabel || 'Tu es tombé'}</h2><p>Checkpoint {runRef.current?.checkpoint || 0} m · tentative {runRef.current?.deaths || 1}</p><button type="button" className="primary-action" onClick={retry}>Reprendre le parcours</button><button type="button" className="text-action" onClick={selectMenu}>Choisir un autre passage</button></section></div>
      )}
      {status === 'recovering' && <div className="recovery-note" role="status">Retour à la dernière plateforme</div>}
      {status === 'won' && (
        <div className="screen-shade"><section className="modal-card finish-card"><p className="kicker">PASSAGE TERMINÉ</p><h2>Tu as rejoint la sortie.</h2><p>Énergie recueillie : {runRef.current?.energy || 0} · aucune sentence simulée ici.</p><button type="button" className="primary-action" onClick={() => begin(mode)}>Rejouer</button><button type="button" className="text-action" onClick={selectMenu}>Choisir un autre passage</button></section></div>
      )}
      {status === 'menu' && (
        <footer className="provisional-note"><span>Mannequin CC0 provisoire</span><span>Références visuelles en attente du pack livré par Yann</span><span>{audioRef.current.probe().state === 'unavailable' ? 'Son indisponible' : 'Effets synthétisés localement'}</span></footer>
      )}
    </main>
  );
}
