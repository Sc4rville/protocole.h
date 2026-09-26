import Phaser from 'phaser';

/**
 * Robot — a container of rectangles representing a broken robot.
 *
 * All coordinates are in the virtual pixel space (before x4 zoom).
 *
 * The container origin is at the robot's feet center.
 * Positive Y = down (Phaser convention).
 *
 * Later: swap each this.add.rectangle() for a this.scene.add.sprite()
 * pointing to a spritesheet frame — no other change needed.
 */

// Robot states
export const RobotState = {
  LYING:       'lying',       // starts flat on the ground
  GETTING_UP:  'getting_up',  // slow, struggling rise
  STANDING:    'standing',    // upright but swaying
  WALKING:     'walking',     // limping forward
  STUMBLING:   'stumbling',   // losing balance
  RECOVERING:  'recovering',  // catching itself
};

const sfxStepsVolume = 0.8;

const METAL    = 0xffffff;
const TORSO    = 0xffffff; // torso only — slight gray
const METAL_BG = 0xaaaaaa; // back leg — slightly grayed for depth (side view)
const EYE      = 0xff2200;

export default class Robot extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x  world x (virtual pixels)
   * @param {number} y  world y (virtual pixels) — feet position
   */
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);

    // Add physics body to the container via a separate invisible body rectangle
    // (Containers can't have physics directly — we use a proxy sprite)
    this.body_proxy = scene.physics.add.existing(
      scene.add.rectangle(x, y - 12, 40, 22, 0x000000, 0),
    );
    this.body_proxy.body.setCollideWorldBounds(true);
    this.body_proxy.setDepth(10);

    this.state = RobotState.LYING;
    this.facingRight = true;

    // Movement intent from input
    this._moveIntent = 0; // -1, 0, +1

    // Stumble accumulator
    this._stumbleChance = 0;
    this._stumbleTimer = 0;

    // Per-part tween handles (so we can cancel them)
    this._tweens = [];

    this._buildParts();
    this._initSparks();
    this._poseLying();
    this._poseGrounded(); // head/leg/foot start flat at ground level

    // Start dormant — eye gray, blink suspended until activate() is called
    this._dormant = true;
    this.eye.setFillStyle(0x444444);
    this._scheduleBlink();
    // Scale x3 so the robot fills ~half the virtual screen height (31 local px × 3 = 93px ≈ VH/2)
    this.setScale(3, 3);

    // Sync container position to physics proxy each frame
    scene.events.on('update', this._syncToProxy, this);

    this.sfxSteps = scene.sound.add('robot-steps', { loop: true, volume: sfxStepsVolume });
    this.sfxCrawling = scene.sound.add('robot-crawling', { loop: true, volume: 1 });
    this.sfxWakeUp = scene.sound.add('robot-wakeup', { volume: 1 });
    this.sfxWakeUpFeedback = scene.sound.add('robot-wakeup', { volume: 0.8 });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Called by scene update with left/right intent (-1, 0, 1) */
  setMoveIntent(intent) {
    this._moveIntent = intent;
  }

  /** Trigger the get-up sequence */
  getUp() {
    if (this.state !== RobotState.LYING) return;
    this.state = RobotState.GETTING_UP;
    // Switch physics proxy to upright size
    this.body_proxy.body.setSize(30, 84);
    this.body_proxy.setPosition(this.body_proxy.x, this.body_proxy.y - 30);
    this._animateGetUp();
  }

  /** Shake torso/head/neck for ~0.5s without moving the container (camera unaffected). */
  shake(onComplete) {
    const torsoX = this.torso.x;
    const headX  = this.head.x;
    const neckX  = this.neck.x;
    const lowerLegRX  = this.lowerLegR.x;
    const footRX  = this.footR.x;
    this.scene.tweens.add({
      targets:  [this.torso, this.head, this.neck, this.lowerLegR, this.footR],
      x:        '+=1',
      duration: 50,
      yoyo:     true,
      repeat:   4,
      ease:     'Sine.easeInOut',
      onComplete: () => {
        this.torso.setX(torsoX);
        this.head.setX(headX);
        this.neck.setX(neckX);
        this.lowerLegR.setX(lowerLegRX);
        this.footR.setX(footRX);
        if (onComplete) onComplete();
      },
    });
  }

  _updateStepSound() {
    const shouldPlay = this.state === RobotState.WALKING && this._moveIntent !== 0;

    if (shouldPlay && !this.sfxSteps.isPlaying) {
      this.sfxSteps.setVolume(sfxStepsVolume);
      this.sfxSteps.play();
    } else if (!shouldPlay && this.sfxSteps.isPlaying) {
      this.scene.tweens.add({ targets: this.sfxSteps, volume: 0, duration: 200, ease: 'Linear', onComplete: () => this.sfxSteps.stop() });
    }
  }

  _updatCrawlingSound() {
    const shouldPlay = this.state === RobotState.LYING && this._moveIntent !== 0;

    if (shouldPlay && !this.sfxCrawling.isPlaying) {
      this.sfxCrawling.setVolume(1);
      this.sfxCrawling.play();
    } else if (!shouldPlay && this.sfxCrawling.isPlaying) {
      this.scene.tweens.add({ targets: this.sfxCrawling, volume: 0, duration: 200, ease: 'Linear', onComplete: () => this.sfxCrawling.stop() });
    }
  }

  update(delta) {
    this._syncToProxy();

    switch (this.state) {
      case RobotState.LYING:
        this._updateCrawling(delta);
        this._applyMovement(this._moveIntent);
        break;

      case RobotState.STANDING:
        this._updateStanding(delta);
        this._applyMovement(this._moveIntent);
        break;

      case RobotState.WALKING:
        this._updateWalking(delta);
        this._applyMovement(this._moveIntent);
        break;

      case RobotState.STUMBLING:
      case RobotState.RECOVERING:
      case RobotState.GETTING_UP:
        this._applyMovement(0);
        break;
    }

    // Keep arm and leg chains connected for all upright states
    if (this.state !== RobotState.LYING) {
      this._syncChain();
    }

    // Eye world position (outside container, so computed from container transform)
    this.eye.setPosition(
      this.x + (this.head.x + 2) * this.scaleX,
      this.y + (this.head.y + 1) * this.scaleY
    );
    this.eye.setAngle(this.head.angle * Math.sign(this.scaleX));

    // Mirror parts when facing left (preserve the x3 base scale)
    this.setScale(this.facingRight ? 3 : -3, 3);

    this._updateStepSound();
    this._updatCrawlingSound();
  }

  // ─── Eye blink ────────────────────────────────────────────────────────────

  _scheduleBlink() {
    this.scene.time.delayedCall(Phaser.Math.Between(2000, 3000), () => {
      if (this._dormant) return;                                // suspended while dormant
      this.eye.setFillStyle(0x222222);                          // dim
      this.scene.time.delayedCall(120, () => {
        if (this._dormant) return;
        this.eye.setFillStyle(EYE);                        // reopen
        this._scheduleBlink();                                  // reschedule
      });
    });
  }

  /** Flash the eye red for 100 ms then back to gray (dormant wake-up hint). */
  flickerEye() {
    this.eye.setFillStyle(EYE);
    this.scene.time.delayedCall(100, () => {
      if (this._dormant) this.eye.setFillStyle(0x444444);
    });
    this.scene.tweens.killTweensOf(this.sfxWakeUpFeedback);
    this.sfxWakeUpFeedback.stop();
    this.sfxWakeUpFeedback.setVolume(1);
    this.sfxWakeUpFeedback.play();
    this.scene.tweens.add({ targets: this.sfxWakeUpFeedback, duration: 200, volume:0 })
  }

  /** Prevent walk/crawl from overriding arm angle for durationMs. */
  lockArm(durationMs) {
    this._armLocked = true;
    if (this._armLockTimer) this._armLockTimer.remove(false);
    this._armLockTimer = this.scene.time.delayedCall(durationMs, () => {
      this._armLocked  = false;
      this._armLockTimer = null;
    });
  }

  /** Wake the robot up: eye stays red, normal blink cycle resumes. */
  activate() {
    this._dormant = false;
    this.eye.setFillStyle(EYE);
    this._scheduleBlink();
    this._burstSparks();
    this._animateFromGrounded();
    this.sfxWakeUp.setVolume(1);
    this.sfxWakeUp.play();
  }

  /** Several spark bursts spread over ~1s to mark the wake-up moment. */
  _burstSparks() {
    const burst = () => {
      const sx = this.x + this.torso.x * Math.abs(this.scaleX);
      const sy = this.y + this.torso.y * this.scaleY;
      this._sparks.explode(Phaser.Math.Between(12, 20), sx, sy);
    };
    burst();
    this.scene.time.delayedCall(200, burst);
    this.scene.time.delayedCall(500, burst);
    this.scene.time.delayedCall(900, burst);
  }

  // ─── Sparks ───────────────────────────────────────────────────────────────

  _initSparks() {
    // 1×1 white pixel texture, created once and reused
    if (!this.scene.textures.exists('pixel_spark')) {
      const g = this.scene.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture('pixel_spark', 1, 1);
      g.destroy();
    }

    this._sparks = this.scene.add.particles(0, 0, 'pixel_spark', {
      speed:    { min: 40,  max: 130 },
      angle:    { min: 200, max: 340 },   // upper arc (270° = straight up)
      scale:    { start: 4, end: 1 },
      alpha:    { start: 1, end: 0 },
      lifespan: { min: 700, max: 1400 },
      gravityY: 30,                       // weak gravity — sparks climb high
      emitting: false,
    }).setDepth(50);

    // Trigger first burst immediately on the first crawl frame
    this._sparkTimer = 0;
  }

  // ─── Build parts ──────────────────────────────────────────────────────────

  _buildParts() {
    const add = (w, h, color) => {
      const r = this.scene.add.rectangle(0, 0, w, h, color);
      this.add(r);
      return r;
    };

    // ── Back leg (left) — added first so it renders behind everything ─────
    this.hipL        = add(4,  3, METAL_BG);
    this.upperLegL   = add(4,  8, METAL_BG);
    this.kneeL       = add(3,  3, METAL_BG);
    this.lowerLegL   = add(3,  7, METAL_BG);
    this.footL       = add(4,  2, METAL_BG);

    // ── Torso ─────────────────────────────────────────────────────────────
    this.torso       = add(6, 10, TORSO);

    // ── Left arm stub ─────────────────────────────────────────────────────
    this.armLStub    = add(3,  3, METAL);

    // ── Front leg (right) — over torso ────────────────────────────────────
    this.hipR        = add(4,  3, METAL);
    this.upperLegR   = add(4,  8, METAL);
    this.kneeR       = add(3,  3, METAL);
    this.lowerLegR   = add(3,  7, METAL);
    this.footR       = add(4,  2, METAL);

    // ── Left leg stub (crawl only) ────────────────────────────────────────
    this.legLStub    = add(4,  3, METAL);

    // ── Neck ──────────────────────────────────────────────────────────────
    this.neck        = add(4,  3, METAL);

    // ── Head and eye ──────────────────────────────────────────────────────
    this.head        = add(6,  6, METAL);
    // eye lives outside the container so its depth is scene-independent (depth 85 = above dark overlay)
    this.eye = this.scene.add.rectangle(0, 0, 6, 6, EYE).setDepth(85);

    // ── Right arm — on top of everything (added last) ─────────────────────
    this.upperArmR   = add(3,  10, METAL).setOrigin(0.5, 0)
  }

  // ─── Poses — sets each part's x/y/angle within the container ─────────────

  /**
   * Upright standing pose.
   * Container origin = feet center, Y grows upward in our mental model
   * but Phaser Y grows DOWN, so "above feet" = negative Y.
   */
  _poseStanding() {
    // Torso — height 10, center at -17 → top≈-22, bottom≈-12 (covers hip gap)
    this.torso.setPosition(0, -17);

    // Head (above torso)
    this.head.setPosition(0, -26);

    // Right arm — mid-torso level
    this.upperArmR.setPosition(0, -18);
    this.upperArmR.setAngle(5);
    // Left arm stub — shoulder level
    this.armLStub.setPosition(-1, -22);
    this.armLStub.setAngle(-15);

    // Right leg — centered under torso (x=0)
    this.upperLegR.setPosition(0, -9);
    this.upperLegR.setAngle(0);
    this.lowerLegR.setPosition(0, -1);
    this.lowerLegR.setAngle(0);
    this.footR.setPosition(2, 3);
    this.footR.setAngle(0);

    // Left leg (side view — stacked at same x, behind in draw order)
    this.upperLegL.setPosition(0, -9);   this.upperLegL.setAngle(0);
    this.lowerLegL.setAngle(0);
    this.footL.setAngle(0);

    // Connectors
    this.neck.setPosition(0, -22);       this.neck.setAngle(0);
    this.hipR.setPosition(0, -13);       this.hipR.setAngle(0);
    this.kneeR.setPosition(0, -5);       this.kneeR.setAngle(0);
    this.hipL.setPosition(0, -13);       this.hipL.setAngle(0);
    this.kneeL.setPosition(0, -5);       this.kneeL.setAngle(0);

    // Reset main angles
    this.torso.setAngle(0);
    this.head.setAngle(0);
  }

  /** Flat on ground — all parts collapsed. */
  _poseLying() {
    this.torso.setPosition(0, -4);
    this.torso.setAngle(90);

    this.head.setPosition(9, -5);
    this.head.setAngle(0);

    // Arms splayed — kept above ground (local y <= 0)
    this.upperArmR.setPosition(0, -2);
    this.upperArmR.setAngle(-75);

    this.armLStub.setPosition(-4, -2);
    this.armLStub.setAngle(-20);

    // Legs flat
    this.upperLegR.setPosition(-3, -3);
    this.upperLegR.setAngle(-80);
    this.lowerLegR.setPosition(-9, -3);
    this.lowerLegR.setAngle(-75);
    this.footR.setPosition(-13, -3);

    this.legLStub.setPosition(-5, -1);
    this.legLStub.setAngle(-30);

    // Full left leg hidden until retrieved from dead robot
    this.hipL.setVisible(false);
    this.upperLegL.setVisible(false);
    this.lowerLegL.setVisible(false);
    this.footL.setVisible(false);
    this.kneeL.setVisible(false);

    // Connectors — flat, close to adjacent parts
    this.neck.setPosition(5,  -5);     this.neck.setAngle(0);
    this.hipR.setPosition(-2,  -3);    this.hipR.setAngle(-80);
    this.kneeR.setPosition(-7,  -3);   this.kneeR.setAngle(-75);
    this.hipL.setPosition(-4,  -2);    this.hipL.setAngle(-25);
  }

  /**
   * Override head, leg and foot to y=0 (flat on the ground) for the
   * dormant start state. Called once after _poseLying().
   */
  _poseGrounded() {
    this.head.setY(-2);
    this.neck.setY(-2);
    this.upperLegR.setY(-2);
    this.lowerLegR.setY(-2);
    this.footR.setY(-1);
    this.hipR.setY(-2);
    this.kneeR.setY(-2);
  }

  /**
   * Slow tween: head/leg/foot rise from ground level back to lying pose.
   * Called once on wake-up, before the crawl/get-up phase.
   */
  _animateFromGrounded() {
    const T    = this.scene.tweens;
    const dur  = 1600;
    const ease = 'Sine.easeOut';
    T.add({ targets: this.head,      y: -5,  duration: dur, ease });
    T.add({ targets: this.neck,      y: -5,  duration: dur, ease });
    T.add({ targets: this.upperLegR, y: -3,  duration: dur, ease });
    T.add({ targets: this.lowerLegR, y: -3,  duration: dur, ease });
    T.add({ targets: this.footR,     y: -1,  duration: dur, ease });
    T.add({ targets: this.hipR,      y: -3,  duration: dur, ease });
    T.add({ targets: this.kneeR,     y: -3,  duration: dur, ease });
  }

  // ─── Animations ───────────────────────────────────────────────────────────

  _animateGetUp() {
    const T = this.scene.tweens;

    // Phase 1 — robot stirs, head rises first
    T.add({ targets: this.head,  y: -10, angle: 15, duration: 100, ease: 'Sine.easeOut' });

    // Phase 2 — torso lifts — struggle
    this.scene.time.delayedCall(100, () => {
      T.add({ targets: this.torso, y: -5, angle: -20, duration: 100, ease: 'Sine.easeOut' });
      T.add({ targets: this.torso, y: -14, angle: -5,  duration: 80, ease: 'Sine.easeIn', delay: 500 });
    });

    // Phase 3 — right leg pushes (after 1000ms)
    this.scene.time.delayedCall(200, () => {
      T.add({ targets: this.upperLegR, angle: -40, y: -6, duration: 100 });
      T.add({ targets: this.lowerLegR, angle: -20,        duration: 100 });

      // Left leg stub flails
      T.add({ targets: this.legLStub, angle: 20, duration: 100, yoyo: true, repeat: 2 });
    });

    // Phase 4 — almost standing but stumbles
    this.scene.time.delayedCall(300, () => {
      // Fake-stand then lurch forward
      T.add({ targets: this.torso, y: -18, angle: 15, duration: 100, ease: 'Back.easeOut' });
      T.add({ targets: this.head,  y: -10, angle: 10, duration: 100 });
      T.add({ targets: this.upperLegR, angle: 0, y: -9, duration: 100 });
      T.add({ targets: this.lowerLegR, angle: 0,        duration: 100 });

      // Right arm flings out for balance
      T.add({ targets: this.upperArmR, angle: -60, duration: 50, yoyo: true });
    });

    // Phase 5 — settle into standing ; left leg becomes visible
    this.scene.time.delayedCall(400, () => {
      this._showLeftLeg();
      this._tweenToStanding(() => {
        this.state = RobotState.STANDING;
        this._startSway();
        this.scene.events.emit('robot-stood-up');
      });
    });
  }

  /** Make the full left leg appear (retrieved from the dead robot). */
  _showLeftLeg() {
    this.legLStub.setVisible(false);
    this.hipL.setPosition(0, -11).setAngle(-10).setVisible(true);
    this.upperLegL.setPosition(0, -8).setAngle(-25).setVisible(true);
    this.kneeL.setPosition(0, -6).setAngle(0).setVisible(true);
    this.lowerLegL.setPosition(0, -5).setAngle(-15).setVisible(true);
    this.footL.setPosition(2, -2).setAngle(0).setVisible(true);
  }

  _tweenToStanding(onComplete) {
    const dur = 200;
    const ease = 'Sine.easeOut';

    // Kill any lingering tweens on every part first — prevents position conflicts
    [this.torso, this.head, this.upperArmR, this.armLStub,
     this.upperLegR, this.lowerLegR, this.footR, this.legLStub,
     this.upperLegL, this.lowerLegL, this.footL,
     this.neck, this.hipR,
     this.kneeR, this.kneeL, this.hipL].forEach(p => {
      this.scene.tweens.killTweensOf(p);
    });

    // Parts tweened freely (position + angle) — NOT managed by _syncChain
    const free = [
      { t: this.torso,     x: 0,   y: -17, a: 0 },
      { t: this.head,      x: 0,   y: -26, a: 0 },
      { t: this.upperArmR, x: 0,   y: -18, a: 5 },
      { t: this.armLStub,  x: -1,  y: -22, a: -15 },
      { t: this.upperLegR, x: 0,   y: -9,  a: 0 },
      { t: this.upperLegL, x: 0,   y: -9,  a: 0 },
      { t: this.neck,      x: 0,   y: -22, a: 0 },
      { t: this.hipR,      x: 0,   y: -13, a: 0 },
      { t: this.hipL,      x: 0,   y: -13, a: 0 },
    ];

    // Chain-managed parts — angle ONLY (_syncChain handles their positions every frame)
    const chainAngles = [
      { t: this.lowerLegR, a: 0 },
      { t: this.lowerLegL, a: 0 },
    ];

    const total = free.length + chainAngles.length;
    let done = 0;
    const cb = () => { done++; if (done === total && onComplete) onComplete(); };

    free.forEach(({ t, x, y, a }) => {
      this.scene.tweens.add({ targets: t, x, y, angle: a, duration: dur, ease, onComplete: cb });
    });
    chainAngles.forEach(({ t, a }) => {
      this.scene.tweens.add({ targets: t, angle: a, duration: dur, ease, onComplete: cb });
    });
  }

  /** Gentle side-to-side sway while standing still. */
  _startSway() {
    this._stopTweens();
    const T = this.scene.tweens;
    this._swayTween = T.add({
      targets: this.torso,
      angle: { from: -3, to: 3 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // Head lags slightly
    this._swayHeadTween = T.add({
      targets: this.head,
      angle: { from: -2, to: 4 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 150,
    });
    // Left leg stub drifts passively
    T.add({
      targets: this.legLStub,
      angle: { from: 8, to: 13 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      repeatDelay: 1000,
    });
    // Arm stub — slow passive drift, no spasm
    T.add({
      targets: this.armLStub,
      angle: { from: -18, to: -10 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      repeatDelay: 800,
    });
  }

  /** Crawl cycle — robot drags itself with one arm and one leg. */
  _updateCrawling(delta) {
    // Freeze pose when idle — resume from the same point on next valid key press
    if (this._moveIntent === 0) return;

    this._crawlTime = (this._crawlTime || 0) + delta;
    const cycle = (this._crawlTime % 900) / 900; // 0..1 per crawl step
    const phase = Math.sin(cycle * Math.PI * 2);   // -1..1

    // Random spark bursts — fire from the robot's torso area in world space
    this._sparkTimer -= delta;
    if (this._sparkTimer <= 0) {
      const sx = this.x + this.torso.x * Math.abs(this.scaleX);
      const sy = this.y + this.torso.y * this.scaleY;
      this._sparks.explode(Phaser.Math.Between(8, 16), sx, sy);
      this._sparkTimer = Phaser.Math.Between(300, 1000);
    }

    // Right arm: reach forward then pull — chained like _syncChain
    if (!this._armLocked) this.upperArmR.setAngle(-75 + phase * 5);

    // Right leg: pushes backward to propel
    this.upperLegR.setAngle(-70 + phase * 20);       // -90°..-50°
    this.lowerLegR.setAngle(-60 + phase * 15);

    // Foot follows the tip of lowerLegR — stays connected, touches the ground
    const footPos = this._tipOf(this.lowerLegR);
    this.footR.setPosition(footPos.x, Math.min(footPos.y, 0));
    this.footR.setAngle(this.lowerLegR.angle);

    // Body shifts slightly with effort — no rocking angle (would disconnect left shoulder)
    const smoothAbs = phase * phase; // 0→1→0 per half-cycle, no derivative discontinuity
    this.torso.setAngle(90);
    this.torso.setY(-4 - smoothAbs * 1);           // lifts slightly, never positive

    // Head tries to lift to look ahead
    this.head.setAngle(10 - smoothAbs * 8);
    this.head.setX(8 - phase * 1);
    this.head.setY(-5);                              // locked above ground

    // Stubs drag passively — opposite phase (inertia)
    this.armLStub.setY(-2);
    this.armLStub.setAngle(-20 - phase * 6);
    this.legLStub.setY(-1);
    this.legLStub.setAngle(-28 + phase * 6);

    // Connectors — positioned as midpoints between adjacent parts, y clamped above ground
    const clampY = (y) => Math.min(y, -1);
    this.neck.setPosition(
      (this.head.x + this.torso.x) / 2,
      clampY((this.head.y + this.torso.y) / 2)
    );
    this.neck.setAngle(this.torso.angle);
    this.hipR.setPosition(
      (this.torso.x + this.upperLegR.x) / 2,
      clampY((this.torso.y + this.upperLegR.y) / 2)
    );
    this.hipR.setAngle(this.upperLegR.angle * 0.5);
    this.kneeR.setPosition(
      (this.upperLegR.x + this.lowerLegR.x) / 2,
      clampY((this.upperLegR.y + this.lowerLegR.y) / 2)
    );
    this.kneeR.setAngle(this.lowerLegR.angle);
    this.hipL.setPosition(
      (this.torso.x + this.legLStub.x) / 2,
      clampY((this.torso.y + this.legLStub.y) / 2)
    );
    this.hipL.setAngle(this.legLStub.angle * 0.5);
  }

  /** Walk cycle — thigh sine, shin cosine (90° delayed = natural knee lift). */
  _updateWalking(delta) {
    this._walkTime = (this._walkTime || 0) + delta;

    const CYCLE     = 700;  // ms per full stride
    const SWING     = 28;   // thigh swing amplitude (degrees)
    const SHIN_AMP  = 20;   // shin oscillation amplitude
    const SHIN_BIAS = 20;   // shin always this many degrees bent backward

    const t    = this._walkTime / CYCLE * Math.PI * 2;
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);

    // Thigh: sine wave.  Shin: cosine wave − bias.
    // When thigh crosses 0 going forward (sinT rising): cosT=+1 → shin=-AMP−BIAS (knee lifts)
    // When thigh at max forward:                         cosT=0  → shin=−BIAS (slight bend, foot plants)
    // When thigh crosses 0 going backward (sinT falling): cosT=-1 → shin=+AMP−BIAS ≈ 0 (straight, stance)
    // When thigh at max backward:                          cosT=0  → shin=−BIAS (bent back, push-off)
    this.upperLegR.setAngle( sinT * SWING);
    this.lowerLegR.setAngle(-cosT * SHIN_AMP - SHIN_BIAS);
    this.upperLegL.setAngle(-sinT * SWING);
    this.lowerLegL.setAngle( cosT * SHIN_AMP - SHIN_BIAS);

    // Subtle downward dip at max leg extension (no upward rise)
    const bob = Math.abs(sinT) * 0.5;
    this.torso.setY(-17 + bob);
    this.neck.setY(-22 + bob);
    this.head.setY(-26 + bob);

    // Arms swing same side as leg (inverted counter-swing)
    // sinT=+1 (right leg fwd): arm fwd +10°  → "\" shape
    // sinT=-1 (right leg back): arm back -30° → "/" shape
    if (!this._armLocked) this.upperArmR.setAngle(-10 + sinT * 42);
    this.armLStub.setAngle(-15 - sinT * 28);
  }

  _updateStanding(_delta) {
  }

  // ─── Stumble system ───────────────────────────────────────────────────────

  _scheduleStumble() {
    // Random delay 2–5 seconds before next possible stumble
    const delay = Phaser.Math.Between(2000, 5000);
    this.scene.time.delayedCall(delay, () => {
      if (this.state === RobotState.STANDING || this.state === RobotState.WALKING) {
        this._doStumble();
      } else {
        this._scheduleStumble(); // try again later
      }
    });
  }

  _doStumble() {
    this.state = RobotState.STUMBLING;
    this._stopTweens();

    const T = this.scene.tweens;

    // Pick a random stumble type
    const type = Phaser.Math.Between(0, 2);

    if (type === 0) {
      // Forward lurch — almost falls
      T.add({ targets: this.torso, angle: 35, y: -14, duration: 300, ease: 'Sine.easeIn' });
      T.add({ targets: this.head,  angle: 25, y: -22, duration: 300 });
      T.add({ targets: this.upperArmR, angle: -80, duration: 200 }); // arm flings out
      // Catch self
      this.scene.time.delayedCall(350, () => this._recover());

    } else if (type === 1) {
      // Knee buckle — right leg gives out
      T.add({ targets: this.upperLegR, angle: -30, duration: 200 });
      T.add({ targets: this.lowerLegR, angle:  40, duration: 200 });
      T.add({ targets: this.torso,     y: -13, angle: 10, duration: 250 });
      this.scene.time.delayedCall(300, () => this._recover());

    } else {
      // Shoulder spasm — arm stub jerks violently
      T.add({ targets: this.armLStub, angle: { from: -30, to: 20 }, duration: 80, yoyo: true, repeat: 4 });
      T.add({ targets: this.torso, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: 3 });
      this.scene.time.delayedCall(600, () => this._recover());
    }
  }

  _recover() {
    this.state = RobotState.RECOVERING;
    this._tweenToStanding(() => {
      this.state = RobotState.STANDING;
      this._startSway();
    });
  }

  // ─── Physics / movement ───────────────────────────────────────────────────

  _applyMovement(intent) {
    const speed = this.state === RobotState.LYING ? 18 : 83; // crawl slower, walk faster
    if (intent !== 0) {
      this.body_proxy.body.setVelocityX(intent * speed);
      this.facingRight = intent > 0;
      if (this.state === RobotState.STANDING) {
        this.state = RobotState.WALKING;
        this._walkTime = 0;
        if (this._swayTween) this._swayTween.stop();
        if (this._swayHeadTween) this._swayHeadTween.stop();
      }
    } else {
      this.body_proxy.body.setVelocityX(0);
      // Don't reset _crawlTime when lying — animation keeps running between pulses
      if (this.state !== RobotState.LYING) this._crawlTime = 0;
      if (this.state === RobotState.WALKING) {
        this.state = RobotState.STANDING;
        this._tweenToStanding(() => this._startSway());
      }
    }
  }

  _syncToProxy() {
    if (!this.body_proxy) return;
    // offset = proxy half-height, so container origin (feet) aligns with proxy bottom (ground)
    const offset = (this.state === RobotState.LYING || this.state === RobotState.GETTING_UP)
      ? 11 : 42;
    this.setPosition(this.body_proxy.x, this.body_proxy.y + offset);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Returns the position of the bottom tip of a rotated rectangle child. */
  _tipOf(part) {
    const DEG = Math.PI / 180;
    return {
      x: part.x + (part.height / 2) * Math.sin(part.angle * DEG),
      y: part.y + (part.height / 2) * Math.cos(part.angle * DEG),
    };
  }

  /**
   * Keeps limb chains rigid every frame.
   * - Elbow snaps to the tip of upperArmR; forearm extends from elbow.
   * - Knee snaps to the tip of upperLegR; lower leg extends from knee.
   * Only called for upright states (not LYING).
   */
  _syncChain() {
    const DEG = Math.PI / 180;

    // ── Right leg ─────────────────────────────────────────────────────────
    const kneeR = this._tipOf(this.upperLegR);
    this.kneeR.setPosition(kneeR.x, kneeR.y);
    this.kneeR.setAngle(this.upperLegR.angle * 0.4);

    const lRA = this.lowerLegR.angle * DEG;
    this.lowerLegR.setPosition(
      kneeR.x + (this.lowerLegR.height / 2) * Math.sin(lRA),
      kneeR.y + (this.lowerLegR.height / 2) * Math.cos(lRA),
    );
    const footPosR = this._tipOf(this.lowerLegR);
    this.footR.setPosition(footPosR.x + 2, footPosR.y); // +2 so foot points forward (right)
    this.footR.setAngle(0);

    // ── Left leg (only when visible) ─────────────────────────────────────
    if (this.upperLegL.visible) {
      const kneeL = this._tipOf(this.upperLegL);
      this.kneeL.setPosition(kneeL.x, kneeL.y);
      this.kneeL.setAngle(this.upperLegL.angle * 0.4);

      const lLA = this.lowerLegL.angle * DEG;
      this.lowerLegL.setPosition(
        kneeL.x + (this.lowerLegL.height / 2) * Math.sin(lLA),
        kneeL.y + (this.lowerLegL.height / 2) * Math.cos(lLA),
      );
      const footPosL = this._tipOf(this.lowerLegL);
      this.footL.setPosition(footPosL.x + 2, footPosL.y); // +2 so foot points forward
      this.footL.setAngle(0);
    }
  }

  _stopTweens() {
    if (this._swayTween) { this._swayTween.stop(); this._swayTween = null; }
    if (this._swayHeadTween) { this._swayHeadTween.stop(); this._swayHeadTween = null; }
  }

  destroy(fromScene) {
    this.scene.events.off('update', this._syncToProxy, this);
    if (this.sfxSteps) {
      this.sfxSteps.stop();
      this.sfxSteps.destroy();
    }
    if (this.body_proxy) this.body_proxy.destroy();
    if (this._sparks) this._sparks.destroy();
    if (this.eye) this.eye.destroy();
    super.destroy(fromScene);
  }
}
