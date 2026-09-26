const THREE = globalThis.THREE;

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function valueNoise(ctx, size, cell, alpha) {
  const cells = Math.ceil(size / cell);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const v = Math.random();
      ctx.fillStyle = `rgba(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0},${alpha})`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

function texture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

// Floor UVs come from the room polygon in metres; map the whole floor to a
// single tile so the wear pattern does not repeat as a grid.
function floorTexture(c, span) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / span, 1 / span);
  t.offset.set(0.5, 0.5);
  t.anisotropy = 8;
  return t;
}

// Soft pool of light in the observation room: a hard-edged emissive rectangle
// reads as a screen, a gradient reads as a lamp somewhere behind the glass.
function glowGradient() {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size * 0.62, size * 0.44, 0, size * 0.62, size * 0.5, size * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Blurred head-and-shoulders mask: sharp geometry would read as a pictogram,
// a soft mask reads as someone standing in the light behind the glass.
function silhouetteMask() {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.28, size * 0.115, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.32, size);
  ctx.bezierCurveTo(size * 0.33, size * 0.52, size * 0.41, size * 0.42, size * 0.46, size * 0.4);
  ctx.lineTo(size * 0.54, size * 0.4);
  ctx.bezierCurveTo(size * 0.59, size * 0.42, size * 0.67, size * 0.52, size * 0.68, size);
  ctx.closePath();
  ctx.fill();
  ctx.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Satin resin: almost uniform, with slow roughness drift so highlights breathe
// instead of reading as one flat plastic sheet.
function resinRoughness(base, drift) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const level = Math.round(base * 255);
  ctx.fillStyle = `rgb(${level},${level},${level})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const r = 40 + Math.random() * 90;
    const g = ctx.createRadialGradient(
      Math.random() * size, Math.random() * size, 0,
      Math.random() * size, Math.random() * size, r,
    );
    const shade = Math.round(Math.min(255, Math.max(0, level + (Math.random() - 0.5) * drift * 255)));
    g.addColorStop(0, `rgba(${shade},${shade},${shade},0.5)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'overlay';
  valueNoise(ctx, size, 2, 0.06);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

// Floor wear: traffic lanes from the door to the chair, polished by use.
function floorRoughness() {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(224,224,224)';
  ctx.fillRect(0, 0, size, size);
  const lane = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.42);
  lane.addColorStop(0, 'rgba(150,150,150,0.9)');
  lane.addColorStop(0.6, 'rgba(190,190,190,0.5)');
  lane.addColorStop(1, 'rgba(224,224,224,0)');
  ctx.fillStyle = lane;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(170,170,170,0.35)';
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 40, size * 0.7, y + (Math.random() - 0.5) * 40, size, y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'overlay';
  valueNoise(ctx, size, 2, 0.05);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

function floorTint() {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e4e2da';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) {
    const a = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(120,118,110,${a})` : `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const stain = ctx.createRadialGradient(size * 0.52, size * 0.55, 10, size * 0.52, size * 0.55, size * 0.3);
  stain.addColorStop(0, 'rgba(198,194,184,0.35)');
  stain.addColorStop(1, 'rgba(198,194,184,0)');
  ctx.fillStyle = stain;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Equirectangular stand-in for the room itself: bright ceiling, mid walls,
// darker floor. The dark glass and the metal parts read it as reflections.
function environmentTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#f3f2ec');
  g.addColorStop(0.33, '#dcdbd4');
  g.addColorStop(0.62, '#b9b8b1');
  g.addColorStop(1, '#4a4a48');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = 'rgba(255,253,244,0.95)';
  ctx.fillRect(84, 4, 88, 18);
  ctx.fillStyle = 'rgba(20,22,26,0.7)';
  ctx.fillRect(0, 58, 256, 10);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

export function createMaterials(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envSource = environmentTexture();
  const envMap = pmrem.fromEquirectangular(envSource).texture;
  envSource.dispose();
  pmrem.dispose();

  const wallRough = texture(resinRoughness(0.62, 0.22), 2);
  const ceilRough = texture(resinRoughness(0.72, 0.16), 2);
  const floorRough = floorTexture(floorRoughness(), 8);
  const floorMap = floorTexture(floorTint(), 8);

  const wall = new THREE.MeshStandardMaterial({
    color: 0xe7e6df, roughness: 0.62, roughnessMap: wallRough, metalness: 0.02, envMap, envMapIntensity: 0.55,
  });
  const ceiling = new THREE.MeshStandardMaterial({
    color: 0xeceae3, roughness: 0.78, roughnessMap: ceilRough, metalness: 0.0, envMap, envMapIntensity: 0.3,
  });
  const floor = new THREE.MeshStandardMaterial({
    color: 0xdedcd4, map: floorMap, roughness: 0.45, roughnessMap: floorRough, metalness: 0.04,
    envMap, envMapIntensity: 0.75,
  });
  const inlay = new THREE.MeshStandardMaterial({
    color: 0xd2d0c7, roughness: 0.35, roughnessMap: floorRough, metalness: 0.05, envMap, envMapIntensity: 0.9,
  });
  const joint = new THREE.MeshStandardMaterial({ color: 0xc3c1b8, roughness: 0.55, metalness: 0.08, envMap, envMapIntensity: 0.5 });
  const shadowGap = new THREE.MeshStandardMaterial({ color: 0x8e8d87, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0b0d11, roughness: 0.08, metalness: 0.65, envMap, envMapIntensity: 1.25,
    transparent: true, opacity: 0.72,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9fa2a6, roughness: 0.32, metalness: 0.85, envMap, envMapIntensity: 1.0 });
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x33353a, roughness: 0.42, metalness: 0.45, envMap, envMapIntensity: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.25, envMap, envMapIntensity: 0.5 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xeeece4, roughness: 0.38, metalness: 0.06, envMap, envMapIntensity: 0.8 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0xc9c6ba, roughness: 0.96, metalness: 0.0 });
  const lampShell = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.25, metalness: 0.35, envMap, envMapIntensity: 1.0 });
  const lens = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xfff6e2, emissiveIntensity: 0.05, roughness: 0.12, metalness: 0.0,
  });
  const cove = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xdfe6ee, emissiveIntensity: 0.4, roughness: 1,
  });
  const windowGlow = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xa8c8e8, emissiveIntensity: 0.0, roughness: 1,
    emissiveMap: glowGradient(),
  });
  const presence = new THREE.MeshBasicMaterial({
    color: 0x101216, transparent: true, opacity: 0.92, alphaMap: silhouetteMask(), depthWrite: false,
  });
  const ledOn = new THREE.MeshStandardMaterial({ color: 0x0f1113, emissive: 0x7fd6c0, emissiveIntensity: 0 });
  const ledSpare = () => ledOn.clone();

  // The environment map fakes bounced light, so it has to fade with the room
  // state: kept constant it would keep the walls bright during the blackout.
  const envDriven = [wall, ceiling, floor, inlay, joint, glass, steel, charcoal, dark, shell, lampShell]
    .map((mat) => ({ mat, base: mat.envMapIntensity }));

  return {
    envMap, envDriven, wall, ceiling, floor, inlay, joint, shadowGap, glass, steel, charcoal, dark,
    shell, cushion, lampShell, lens, cove, windowGlow, presence, ledSpare,
  };
}
