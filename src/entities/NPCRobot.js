import Phaser from 'phaser';
import Robot, { RobotState } from './Robot.js';

const sfxGunFireVolume = 0.4;

/**
 * NPCRobot — fully intact robot NPC (blue eye, both legs, armed arm).
 *
 * Patrols 100 px left of its spawn point then turns around.
 * When the player enters within 100 px it stops and raises its armed arm.
 *
 * The armed-arm marker is a 1 px blue line baked into a sub-container that
 * replaces upperArmR.  The sub-container holds:
 *   • armRect  — 3×10 white rectangle (the arm itself)
 *   • armStripe — 1×10 blue rectangle at the left column of the arm
 * Both children rotate together with the container, so the stripe is always
 * solidary with the arm.  When the arm is raised to -90° the "left column"
 * becomes the topmost row → the blue line appears on top.
 */
export default class NPCRobot extends Robot {
  constructor(scene, x, y) {
    super(scene, x, y);

    // Kill any tweens started by the parent constructor (lying-pose animations)
    [this.torso, this.head, this.neck, this.upperArmR, this.armLStub,
     this.upperLegR, this.lowerLegR, this.footR, this.legLStub,
     this.upperLegL, this.lowerLegL, this.footL,
     this.hipR, this.hipL, this.kneeR, this.kneeL,
    ].forEach(p => scene.tweens.killTweensOf(p));

    // Show full left leg (NPC is intact)
    this.legLStub.setVisible(false);
    this.hipL.setVisible(true);
    this.upperLegL.setVisible(true);
    this.kneeL.setVisible(true);
    this.lowerLegL.setVisible(true);
    this.footL.setVisible(true);

    // ── Replace upperArmR with a sub-container holding arm + stripe ──────────
    // The original Rectangle upperArmR was the last child — remove it.
    this.remove(this.upperArmR, true);

    // Arm body (same geometry as the original Rectangle)
    const armRect   = scene.add.rectangle(0, 0, 3, 10, 0xffffff);
    armRect.setOrigin(0.5, 0);  // pivot at top-center, body hangs down

    // Blue stripe lives outside the container so its depth is scene-independent (depth 85)
    this.armStripe = scene.add.rectangle(0, 0, 3, 30, 0x4499ff).setOrigin(0.5, 0).setDepth(85);

    const armCont = scene.add.container(0, 0);
    armCont.add([armRect]);

    this.add(armCont);          // added last → highest z-order
    this.upperArmR = armCont;  // all existing code (tweens, setAngle…) targets this

    // Standing pose + correctly sized physics proxy
    this._poseStanding();
    this._syncChain();
    this.state = RobotState.STANDING;
    this.body_proxy.body.setSize(30, 84);
    this.body_proxy.setPosition(x, y - 42);

    // Blue eye, active
    this._dormant = false;
    this.eye.setFillStyle(0x0088ff);

    // Face left toward the approaching player
    this.facingRight = false;

    this._startSway();

    // Patrol state
    this._patrolOrigin = x;
    this._patrolDir    = -1;
    this._armRaised    = false;
    this._fired        = false;
    this._destroyed    = false;

    // sfx
    this.sfxGunFire = scene.sound.add('gunfire', { volume: sfxGunFireVolume });
  }

  // ── Override blink to keep blue eye instead of red ────────────────────────
  _scheduleBlink() {
    this.scene.time.delayedCall(Phaser.Math.Between(2000, 3000), () => {
      if (this._dormant || this._destroyed || !this.scene) return;
      this.eye.setFillStyle(0x222222);
      this.scene.time.delayedCall(120, () => {
        if (this._dormant || this._destroyed || !this.scene) return;
        this.eye.setFillStyle(0x0088ff);
        this._scheduleBlink();
      });
    });
  }

  // ── No sparks (fully functional robot) ───────────────────────────────────
  _initSparks() {
    this._sparks = { explode: () => {}, destroy: () => {} };
  }

  // ── Called every frame from GameScene ────────────────────────────────────
  _syncArmStripe() {
    this.armStripe
      .setPosition(
        this.x + this.upperArmR.x * this.scaleX,
        this.y + this.upperArmR.y * this.scaleY - 3
      )
      .setAngle(this.upperArmR.angle * Math.sign(this.scaleX))
      .setAlpha(this.alpha);
  }

  npcUpdate(delta, playerX) {
    if (this._fired) {
      this.setMoveIntent(0);
      this.update(delta);
      this._syncArmStripe();
      return;
    }

    const dist = Math.abs(this.x - playerX);

    if (this._armRaised) {
      // Once arm is raised, stop forever and face the player
      this.facingRight = playerX > this.x;
      this.setMoveIntent(0);
    } else if (dist < 200) {
      this.facingRight = playerX > this.x;
      this._armRaised  = true;
      this.scene.time.delayedCall(260, () => this._raiseArm());
      this.setMoveIntent(0);
    } else {
      const leftBound  = this._patrolOrigin - 100;
      const rightBound = this._patrolOrigin;
      if (this.x <= leftBound)  this._patrolDir = 1;
      if (this.x >= rightBound) this._patrolDir = -1;
      this.setMoveIntent(this._patrolDir);
    }

    this.update(delta);
    this._syncArmStripe();
  }

  _raiseArm() {
    this.sfxGunFire.setVolume(sfxGunFireVolume);
    this.sfxGunFire.play();
    this.scene.tweens.killTweensOf(this.upperArmR);
    this.scene.tweens.add({
      targets:    this.upperArmR,
      angle:      -90,
      duration:   400,
      ease:       'Sine.easeOut',
      onComplete: () => {
        this._fireTimer = this.scene.time.delayedCall(500, () => {
          this._fireTimer = null;
          this._fired = true;
          const armWorldY = this.y + this.upperArmR.y;
          this.scene.events.emit('npc-fire', this, this.x, armWorldY, this.facingRight);
          // Recoil: kick arm back from -90° then return
          this.scene.tweens.killTweensOf(this.upperArmR);
          this.scene.tweens.add({
            targets:  this.upperArmR,
            angle:    -70,
            duration: 60,
            ease:     'Sine.easeOut',
            onComplete: () => {
              this.scene.tweens.add({ targets: this.upperArmR, angle: -90, duration: 200, ease: 'Sine.easeOut' });
            },
          });
        });
      },
    });
  }

  reset() {
    this._fired     = false;
    this._armRaised = false;
    this._destroyed = false;
    this.setAlpha(1);
    this.setVisible(true);
    this.eye.setAlpha(1);
    this.armStripe.setAlpha(1);
    if (this._fireTimer) { this._fireTimer.remove(); this._fireTimer = null; }
    this._lowerArm();
  }

  destroy(fromScene) {
    if (this.armStripe) this.armStripe.destroy();
    super.destroy(fromScene);
  }

  _lowerArm() {
    this._armRaised = false;
    this.scene.tweens.killTweensOf(this.upperArmR);
    this.scene.tweens.add({
      targets:  this.upperArmR,
      angle:    5,
      duration: 400,
      ease:     'Sine.easeOut',
    });
  }

  _updateStepSound() {
    // disabled for the moment
  }
}
