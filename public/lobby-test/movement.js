export const ROOM_HALF = 4;
export const PLAYER_RADIUS = 0.25;
export const CHAIR = { minX: -0.85, maxX: 0.85, minZ: -0.95, maxZ: 0.95 };

const INTERIOR = ROOM_HALF - PLAYER_RADIUS;
const EXPANDED = {
  minX: CHAIR.minX - PLAYER_RADIUS,
  maxX: CHAIR.maxX + PLAYER_RADIUS,
  minZ: CHAIR.minZ - PLAYER_RADIUS,
  maxZ: CHAIR.maxZ + PLAYER_RADIUS,
};

function insideChair(x, z) {
  return x > EXPANDED.minX && x < EXPANDED.maxX && z > EXPANDED.minZ && z < EXPANDED.maxZ;
}

function clampInterior(v) {
  return Math.min(INTERIOR, Math.max(-INTERIOR, v));
}

export function movePlayer(position, direction, dt, speed = 2.2) {
  const step = Math.min(0.05, Math.max(0, dt));
  let dx = direction.x;
  let dz = direction.z;
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    dx /= len;
    dz /= len;
  }
  let x = position.x;
  let z = position.z;
  const dist = step * speed;
  if (dist > 0) {
    const n = Math.max(1, Math.ceil((Math.abs(dx) * dist) / 0.05), Math.ceil((Math.abs(dz) * dist) / 0.05));
    const sx = (dx * dist) / n;
    const sz = (dz * dist) / n;
    for (let i = 0; i < n; i++) {
      const nx = clampInterior(x + sx);
      if (!insideChair(nx, z)) x = nx;
      const nz = clampInterior(z + sz);
      if (!insideChair(x, nz)) z = nz;
    }
  }
  return { x, z };
}

export function directionFromKeys(keys, yaw) {
  const forward = (keys.has('KeyW') || keys.has('KeyZ') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const right = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') || keys.has('KeyQ') ? 1 : 0);
  return {
    x: right * Math.cos(yaw) - forward * Math.sin(yaw),
    z: -right * Math.sin(yaw) - forward * Math.cos(yaw),
  };
}
