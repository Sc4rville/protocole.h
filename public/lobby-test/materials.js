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

const TEXTURES = new URL('./assets/textures/', import.meta.url);

// Kusaila's base-colour candidates (public/cellule-assets/32-35), downscaled
// to 1024 px. They are sRGB colour only: roughness stays procedural.
function colorMap(file, repeatX, repeatY = repeatX, wrap = THREE.MirroredRepeatWrapping) {
  const t = new THREE.TextureLoader().load(new URL(file, TEXTURES).href);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = wrap;
  t.wrapT = wrap;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}

// Kusaila's colour image tiled (mirrored) under a procedural wear layer. The
// texture shows the flat fallback colour until the image arrives.
function grimeOver(file, tiles, fallback, wear, makeTexture) {
  const size = wear.width;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const compose = (img) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, size, size);
    if (img) {
      const step = size / tiles;
      const n = Math.ceil(tiles);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          ctx.save();
          ctx.translate(i * step + (i % 2 ? step : 0), j * step + (j % 2 ? step : 0));
          ctx.scale(i % 2 ? -1 : 1, j % 2 ? -1 : 1);
          ctx.drawImage(img, 0, 0, step, step);
          ctx.restore();
        }
      }
    }
    ctx.drawImage(wear, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    valueNoise(ctx, size, 2, 0.035);
    ctx.globalCompositeOperation = 'source-over';
  };
  compose(null);
  const t = makeTexture(c);
  t.encoding = THREE.sRGBEncoding;
  new THREE.ImageLoader().load(new URL(file, TEXTURES).href, (img) => {
    compose(img);
    t.needsUpdate = true;
  });
  return t;
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
  floorScuffs(ctx, size);
  return c;
}

