import Phaser from 'phaser';

/**
 * DeadRobot — robot corpse in an inverted-L pose against a wall.
 *
 * Body vertical, one leg flat on the ground.
 * The wall itself is a separate Wall entity (placed behind this in the scene).
 * Static prop — no physics.  Scale ×3.
 * Container origin = ground level.
 */
export default class DeadRobot extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x       world x (virtual pixels)
   * @param {number} groundY world y of the ground surface
   */
  constructor(scene, x, groundY) {
    super(scene, x, groundY);
    scene.add.existing(this);

    const METAL = 0xeeeeee;
    const EYE   = 0x999999;

    const add = (w, h, color) => {
      const r = scene.add.rectangle(0, 0, w, h, color);
      this.add(r);
      return r;
    };

    // ── Torso — upright against the wall ─────────────────────────────────
    const torso = add(8, 7, METAL);
    torso.setPosition(0, -13);

    // ── Neck ──────────────────────────────────────────────────────────────
    const neck = add(4, 3, METAL);
    neck.setPosition(0, -18);

    // ── Head — slightly drooped ───────────────────────────────────────────
    const head = add(6, 6, METAL);
    head.setPosition(-2, -20);
    head.setAngle(-30);

    // ── Eye (grey) ────────────────────────────────────────────────────────
    const eye = add(2, 2, EYE);
    eye.setPosition(-4, -19);
    eye.setAngle(-30);

    // ── Hip connector — bridges torso to horizontal leg ───────────────────
    const hip = add(8, 6, METAL);
    hip.setPosition(0, -6);
    hip.setAngle(88);

    // ── Leg — flat on the ground, extending left ──────────────────────────
    const upperLeg = add(4, 8, METAL);
    upperLeg.setPosition(-1, -2);
    upperLeg.setAngle(88);

    const knee = add(3, 3, METAL);
    knee.setPosition(-6, -3);
    knee.setAngle(88);

    const lowerLeg = add(3, 7, METAL);
    lowerLeg.setPosition(-10, -2);
    lowerLeg.setAngle(70);

    const foot = add(4, 3, METAL);
    foot.setPosition(-15, -1);

    // Store parts for interaction
    this._legParts  = [hip, upperLeg, knee, lowerLeg, foot];
    this._bodyParts = { torso, neck, head, eye };

    this.setScale(3, 3);
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  /** Brief horizontal shake — only the robot body, not the wall. */
  shake() {
    const orig = this.x;
    this.scene.tweens.add({
      targets:    this,
      x:          orig + 4,
      duration:   50,
      yoyo:       true,
      repeat:     2,
      ease:       'Sine.easeInOut',
      onComplete: () => this.setX(orig),
    });
  }

  /**
   * Fade the leg parts out, then call onComplete.
   */
  removeLeg() {
    this.scene.tweens.add({
      targets:    this._legParts,
      alpha:      0,
      duration:   600,
      ease:       'Sine.easeOut',
    });
  }

  /**
   * Body and head topple forward (left) onto the ground once the leg is gone.
   * Torso and neck tip over; head slides down and off.
   */
  collapse() {
    const T    = this.scene.tweens;
    const ease = 'Sine.easeIn';
    const { torso, neck, head, eye } = this._bodyParts;

    // Torso tips forward (rotates ~90° and drops to ground)
    T.add({ targets: torso, x: -6,  y: -4,  angle: 85,  duration: 700, ease });
    // Neck follows torso base
    T.add({ targets: neck,  x: -2,  y: -8,  angle: 80,  duration: 600, ease, delay: 50 });
    // Head swings forward and down, landing beyond torso
    T.add({ targets: head,  x: -10, y: -5,  angle: -85, duration: 750, ease, delay: 100 });
    // Eye stays on head
    T.add({ targets: eye,   x: -12, y: -5,  angle: -85, duration: 750, ease, delay: 100 });
  }
}
