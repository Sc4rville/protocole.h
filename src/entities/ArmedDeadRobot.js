import DeadRobot from './DeadRobot.js';

/**
 * ArmedDeadRobot — variant of DeadRobot with a removable armed arm.
 * The arm has a blue stripe at its top (shoulder area) identifying it as the weapon arm.
 */
export default class ArmedDeadRobot extends DeadRobot {
  constructor(scene, x, groundY) {
    super(scene, x, groundY);

    const METAL    = 0xeeeeee;
    const ARM_BLUE = 0x4499ff;

    const addPart = (w, h, color) => {
      const rect = scene.add.rectangle(0, 0, w, h, color);
      this.add(rect);
      return rect;
    };

    // ── Armed arm — single vertical rectangle along the left side of torso ─
    const armRect = addPart(3, 10, METAL);
    armRect.setPosition(-3, -10);

    // 1 px blue stripe on the left edge of the arm
    const armStripe = addPart(1, 10, ARM_BLUE);
    armStripe.setPosition(-2, -9);

    this._armParts = [armRect, armStripe];
  }

  removeArm(onComplete) {
    this.scene.tweens.add({
      targets:    this._armParts,
      alpha:      0,
      duration:   600,
      ease:       'Sine.easeOut',
      onComplete: () => { if (onComplete) onComplete(); },
    });
  }
}
