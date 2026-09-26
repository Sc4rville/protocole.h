import Phaser from 'phaser';

/**
 * Computer — retro pixel-art terminal prop.
 * White body, dark screen, keyboard base.
 * Origin = ground level, horizontally centred on the unit.
 * All coordinates in virtual pixels (×4 zoom applied by the camera).
 */
export default class Computer extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x       world x (virtual pixels)
   * @param {number} groundY world y of the ground surface
   */
  constructor(scene, x, groundY) {
    super(scene, x, groundY);
    scene.add.existing(this);

    const g = scene.add.graphics();
    this.add(g);

    // ── Palette ───────────────────────────────────────────────────────────
    const WHITE  = 0xffffff;
    const LGRAY  = 0xcccccc;   // side panels / depth
    const MGRAY  = 0x888888;   // keyboard keys
    const SCREEN = 0x111a11;   // very dark screen background
    const SGREEN = 0x1a3a1a;   // screen inner glow area

    // ── Keyboard / base — wider than monitor, sits on ground ─────────────
    //   x: -16 → +16  (32px wide)  y: -7 → 0  (7px tall)
    g.fillStyle(WHITE, 1);
    g.fillRect(-16, -7, 32, 5);    // main keyboard slab

    // slight angled front face (trapezoid illusion via triangles)
    g.fillTriangle(
      -16, -2,   -16,  0,   -14,  0,   // bottom-left bevel
    );
    g.fillTriangle(
       16, -2,    16,  0,    14,  0,   // bottom-right bevel
    );

    // Key rows — 3 rows of tiny keys
    g.fillStyle(MGRAY, 1);
    for (let row = 0; row < 3; row++) {
      const cols = row === 0 ? 10 : row === 1 ? 9 : 8;
      const startX = -15 + row;
      for (let col = 0; col < cols; col++) {
        g.fillRect(startX + col * 3, -6 + row * 2, 2, 1);
      }
    }

    // ── Monitor body ──────────────────────────────────────────────────────
    //   x: -13 → +11  (24px wide)  y: -26 → -7  (19px tall)
    g.fillStyle(WHITE, 1);
    g.fillRect(-13, -26, 24, 19);

    // right-side depth panel (slightly grayed)
    g.fillStyle(LGRAY, 1);
    g.fillRect(11, -24, 3, 17);   // side depth

    // ── Screen recess ────────────────────────────────────────────────────
    //   inset 2px from body edges: x: -11 → +9  y: -24 → -10
    g.fillStyle(SCREEN, 1);
    g.fillRect(-11, -24, 20, 14);

    // inner screen glow zone (slightly lighter, off-center)
    g.fillStyle(SGREEN, 1);
    g.fillRect(-9, -22, 16, 10);

    // scanlines — 1px dark lines every 2px for CRT feel
    g.fillStyle(0x000000, 0.4);
    for (let sy = -23; sy < -10; sy += 2) {
      g.fillRect(-11, sy, 20, 1);
    }

    // ── Control buttons — right side of monitor ───────────────────────────
    g.fillStyle(0x000000, 1);
    g.fillRect(12, -22, 2, 2);   // button 1 (power)
    g.fillRect(12, -18, 2, 1);   // button 2
    g.fillRect(12, -15, 2, 1);   // button 3

    // highlight on power button
    g.fillStyle(0xffffff, 1);
    g.fillRect(12, -22, 1, 1);

    // ── Outline — white 1px border around monitor body ───────────────────
    g.lineStyle(1, 0xdddddd, 1);
    g.strokeRect(-13, -26, 24, 19);

    // ── Hacking overlay (hidden until startHacking() is called) ───────────
    this._hackGfx = scene.add.graphics();
    this.add(this._hackGfx);
    this._hackGfx.setVisible(false);
    this._drawHackLines();

    this._hackTimer = null;
  }

  /** Draw static green terminal lines on the screen. */
  _drawHackLines() {
    const g = this._hackGfx;
    g.clear();
    // Each entry: [xOffset, width, y] — all within screen area x:-11..+9, y:-24..-10
    const lines = [
      [ 0, 12, -23],
      [ 0,  6, -21],
      [ 3,  8, -21],
      [ 0, 14, -19],
      [ 0,  4, -17],
      [ 5,  9, -17],
      [ 0, 10, -15],
      [ 2, 14, -13],
      [ 0,  7, -11],
      [ 8,  4, -11],
    ];
    g.fillStyle(0x33ff44, 1);
    for (const [ox, w, y] of lines) {
      g.fillRect(-11 + ox, y, w, 1);
    }
  }

  /** Start blinking green lines on the screen (robot is "hacking"). */
  startHacking() {
    if (this._hackTimer) return;
    this._hackGfx.setVisible(true);
    let visible = true;
    this._hackTimer = this.scene.time.addEvent({
      delay:    350,
      repeat:   -1,
      callback: () => {
        visible = !visible;
        this._hackGfx.setVisible(visible);
      },
    });
  }

  /** Stop the blinking animation. */
  stopHacking() {
    if (this._hackTimer) {
      this._hackTimer.remove();
      this._hackTimer = null;
    }
    this._hackGfx.setVisible(false);
  }
}
