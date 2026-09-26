import Phaser from 'phaser';

/**
 * Wall — static striped-hazard wall prop.
 * Black/white 45° stripes with a white outline.
 * Container origin = ground level.
 *
 * @param {number}  x
 * @param {number}  groundY
 * @param {object}  [opts]
 * @param {number}  [opts.width=18]    wall width in virtual pixels
 * @param {number}  [opts.height=102]  wall height in virtual pixels
 * @param {number}  [opts.offsetX=15]  horizontal offset from container origin
 * @param {number}  [opts.stripeEvery=4] stripe period in pixels
 */
export default class Wall extends Phaser.GameObjects.Container {
  constructor(scene, x, groundY, {
    width     = 18,
    height    = 102,
    offsetX   = 15,
    stripeEvery = 4,
  } = {}) {
    super(scene, x, groundY);
    scene.add.existing(this);

    const WX = offsetX;
    const WY = -height;
    const WW = width;
    const WH = height;
    const PERIOD = stripeEvery;

    const g = scene.add.graphics();
    this.add(g);

    // Black base
    g.fillStyle(0x000000, 1);
    g.fillRect(WX, WY, WW, WH);

    // White 45° diagonal stripes — 1 px wide
    g.fillStyle(0xffffff, 1);
    for (let dy = 0; dy < WH; dy++) {
      for (let dx = 0; dx < WW; dx++) {
        const phase = ((dx - dy) % PERIOD + PERIOD) % PERIOD;
        if (phase < PERIOD / 2) g.fillRect(WX + dx, WY + dy, 1, 1);
      }
    }

    // White outline
    g.lineStyle(1, 0xdddddd, 1);
    g.strokeRect(WX, WY, WW, WH);
  }
}
