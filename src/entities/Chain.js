const MIN_SPEED = 0.5;
const MAX_SPEED = 6;

/**
 * Chain — a hanging chain with Verlet integration physics.
 *
 * Each link stores current + previous position; gravity is applied each frame
 * and distance constraints between adjacent links are iteratively resolved.
 * The top link is fixed (static anchor).
 *
 * Each link is drawn as a hollow circle with a white 1-px outline.
 * Coordinates are in virtual world space (320×180).
 */
export default class Chain {
  constructor(scene, x, fromY, toY, robot = null) {
    const RADIUS  = 3;
    const SPACING = 5;
    const count   = Math.max(2, Math.round((toY - fromY) / SPACING));

    this._scene   = scene;
    this._robot   = robot;
    this._links   = [];
    this._gfx     = [];
    this._SPACING = SPACING;
    this._RADIUS  = RADIUS;

    // audio control
    this._lastChainSound = 0;
    this._chainCooldown  = 120; // ms

    for (let i = 0; i < count; i++) {
      const xOff = (count - 1 - i) * 0.9;
      const lx = x + xOff;
      const ly = fromY + i * SPACING;

      this._links.push({
        x:  lx,
        y:  ly,
        px: lx,
        py: ly,
        fixed: i === 0,
      });

      const g = scene.add.graphics();
      g.lineStyle(1, 0xffffff, 1);
      g.strokeCircle(0, 0, RADIUS);
      g.setDepth(5);
      this._gfx.push(g);
    }

    this.sfxChains = scene.sound.add('chains', { volume: 1 });

    scene.events.on('update', this._update, this);
  }

  _update(_time, delta) {
    const dt       = Math.min(delta / 1000, 0.033);
    const GRAVITY  = 180;
    const DAMPING  = 0.985;
    const ITERS    = 8;

    let maxSpeed = 0;
    let robotHit = false;

    // ── Verlet ─────────────────────────────────────────────
    for (const lk of this._links) {
      if (lk.fixed) continue;

      const vx = (lk.x - lk.px) * DAMPING;
      const vy = (lk.y - lk.py) * DAMPING;

      lk.px = lk.x;
      lk.py = lk.y;

      lk.x += vx;
      lk.y += vy + GRAVITY * dt * dt;

      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > maxSpeed) maxSpeed = speed;
    }

    // ── Constraints ────────────────────────────────────────
    const rest = this._SPACING;
    for (let iter = 0; iter < ITERS; iter++) {
      for (let i = 0; i < this._links.length - 1; i++) {
        const a = this._links[i];
        const b = this._links[i + 1];

        const dx   = b.x - a.x;
        const dy   = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const corr = (dist - rest) / dist * 0.5;

        if (!a.fixed) { a.x += dx * corr; a.y += dy * corr; }
        if (!b.fixed) { b.x -= dx * corr; b.y -= dy * corr; }
      }
    }

    // ── Robot collision ────────────────────────────────────
    if (this._robot) {
      const rb  = this._robot.body_proxy;
      const cx  = rb.x;
      const cy  = rb.y;
      const ab  = rb.body;

      const hw = ab.halfWidth  + this._RADIUS;
      const hh = ab.halfHeight + this._RADIUS;

      for (const lk of this._links) {
        if (lk.fixed) continue;

        if (Math.abs(lk.x - cx) < hw && Math.abs(lk.y - cy) < hh) {
          lk.x = lk.x < cx ? cx - hw : cx + hw;
          robotHit = true;
        }
      }
    }

    // ── Sound (clean + dynamic) ────────────────────────────
    if (robotHit) {
      const now = this._scene.time.now;

      if (now > this._lastChainSound + this._chainCooldown) {
        this._lastChainSound = now;

        const t = Phaser.Math.Clamp(
          (maxSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED),
          0,
          1
        );

        const volume = t * t; // easing

        if (volume > 0.05) {
          this.sfxChains.play({
            volume,
            detune: Phaser.Math.Between(-80, 80),
          });
        }
      }
    }

    // ── Draw ───────────────────────────────────────────────
    for (let i = 0; i < this._links.length; i++) {
      this._gfx[i].setPosition(this._links[i].x, this._links[i].y);
    }
  }

  destroy() {
    this._scene.events.off('update', this._update, this);
    this._gfx.forEach(g => g.destroy());
  }
}
