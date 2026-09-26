const THREE = globalThis.THREE;

export function createPainting(scene, { position, rotationY, width = 1.15, height = 0.85 }) {
  const W = 320;
  const H = Math.round((W * height) / width);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;

  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0x8a6a2c, metalness: 0.85, roughness: 0.35 });
  const frameDepth = 0.06;
  const bar = 0.07;
  const parts = [
    [width + bar * 2, bar, 0, height / 2 + bar / 2],
    [width + bar * 2, bar, 0, -height / 2 - bar / 2],
    [bar, height, -width / 2 - bar / 2, 0],
    [bar, height, width / 2 + bar / 2, 0],
  ];
  for (const [w, h, x, y] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), gold);
    m.position.set(x, y, frameDepth / 2);
    m.castShadow = true;
    group.add(m);
  }
  const canvasMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(width, height), canvasMat);
  art.position.z = 0.012;
  group.add(art);
  const plaque = document.createElement('canvas');
  plaque.width = 256;
  plaque.height = 48;
  const pg = plaque.getContext('2d');
  pg.fillStyle = '#16140f';
  pg.fillRect(0, 0, 256, 48);
  pg.fillStyle = '#c9a85a';
  pg.font = 'italic 17px Georgia, serif';
  pg.textAlign = 'center';
  pg.fillText('"The Reviewer", oil on memory', 128, 30);
  const plaqueTex = new THREE.CanvasTexture(plaque);
  const plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), new THREE.MeshBasicMaterial({ map: plaqueTex }));
  plaqueMesh.position.set(0, -height / 2 - bar - 0.09, 0.01);
  group.add(plaqueMesh);
  const lamp = new THREE.SpotLight(0xffd9a0, 1.6, 3, 0.6, 0.7, 1.5);
  lamp.position.set(0, height / 2 + 0.5, 0.6);
  lamp.target = art;
  group.add(lamp);

  group.position.copy(position);
  group.rotation.y = rotationY;
  scene.add(group);

  const strokes = Array.from({ length: 140 }, () => ({
    x: Math.random() * W, y: Math.random() * H, r: 6 + Math.random() * 22,
    hue: [18, 32, 348, 190, 44][Math.floor(Math.random() * 5)], ph: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.6,
  }));
  let acc = 0;
  let t = 0;
  let glitch = 0;
  let nextGlitch = 5;
  const local = new THREE.Vector3();

  function draw(look) {
    g.fillStyle = '#1a0f0c';
    g.fillRect(0, 0, W, H);
    for (const s of strokes) {
      const x = s.x + Math.sin(t * s.sp + s.ph) * 14;
      const y = s.y + Math.cos(t * s.sp * 0.8 + s.ph) * 10 + Math.sin(t * 0.4 + s.x * 0.02) * 6;
      const grad = g.createRadialGradient(x, y, 0, x, y, s.r);
      const l = 32 + 18 * Math.sin(t * 0.7 + s.ph);
      grad.addColorStop(0, `hsla(${s.hue},62%,${l}%,.55)`);
      grad.addColorStop(1, `hsla(${s.hue},62%,${l}%,0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, y, s.r * 1.6, s.r, s.ph + t * 0.1, 0, Math.PI * 2);
      g.fill();
    }
    const cx = W / 2 + Math.sin(t * 0.3) * 6;
    const cy = H / 2 + 4;
    const melt = 1 + 0.12 * Math.sin(t * 0.5);
    g.save();
    g.translate(cx, cy);
    g.fillStyle = 'rgba(210,205,196,.88)';
    g.beginPath();
    g.moveTo(-46, -58);
    g.bezierCurveTo(-60, -10, -52, 40 * melt, -18, 70 * melt);
    g.bezierCurveTo(-6, 92 * melt, 8, 80 * melt, 14, 96 * melt);
    g.bezierCurveTo(30, 70 * melt, 56, 20, 46, -58);
    g.bezierCurveTo(30, -90, -30, -90, -46, -58);
    g.fill();
    g.strokeStyle = 'rgba(40,20,16,.5)';
    g.lineWidth = 2;
    g.stroke();
    const blink = Math.max(0, Math.sin(t * 1.3)) > 0.985 ? 0.1 : 1;
    for (const ex of [-20, 20]) {
      g.fillStyle = '#0d0a09';
      g.beginPath();
      g.ellipse(ex, -14, 13, 9 * blink, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#7ff0ff';
      g.beginPath();
      g.arc(ex + look.x * 6, -14 + look.y * 4, 3.4 * blink, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(120,20,14,.8)';
    g.fillRect(-12, 30 * melt, 24, 3 + 4 * Math.max(0, Math.sin(t * 2.1)));
    g.fillStyle = 'rgba(150,20,14,.55)';
    for (let i = 0; i < 3; i++) g.fillRect(-8 + i * 8, 34 * melt, 2, 20 + 16 * Math.sin(t * 0.6 + i));
    g.restore();
    if (glitch > 0) {
      for (let i = 0; i < 7; i++) {
        const y = Math.random() * H;
        const h = 4 + Math.random() * 16;
        g.drawImage(canvas, 0, y, W, h, (Math.random() - 0.5) * 40, y, W, h);
      }
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.font = 'bold 20px monospace';
      g.textAlign = 'center';
      g.fillText('WHO REVIEWS WHOM', W / 2, H - 18);
    }
    for (let y = 0; y < H; y += 3) {
      g.fillStyle = 'rgba(0,0,0,.08)';
      g.fillRect(0, y, W, 1);
    }
    tex.needsUpdate = true;
  }

  return {
    group,
    update(dt, camera) {
      t += dt;
      acc += dt;
      if (glitch > 0) glitch -= dt;
      if (t > nextGlitch) {
        glitch = 0.6;
        nextGlitch = t + 7 + Math.random() * 6;
      }
      if (acc < 1 / 20) return;
      acc = 0;
      local.copy(camera.position);
      group.worldToLocal(local);
      const look = { x: Math.max(-1, Math.min(1, local.x / 2)), y: Math.max(-1, Math.min(1, -(local.y - 0) / 2)) };
      draw(look);
    },
  };
}