// Rubber marks, drag scratches and a few dried drips: the floor has been
// cleaned, but not recently and not everywhere.
function floorScuffs(ctx, size) {
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const cx = size * (0.5 + (Math.random() - 0.5) * 0.5);
    const cy = size * (0.5 + (Math.random() - 0.5) * 0.5);
    const len = 8 + Math.random() * 60;
    const ang = Math.random() * Math.PI * 2;
    ctx.strokeStyle = `rgba(60,58,54,${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(ang + 0.4) * len * 0.5, cy + Math.sin(ang + 0.4) * len * 0.5,
      cx + Math.cos(ang) * len, cy + Math.sin(ang) * len,
    );
    ctx.stroke();
  }
  // wheel tracks: two parallel arcs from the door towards the chair
  ctx.strokeStyle = 'rgba(70,66,60,0.09)';
  ctx.lineWidth = 5;
  for (const off of [-9, 9]) {
    ctx.beginPath();
    ctx.moveTo(size * 0.92 + off, size * 0.68);
    ctx.bezierCurveTo(size * 0.78 + off, size * 0.66, size * 0.66, size * 0.6 + off, size * 0.56, size * 0.53 + off);
    ctx.stroke();
  }
  // dried drips around the drain and under the chair
  for (const [fx, fy, r, a] of [[0.63, 0.68, 0.06, 0.28], [0.61, 0.65, 0.025, 0.4], [0.5, 0.55, 0.11, 0.16], [0.44, 0.52, 0.03, 0.3]]) {
    const g = ctx.createRadialGradient(size * fx, size * fy, 0, size * fx, size * fy, size * r);
    g.addColorStop(0, `rgba(110,102,90,${a})`);
    g.addColorStop(0.7, `rgba(120,112,100,${a * 0.35})`);
    g.addColorStop(1, 'rgba(120,112,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size * fx, size * fy, size * r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(90,84,74,${0.1 + Math.random() * 0.25})`;
    ctx.beginPath();
    ctx.arc(size * (0.6 + (Math.random() - 0.5) * 0.14), size * (0.66 + (Math.random() - 0.5) * 0.14), 0.6 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Wall panel colour: satin resin with scuffs at trolley height, grey hand
// marks around 1.2 m and thin drips running down from the cove. One tile
// spans 3 m in both directions so the marks land at the right height.
function wallGrime() {
  const size = 1024;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const metre = size / 3;
  const yOf = (h) => size - h * metre;

  // uneven yellowing near the top, dust settling in the corners
  const tint = ctx.createLinearGradient(0, 0, 0, size);
  tint.addColorStop(0, 'rgba(232,226,208,0.35)');
  tint.addColorStop(0.25, 'rgba(255,255,255,0)');
  tint.addColorStop(0.9, 'rgba(255,255,255,0)');
  tint.addColorStop(1, 'rgba(160,156,148,0.4)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);

  // drips from the cove
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * size;
    const len = metre * (0.15 + Math.random() * 0.9);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(150,140,120,0.38)');
    g.addColorStop(1, 'rgba(150,140,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 1.5 + Math.random() * 3, len);
  }

  // scuffs at trolley height (0.55–0.9 m)
  for (let i = 0; i < 26; i++) {
    const y = yOf(0.55 + Math.random() * 0.35);
    const x = Math.random() * size;
    const len = 20 + Math.random() * 140;
    ctx.strokeStyle = `rgba(70,68,64,${0.08 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 3.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }

  // hand marks and smears at 1.1–1.4 m
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * size;
    const y = yOf(1.1 + Math.random() * 0.3);
    const r = 18 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,116,108,0.26)');
    g.addColorStop(1, 'rgba(120,116,108,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r, Math.random() * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // splashes low on the wall
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(105,98,86,${0.08 + Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, yOf(Math.random() * 0.4), 0.6 + Math.random() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

// Ceiling: rust ring and heat marks around the lamp mount, damp stain by the
// vent, soot streaks where the cables leave the junction boxes.
function ceilingStains(span) {
  const size = 1024;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  // the ceiling shape is rotated +90° about X, so world z runs against canvas y
  const px = (x, z) => [size * (0.5 + x / span), size * (0.5 - z / span)];

  // a stain is several soft, jittered ellipses: one clean gradient reads as a
  // drawn circle
  const stain = (x, z, r, rgb, a, lobes = 5) => {
    const [cx, cy] = px(x, z);
    const R = size * r / span;
    for (let i = 0; i < lobes; i++) {
      const ox = cx + (Math.random() - 0.5) * R * 0.7;
      const oy = cy + (Math.random() - 0.5) * R * 0.7;
      const rr = R * (0.55 + Math.random() * 0.6);
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
      g.addColorStop(0, `rgba(${rgb},${a / lobes * 1.6})`);
      g.addColorStop(0.6, `rgba(${rgb},${a / lobes * 0.7})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ox, oy, rr, rr * (0.7 + Math.random() * 0.3), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // tide line: the dark edge left when a damp patch dried
  const tideLine = (x, z, r, a) => {
    const [cx, cy] = px(x, z);
    const R = size * r / span;
    ctx.save();
    ctx.filter = 'blur(2px)';
    ctx.strokeStyle = `rgba(118,104,82,${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const n = 26;
    const wob = Array.from({ length: n }, () => 0.82 + Math.random() * 0.36);
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const w = wob[i % n];
      const pxl = cx + Math.cos(t) * R * w;
      const pyl = cy + Math.sin(t) * R * 0.75 * w;
      if (i === 0) ctx.moveTo(pxl, pyl);
      else ctx.lineTo(pxl, pyl);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  stain(0, -0.15, 1.0, '118,104,86', 0.55, 7); // heat halo
  stain(0, -0.15, 0.36, '92,62,44', 1.1, 4); // rust around the mount
  // rust streak running off the mount
  ctx.save();
  ctx.filter = 'blur(1.5px)';
  const [mx, my] = px(0.14, -0.05);
  const rg = ctx.createLinearGradient(mx, my, mx + 70, my + 40);
  rg.addColorStop(0, 'rgba(110,70,44,0.55)');
  rg.addColorStop(1, 'rgba(110,70,44,0)');
  ctx.strokeStyle = rg;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.quadraticCurveTo(mx + 30, my + 30, mx + 70, my + 40);
  ctx.stroke();
  ctx.restore();

  stain(-1.45, 1.9, 0.85, '146,140,122', 0.75, 7); // damp around the vent
  stain(-1.25, 1.65, 0.34, '124,112,94', 0.6, 4);
  tideLine(-1.45, 1.9, 0.78, 0.35);
  stain(1.6, -1.2, 0.55, '140,136,124', 0.45, 5);
  tideLine(1.55, -1.25, 0.5, 0.26);
  stain(-2.2, -2.4, 0.7, '138,134,124', 0.4, 5);
  // soot at the junction boxes
  for (const [x, z] of [[0.95, -1.0], [-0.9, 0.8], [1.4, 1.2]]) stain(x, z, 0.32, '52,50,48', 0.95, 4);

  // dried drip rings
  for (const [x, z, r] of [[0.15, 0.45, 0.26], [-0.55, -1.7, 0.22], [1.0, 1.2, 0.18], [2.2, 0.6, 0.3]]) {
    stain(x, z, r, '150,140,120', 0.3, 3);
    tideLine(x, z, r, 0.4);
  }

  return c;
}

// Fine orange-peel relief for the resin panels: without it the surface reads
// as an untextured polygon under the raking cove light.
function reliefBump() {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, size, size);
  valueNoise(ctx, size, 3, 0.35);
  valueNoise(ctx, size, 7, 0.2);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
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
  // Kusaila's colour maps under procedural wear. Tile counts follow the
  // plain maps: wall panels ~1.1 m over a 3 m tile, floor 2.2 m over 8 m,
  // ceiling one tile per 2.5 m over 8 m.
  const wallMap = grimeOver('mur-cellule.jpg', 2.7, '#f4f3ee', wallGrime(), (c) => texture(c, 1 / 3));
  const ceilMap = grimeOver('mur-cellule.jpg', 3.2, '#f7f6f1', ceilingStains(8), (c) => floorTexture(c, 8));
  const floorMap = grimeOver('sol-cellule.jpg', 8 / 2.2, '#f2f1ec', floorTint(), (c) => floorTexture(c, 8));
  const metalMap = colorMap('metal-sombre.jpg', 2);
  const bump = texture(reliefBump(), 6);

  const wall = new THREE.MeshStandardMaterial({
    color: 0xf4f3ee, map: wallMap, roughness: 0.62, roughnessMap: wallRough, metalness: 0.02,
    bumpMap: bump, bumpScale: 0.0022, envMap, envMapIntensity: 0.55,
  });
  const ceiling = new THREE.MeshStandardMaterial({
    color: 0xf7f6f1, map: ceilMap, roughness: 0.78, roughnessMap: ceilRough, metalness: 0.0,
    bumpMap: bump, bumpScale: 0.0015, envMap, envMapIntensity: 0.3,
  });
  const floor = new THREE.MeshStandardMaterial({
    color: 0xf2f1ec, map: floorMap, roughness: 0.45, roughnessMap: floorRough, metalness: 0.04,
    bumpMap: bump, bumpScale: 0.001, envMap, envMapIntensity: 0.75,
  });
  const inlay = new THREE.MeshStandardMaterial({
    color: 0xd6d5cf, roughness: 0.35, roughnessMap: floorRough, metalness: 0.05, envMap, envMapIntensity: 0.9,
  });
  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0xb8b6b0, map: metalMap, roughness: 0.48, metalness: 0.7, envMap, envMapIntensity: 0.7,
  });
  const cyanStrip = new THREE.MeshStandardMaterial({ color: 0x0c1416, emissive: 0x6fe3ef, emissiveIntensity: 0.9, roughness: 0.4 });
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

  const rubber = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.88, metalness: 0.05, envMap, envMapIntensity: 0.25 });
  const rubberGrey = new THREE.MeshStandardMaterial({ color: 0x5c5f66, roughness: 0.8, metalness: 0.05, envMap, envMapIntensity: 0.3 });
  const rubberBlue = new THREE.MeshStandardMaterial({ color: 0x1f2f5c, roughness: 0.8, metalness: 0.05, envMap, envMapIntensity: 0.3 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.95, envMap, envMapIntensity: 1.2 });
  const paintedSteel = new THREE.MeshStandardMaterial({ color: 0x8d9097, roughness: 0.55, metalness: 0.6, envMap, envMapIntensity: 0.7 });
  const spark = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tape = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.95, metalness: 0.0 });
  const warningTape = new THREE.MeshStandardMaterial({ color: 0xd8b53a, roughness: 0.8, metalness: 0.0, envMap, envMapIntensity: 0.3 });

  // The environment map fakes bounced light, so it has to fade with the room
  // state: kept constant it would keep the walls bright during the blackout.
  const envDriven = [wall, ceiling, floor, inlay, joint, glass, steel, charcoal, dark, shell, lampShell, gunmetal, rubber, rubberGrey, rubberBlue, copper, paintedSteel, warningTape]
    .map((mat) => ({ mat, base: mat.envMapIntensity }));

  return {
    envMap, envDriven, wall, ceiling, floor, inlay, joint, shadowGap, glass, steel, charcoal, dark,
    shell, cushion, lampShell, lens, cove, windowGlow, presence, ledSpare, gunmetal, cyanStrip,
    rubber, rubberGrey, rubberBlue, copper, paintedSteel, spark, tape, warningTape,
  };
}
