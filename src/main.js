import Phaser from "phaser";
import GameScene from "./scenes/GameScene.js";
import UIScene from "./scenes/UIScene.js";

// Virtual resolution — pixel art world
// Camera zoom x4 means 1 pixel here = 4 pixels on screen
const VIRTUAL_W = 320;
const VIRTUAL_H = 180;

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#000000",
  pixelArt: true,
  input: { activePointers: 3 }, // multi-touch (joystick + fire simultaneously)
  scale: {
    mode: Phaser.Scale.FIT, // scale to fill window, keep aspect ratio
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIRTUAL_W * 4, // 1280 — internal canvas size
    height: VIRTUAL_H * 4, // 720
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 400 },
      debug: false,
    },
  },
  scene: [GameScene, UIScene],
};

new Phaser.Game(config);

if (window.Wavedash) {
  Wavedash.init({ debug: false });
}
