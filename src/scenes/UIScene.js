import Phaser from 'phaser';
import i18n from '../i18n.js';

/**
 * UIScene — overlay scene for HUD / subtitles.
 *
 * Runs on top of GameScene. No zoom, no follow camera.
 * Coordinates are raw canvas pixels (1280 × 720).
 *
 * Events received on this.game.events:
 *   'subtitle-show'  { text }  — show text in the subtitle band
 *   'subtitle-hide'            — fade the band out
 */
export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: false });
  }

  preload() {
    this.load.bitmapFont(
      'subtitle',
      'fonts/FreePixel-16.png',
      'fonts/FreePixel-16.xml',
    );
  }

  create() {
    const W  = 1280;
    const H  = 720;
    const BW = W * 0.9;   // 1024px

    // ── Speech (dialogue) band — slightly raised, reduced height ─────────
    const BH_DLG   = 50;
    const SPEECH_Y = H - 110;   // center of dialogue band (≈ 610)

    // ── Instruction band — black bg, just below dialogue ─────────────────
    const BH_INSTR = 66;
    const INSTR_Y  = SPEECH_Y + BH_DLG / 2 + 4 + BH_INSTR / 2;

    // ── Vignette — radial gradient transparent→black, covers full screen ─
    const vigR   = 800;
    const vigSz  = vigR * 2;
    const canvas = document.createElement('canvas');
    canvas.width  = vigSz;
    canvas.height = vigSz;
    const ctx  = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(vigR, vigR, 0, vigR, vigR, vigR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vigSz, vigSz);
    this.textures.addCanvas('vignette', canvas);
    this.add.image(560, 480, 'vignette');

    // ── Initial vignette boost — heavy overlay that fades on wake-up ──────
    this._vigBoost = this.add.rectangle(W / 2, H / 2, W, H, 0x000000)
      .setAlpha(0.72)
      .setDepth(9);

    // ── Speech band — white bg, black text ───────────────────────────────
    this._bg = this.add.rectangle(W / 2, SPEECH_Y, BW, BH_DLG, 0xffffff)
      .setOrigin(0.5, 0.5)
      .setDepth(11)
      .setAlpha(0);

    this._text = this.add.bitmapText(W / 2, SPEECH_Y, 'subtitle', '', 32)
      .setOrigin(0.5, 0.5)
      .setTintFill(0x000000)
      .setMaxWidth(BW - 20)
      .setDepth(11)
      .setAlpha(0);

    // ── Instruction band — black bg, white text, below dialogue ──────────
    this._instrBg = this.add.rectangle(W / 2, INSTR_Y, BW, BH_INSTR, 0x000000)
      .setOrigin(0.5, 0.5)
      .setDepth(11)
      .setVisible(false);

    const isTouch = this.sys.game.device.input.touch || ('ontouchstart' in window);
    this._instrText = this.add.bitmapText(W / 2, INSTR_Y, 'subtitle', isTouch ? i18n.instrStartTouch : i18n.instructionStart, 32)
      .setOrigin(0.5, 0.5)
      .setTint(0xffffff)
      .setVisible(false)
      .setDepth(11)
      .setMaxWidth(BW - 10);

    this.time.delayedCall(2000, () => {
      this._instrText.setVisible(true);
      this._instrBg.setVisible(true);
    });

    // ── Events ────────────────────────────────────────────────────────────
    // Fade out initial vignette boost when camera transitions to follow
    this.game.events.on('camera-released', () => {
      this.tweens.add({
        targets:  this._vigBoost,
        alpha:    0,
        duration: 2500,
        ease:     'Sine.easeOut',
      });
    }, this);

    // Initial instruction fade-out on wake-up
    this.game.events.on('instruction-hide', () => {
      this.tweens.add({
        targets: [this._instrBg, this._instrText],
        alpha: 0,
        duration: 400,
      });
    }, this);

    // Dynamic instruction band (dialogue prompts)
    this.game.events.on('instr-show', ({ text }) => {
      this._instrText.setText(text);
      this.tweens.killTweensOf([this._instrBg, this._instrText]);
      this._instrBg.setSize(this._instrText.width + 40, this._instrBg.height);
      this._instrBg.setAlpha(1);
      this._instrText.setAlpha(1);
    }, this);

    this.game.events.on('instr-hide', () => {
      this.tweens.add({
        targets:  [this._instrBg, this._instrText],
        alpha:    0,
        duration: 500,
      });
    }, this);

    this.game.events.on('subtitle-show', ({ text }) => {
      this._text.setText(text);
      this._bg.setSize(this._text.width + 40, this._bg.height);
      this._bg.setAlpha(1);
      this._text.setAlpha(1);
    }, this);

    this.game.events.on('subtitle-hide', () => {
      this.tweens.add({
        targets: [this._bg, this._text],
        alpha: 0,
        duration: 800,
      });
    }, this);

    // ── Title card ("It was the robots") ─────────────────────────────────
    this._titleOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000)
      .setAlpha(0).setDepth(10);

    this._titleText = this.add.bitmapText(W / 2, H / 2 - 120, 'subtitle', i18n.titleCard, 128)
      .setOrigin(0.5, 0.5)
      .setTint(0xffffff)
      .setAlpha(0)
      .setDepth(11)
      .setCenterAlign();

    this._subTitleText = this.add.bitmapText(W / 2, H / 2 + 120, 'subtitle', i18n.endMessage, 32)
      .setOrigin(0.5, 0.5)
      .setTint(0xffffff)
      .setAlpha(0)
      .setDepth(11)
      .setCenterAlign();

    this._gameTimeText = this.add.bitmapText(W / 2, H - 60, 'subtitle', '', 32)
      .setOrigin(0.5, 0.5)
      .setTint(0xffffff)
      .setAlpha(0)
      .setDepth(11);

    this.game.events.on('game-time', ({ text }) => {
      this._gameTimeText.setText(text);
      this.time.delayedCall(4000, () => this.tweens.add({ targets: this._gameTimeText, alpha: 1, duration: 1000, ease: 'Sine.easeIn' }));
    }, this);

    this.game.events.on('title-card-show', () => {
      this.tweens.killTweensOf([this._titleOverlay, this._titleText]);
      this.tweens.add({ targets: this._titleOverlay, alpha: 0.7, duration: 1500, ease: 'Sine.easeIn' });
      this.tweens.add({ targets: this._titleText,    alpha: 1,    duration: 3000, ease: 'Sine.easeIn' });
    }, this);

    this.game.events.on('subtitle-card-show', () => {
      this.tweens.add({ targets: this._subTitleText, alpha: 1, duration: 3000, ease: 'Sine.easeIn' });
    }, this);

    this.game.events.on('title-card-hide', () => {
      this.tweens.killTweensOf([this._titleOverlay, this._titleText]);
      this.tweens.add({
        targets:  [this._titleOverlay, this._titleText],
        alpha:    0,
        duration: 800,
        ease:     'Sine.easeOut',
      });
    }, this);

    this._createTouchControls();
  }

  // ── Virtual joystick + fire button (touch screens only) ──────────────────
  // Both controls are floating: they appear wherever the finger lands.
  // First touch  → joystick (movement + directions)
  // Second touch → fire button (tap = space, hold = charge)
  _createTouchControls() {
    const isTouch = this.sys.game.device.input.touch || ('ontouchstart' in window);
    if (!isTouch) return;

    const gs = this.scene.get('GameScene');

    const JOR = 72, JIR = 30;   // joystick outer / inner radius
    const FR  = 50;              // fire button radius

    // ── Joystick visuals (hidden until first touch) ───────────────────────
    const joyRing = this.add.circle(0, 0, JOR, 0xffffff, 0.10)
      .setStrokeStyle(2, 0xffffff, 0.30).setDepth(20).setVisible(false);
    const joyKnob = this.add.circle(0, 0, JIR, 0xffffff, 0.40)
      .setDepth(21).setVisible(false);

    // ── Fire button visuals (hidden until second touch) ───────────────────
    const fireRing = this.add.circle(0, 0, FR, 0xffffff, 0.10)
      .setStrokeStyle(2, 0xffffff, 0.30).setDepth(20).setVisible(false);
    const fireDot  = this.add.circle(0, 0, 16, 0xffffff, 0.45)
      .setDepth(21).setVisible(false);

    // ── State ─────────────────────────────────────────────────────────────
    let joyPtrId = null, joyCX = 0, joyCY = 0;
    let firePtrId = null;

    const updateJoy = (px, py) => {
      const dx   = px - joyCX, dy = py - joyCY;
      const dist = Math.hypot(dx, dy);
      const cl   = Math.min(dist, JOR);
      const ang  = Math.atan2(dy, dx);
      joyKnob.setPosition(joyCX + Math.cos(ang) * cl, joyCY + Math.sin(ang) * cl);
      const dead = 18;
      if (gs) {
        gs._virtX = dist > dead ? dx / Math.max(dist, 1) : 0;
        gs._virtY = dist > dead ? dy / Math.max(dist, 1) : 0;
      }
    };

    const showJoy = (x, y) => {
      joyCX = x; joyCY = y;
      joyRing.setPosition(x, y).setVisible(true);
      joyKnob.setPosition(x, y).setVisible(true);
    };

    const hideJoy = () => {
      joyRing.setVisible(false);
      joyKnob.setVisible(false);
      joyPtrId = null;
      if (gs) { gs._virtX = 0; gs._virtY = 0; }
    };

    const showFire = (x, y) => {
      fireRing.setPosition(x, y).setVisible(true);
      fireDot.setPosition(x, y).setVisible(true);
    };

    const hideFire = () => {
      fireRing.setVisible(false);
      fireDot.setVisible(false);
      firePtrId = null;
      if (gs) gs._virtFireHeld = false;
    };

    this.input.on('pointerdown', (ptr) => {
      if (joyPtrId === null) {
        joyPtrId = ptr.id;
        showJoy(ptr.x, ptr.y);
        if (gs) gs._virtFire = true;
      } else if (firePtrId === null) {
        firePtrId = ptr.id;
        showFire(ptr.x, ptr.y);
        if (gs) { gs._virtFire = true; gs._virtFireHeld = true; }
      }
    });

    this.input.on('pointermove', (ptr) => {
      if (ptr.id === joyPtrId) updateJoy(ptr.x, ptr.y);
    });

    const releasePtr = (ptr) => {
      if (ptr.id === joyPtrId) hideJoy();
      if (ptr.id === firePtrId) hideFire();
    };

    this.input.on('pointerup',        releasePtr);
    this.input.on('pointerupoutside', releasePtr);
  }
}
