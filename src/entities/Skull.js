import Phaser from 'phaser';

/**
 * Skull — human skull with an Arcade physics body.
 *
 * Starts frozen (no gravity, immovable) so it can be stacked in a pyramid
 * without jitter.  Call push() to activate physics and launch it.
 *
 * Visual size: ~16 wide × 18 tall virtual pixels.
 * Container origin is at the skull base (ground level).
 * Physics proxy: 14 wide × 14 tall px, centre 7 px above groundY.
 */
export default class Skull extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x        world x (virtual pixels)
   * @param {number} groundY  world y of the surface this skull rests on
   */
  constructor(scene, x, groundY) {
    super(scene, x, groundY);
    scene.add.existing(this);

    // ── Visuals ───────────────────────────────────────────────────────────
    this._buildParts();

    // ── Arcade physics proxy ──────────────────────────────────────────────
    // 14×14 px rectangle; centre at groundY-7 so bottom aligns with groundY
    this._proxy = scene.add.rectangle(x, groundY - 7, 14, 14, 0x000000, 0);
    scene.physics.add.existing(this._proxy);
    const body = /** @type {Phaser.Physics.Arcade.Body} */ (this._proxy.body);
    body.setCollideWorldBounds(true);
    body.setDragX(120);
    body.setBounce(0, 0.18);
    // Start frozen — activated on push()
    body.setAllowGravity(false);
    body.setImmovable(true);

    this._activated = false;

    scene.events.on('update', this._sync, this);
  }

  // ─── Accessor ─────────────────────────────────────────────────────────────

  get proxy() { return this._proxy; }

  // ─── Build parts ──────────────────────────────────────────────────────────

  /**
   * Build skull from individual Shape objects so their fill colour can be
   * tweened later.  White parts are stored in this._whiteParts.
   *
   * fillRect(x, y, w, h) uses top-left origin →
   * Phaser Rectangle/Ellipse uses centre origin → cx = x+w/2, cy = y+h/2.
   */
  _buildParts() {
    const add = (obj) => { this.add(obj); return obj; };

    // White parts — will be darkened on push()
    this._whiteParts = [
      add(this.scene.add.ellipse(0, -12, 16, 12, 0xffffff)),   // cranium
      add(this.scene.add.rectangle(0, -5, 8, 4, 0xffffff)),    // jaw
    ];

    // Black holes — static
    [
      this.scene.add.rectangle(-3.5, -13, 3, 4, 0x000000),     // left eye socket
      this.scene.add.rectangle( 3.5, -13, 3, 4, 0x000000),     // right eye socket
      this.scene.add.rectangle( 0,   -9,  2, 2, 0x000000),     // nose cavity
      this.scene.add.rectangle(-2.5, -5,  1, 2, 0x000000),     // teeth left
      this.scene.add.rectangle( 0,   -5,  2, 2, 0x000000),     // teeth centre
      this.scene.add.rectangle( 2.5, -5,  1, 2, 0x000000),     // teeth right
    ].forEach(r => add(r));
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  _sync() {
    // proxy centre y = groundY - 7; container origin = groundY → offset +7
    this.setPosition(this._proxy.x, this._proxy.y + 7);
  }

  // ─── Push ─────────────────────────────────────────────────────────────────

  /**
   * Activate physics and launch the skull in the given world-space angle.
   * @param {number} [strength=1]    velocity multiplier
   * @param {number} [waveAngle=0]   radians, 0 = rightward
   */
  push(strength = 1, waveAngle = 0) {
    if (this._activated) return;
    this._activated = true;

    const body = /** @type {Phaser.Physics.Arcade.Body} */ (this._proxy.body);
    body.setAllowGravity(true);
    body.setImmovable(false);

    const speed = (45 + Math.random() * 35) * strength;
    // Mix radial direction with a rightward bias so skulls scatter forward
    const vx = (Math.cos(waveAngle) * 0.6 + 0.4) * speed + (Math.random() - 0.5) * 15;
    const vy = Math.sin(waveAngle) * speed - 18 - Math.random() * 10;
    body.setVelocity(vx, vy);

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets:  this,
      angle:    (Math.random() - 0.4) * 160,
      duration: 600,
      ease:     'Sine.easeOut',
    });

    // Darken the white parts over 1s via colour interpolation
    const colorProxy = { t: 0 };
    const from = Phaser.Display.Color.ValueToColor(0xffffff);
    const to   = Phaser.Display.Color.ValueToColor(0x888888);
    this.scene.tweens.add({
      targets:  colorProxy,
      t:        1,
      duration: 1000,
      ease:     'Sine.easeIn',
      onUpdate: () => {
        const c   = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 1, colorProxy.t);
        const hex = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        for (const part of this._whiteParts) {
          part.setFillStyle(hex);
        }
      },
    });
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(fromScene) {
    this.scene.events.off('update', this._sync, this);
    if (this._proxy) this._proxy.destroy();
    super.destroy(fromScene);
  }
}
