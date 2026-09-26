// Shot interpolation: position, look target, fov and hand-held jitter.
const THREE = globalThis.THREE;

const EASE = {
  linear: (u) => u,
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inout: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
};

export function shotAt(shots, t) {
  for (const shot of shots) {
    if (t >= shot.start && t < shot.end) return shot;
  }
  return null;
}

export function sampleTrack(keys, t) {
  if (!keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t < t1) {
      const [t0, v0] = keys[i - 1];
      const u = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u;
    }
  }
  return keys[keys.length - 1][1];
}

function lerp3(a, b, u, out) {
  out.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
  return out;
}

// smooth deterministic jitter, same result for the same t
function wobble(t, seed) {
  return (
    Math.sin(t * 1.7 + seed) * 0.5 +
    Math.sin(t * 3.9 + seed * 2.1) * 0.3 +
    Math.sin(t * 8.3 + seed * 0.7) * 0.2
  );
}

export function createCameraRig(camera) {
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();

  function apply(shot, t) {
    if (!shot) return;
    const { cam } = shot;
    const span = Math.max(1e-3, shot.end - shot.start);
    const u = Math.min(1, Math.max(0, (t - shot.start) / span));
    const e = (EASE[cam.ease] || EASE.inout)(u);
    lerp3(cam.from, cam.to || cam.from, e, pos);
    lerp3(cam.look, cam.lookTo || cam.look, e, look);
    const shake = cam.shake || 0;
    if (shake) {
      pos.x += wobble(t, 1) * shake;
      pos.y += wobble(t, 2) * shake;
      look.x += wobble(t, 3) * shake * 2;
      look.y += wobble(t, 4) * shake * 2;
    }
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.rotation.z += (cam.roll || 0) + wobble(t, 5) * shake * 0.6;
    if (camera.fov !== cam.fov) {
      camera.fov = cam.fov || 40;
      camera.updateProjectionMatrix();
    }
  }

  return { apply };
}
