import Phaser from 'phaser';

/**
 * SurveillanceCamera — hanging camera with a sweeping spotlight beam.
 *
 * Container origin = top of the camera housing (world x, y).
 * Positive Y goes down (Phaser convention).
 *
 * Beam: 45° sector with true radial gradient (canvas texture), center at lens,
 * radius 150 px. Rotates -80°↔+80° in sync with the lens sweep.
 * On detection: beam turns red and tracks the robot for 500 ms, then fires a
 * guaranteed-hit laser that explodes at the robot's current position.
 */
export default class SurveillanceCamera extends Phaser.GameObjects.Container {
  constructor(scene, x, y, groundY = 120) {
    super(scene, x, y);
    this._groundY = groundY;
    scene.add.existing(this);

    const HOUSING_R = 7;
    const HOUSING_Y = HOUSING_R;
    const LENS_R    = 3;
    const LENS_AMP  = HOUSING_R - LENS_R - 1; // = 3
    const BEAM_OY   = HOUSING_Y + 2;          // lens centre y = 9

    const R         = 150;
    const HALF_DEG  = 22.5;
    const MAX_DEG   = 80;

    // ── Spotlight beam — 45° sector, true radial gradient ─────────────────
    if (!scene.textures.exists('cam_beam')) {
      const size   = R * 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx    = canvas.getContext('2d');

      const grd = ctx.createRadialGradient(R, R, 0, R, R, R);
      grd.addColorStop(0, 'rgba(255,255,255,0.75)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');

      const half = HALF_DEG * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(R, R);
      ctx.arc(R, R, R, Math.PI / 2 - half, Math.PI / 2 + half);
      ctx.closePath();
      ctx.fillStyle = grd;
      ctx.fill();

      scene.textures.addCanvas('cam_beam', canvas);
    }

    const spotlight = scene.add.image(-LENS_AMP, BEAM_OY, 'cam_beam');
    spotlight.setOrigin(0.5, 0.5);
    spotlight.setAngle(MAX_DEG);
    this.add(spotlight);

    // ── Housing ───────────────────────────────────────────────────────────
    const housing = scene.add.arc(0, HOUSING_Y, HOUSING_R, 0, 360, false, 0xffffff);
    this.add(housing);

    // ── Lens — sweeps left ↔ right ────────────────────────────────────────
    const lens = scene.add.arc(0, HOUSING_Y + 2, LENS_R, 0, 360, false, 0x111111);
    this.add(lens);

    this._lensTween = scene.tweens.add({
      targets:  lens,
      x:        { from: -LENS_AMP, to: LENS_AMP },
      duration: 4000,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
      onUpdate: () => {
        spotlight.setPosition(lens.x, BEAM_OY);
        spotlight.setAngle(-(lens.x / LENS_AMP) * MAX_DEG);
      },
    });

    // Store refs needed for head detection
    this._lens      = lens;
    this._spotlight = spotlight;
    this._lensAmp   = LENS_AMP;
    this._beamOY    = BEAM_OY;
    this._beamR     = R - 20;
    this._halfRad   = HALF_DEG * (Math.PI / 180);
    this._maxDeg    = MAX_DEG;
    this._alerted   = false;
    this._tracking  = false;
    this._lastHeadX = 0;
    this._lastHeadY = 0;
  }

  /**
   * Call every frame with the robot head's world position.
   * Phase 1 (normal): sweeping beam, detect on entry → go to phase 2.
   * Phase 2 (tracking, 500 ms): beam follows robot, then fires.
   */
  checkHead(headX, headY) {
    if (this._alerted) return;

    if (this._tracking) {
      this._updateBeamToTarget(headX, headY);
      this._lastHeadX = headX;
      this._lastHeadY = headY;
      return;
    }

    // ── Detection check ───────────────────────────────────────────────────
    const ax = this.x + this._lens.x;
    const ay = this.y + this._beamOY;
    const dy = headY - ay;
    const dx = headX - ax;

    if (dy <= 0) return;
    if (Math.abs(dy) > this._beamR || Math.abs(dx) > this._beamR) return;

    const theta   = (this._lens.x / this._lensAmp) * this._maxDeg * (Math.PI / 180);
    const centerX = ax + dy * Math.tan(theta);
    const halfW   = dy * Math.tan(this._halfRad);

    if (headX < centerX - halfW || headX > centerX + halfW) return;

    // ── Detected — start tracking phase ──────────────────────────────────
    this._tracking  = true;
    this._lastHeadX = headX;
    this._lastHeadY = headY;
    this._spotlight.clearTint();
    this._lensTween.pause();
    this._alertTween = this.scene.tweens.add({
      targets:  this._spotlight,
      alpha:    0,
      duration: 80,
      yoyo:     true,
      repeat:   -1,
      ease:     'Linear',
    });
    this.scene.time.delayedCall(500, () => this._fire());

    // sfx
    this.scene.sfxWarningAlarm.play();
  }

  reset() {
    this._alerted  = false;
    this._tracking = false;
    if (this._alertTween) { this._alertTween.stop(); this._alertTween = null; }
    this._spotlight.setAlpha(1);
    this._spotlight.clearTint();
    this._lensTween.resume();
  }

  _updateBeamToTarget(headX, headY) {
    const ax  = this.x;
    const ay  = this.y + this._beamOY;
    const dx  = headX - ax;
    const dy  = headY - ay;
    const deg = Math.atan2(dx, dy) * (180 / Math.PI);
    const clamped = Phaser.Math.Clamp(deg, -this._maxDeg, this._maxDeg);

    this._lens.x = (clamped / this._maxDeg) * this._lensAmp;
    this._spotlight.setPosition(this._lens.x, this._beamOY);
    this._spotlight.setAngle(-clamped);
  }

  _fire() {
    this._alerted = true;
    if (this._alertTween) { this._alertTween.stop(); this._alertTween = null; }
    this._spotlight.setAlpha(0);

    const startX = this.x + this._lens.x;
    const startY = this.y + this._beamOY;
    const headX  = this._lastHeadX;
    const headY  = this._lastHeadY;

    const dx    = headX - startX;
    const dy    = headY - startY;
    const dist  = Math.sqrt(dx * dx + dy * dy);
    const speed = 400; // px/s in virtual coords
    const duration = (dist / speed) * 1000;

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const bolt  = this.scene.add.rectangle(startX, startY, 8, 4, 0xffffff);
    bolt.setAngle(angle);
    bolt.setDepth(20);

    const aura = this.scene.add.arc(startX, startY, 20, 0, 360, false, 0xffffff);
    aura.setAlpha(0.3);
    aura.setDepth(19);

    this.scene.tweens.add({
      targets:  [bolt, aura],
      x:        headX,
      y:        headY,
      duration,
      ease:     'Linear',
      onComplete: () => {
        bolt.destroy();
        aura.destroy();
        this._explode(headX, headY);
        this.scene.events.emit('camera-hit', headX, headY);
      },
    });

    this.scene.sfxCamFire.play();
  }

  _explode(x, y) {
    if (!this.scene.textures.exists('pixel_spark')) {
      const g = this.scene.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture('pixel_spark', 1, 1);
      g.destroy();
    }
    const emitter = this.scene.add.particles(0, 0, 'pixel_spark', {
      speed:    { min: 20, max: 80 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 3, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 500,
      emitting: false,
    });
    emitter.setDepth(25);
    emitter.explode(15, x, y);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }
}
