export const ROOM = {
  halfX: 3.1,
  halfZ: 3.7,
  height: 3.0,
  chamfer: 0.65,
  ceilingChamfer: 0.34,
};

export const ROOM_HALF_X = ROOM.halfX;
export const ROOM_HALF_Z = ROOM.halfZ;
export const PLAYER_RADIUS = 0.25;
export const PLAYER_EYE = 1.62;
export const CHAIR = { minX: -0.85, maxX: 0.85, minZ: -0.95, maxZ: 0.95 };
export const CHAIR_CENTER = { x: 0, z: 0 };

// Free-standing props: position, facing and a round footprint the player
// slides around. Visuals in props.js follow these, not the other way round.
export const PROPS = {
  tray: { x: 2.1, z: -1.3, yaw: -0.5, radius: 0.32 },
  station: { x: -2.68, z: -1.25, yaw: Math.PI / 2, radius: 0.42 },
};

const SQRT2 = Math.SQRT2;
const EXPANDED = {
  minX: CHAIR.minX - PLAYER_RADIUS,
  maxX: CHAIR.maxX + PLAYER_RADIUS,
  minZ: CHAIR.minZ - PLAYER_RADIUS,
  maxZ: CHAIR.maxZ + PLAYER_RADIUS,
};

function insideChair(x, z) {
  return x > EXPANDED.minX && x < EXPANDED.maxX && z > EXPANDED.minZ && z < EXPANDED.maxZ;
}

function insideProp(x, z) {
  for (const prop of Object.values(PROPS)) {
    if (Math.hypot(x - prop.x, z - prop.z) < prop.radius + PLAYER_RADIUS) return true;
  }
  return false;
}

function blocked(x, z) {
  return insideChair(x, z) || insideProp(x, z);
}

function clampAxis(v, half) {
  const lim = half - PLAYER_RADIUS;
  return Math.min(lim, Math.max(-lim, v));
}

// The four corners are cut at 45°, so the walkable area is a rectangle minus
// four diagonal half-planes |x| + |z| <= limit.
function clampCorner(x, z) {
  const limit = ROOM.halfX + ROOM.halfZ - ROOM.chamfer - PLAYER_RADIUS * SQRT2;
  const excess = Math.abs(x) + Math.abs(z) - limit;
  if (excess <= 0) return { x, z };
  const shift = excess / 2;
  return { x: x - Math.sign(x) * shift, z: z - Math.sign(z) * shift };
}

export function clampToRoom(x, z) {
  return clampCorner(clampAxis(x, ROOM.halfX), clampAxis(z, ROOM.halfZ));
}

export function distanceToChair(x, z) {
  const dx = Math.max(CHAIR.minX - x, 0, x - CHAIR.maxX);
  const dz = Math.max(CHAIR.minZ - z, 0, z - CHAIR.maxZ);
  return Math.hypot(dx, dz);
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
      const alongX = clampToRoom(x + sx, z);
      if (!blocked(alongX.x, alongX.z)) {
        x = alongX.x;
        z = alongX.z;
      }
      const alongZ = clampToRoom(x, z + sz);
      if (!blocked(alongZ.x, alongZ.z)) {
        x = alongZ.x;
        z = alongZ.z;
      }
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

// Head bob is subtle on purpose: the room should feel walked, not shaken.
export function headBob(phase, speedRatio) {
  return {
    y: Math.sin(phase * 2) * 0.014 * speedRatio,
    roll: Math.sin(phase) * 0.006 * speedRatio,
  };
}
