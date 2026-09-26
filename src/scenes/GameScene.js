import Phaser from 'phaser';
import Robot, { RobotState } from '../entities/Robot.js';
import Skull from '../entities/Skull.js';
import DeadRobot from '../entities/DeadRobot.js';
import Wall from '../entities/Wall.js';
import Chain from '../entities/Chain.js';
import Computer from '../entities/Computer.js';
import SurveillanceCamera from '../entities/SurveillanceCamera.js';
import ArmedDeadRobot from '../entities/ArmedDeadRobot.js';
import NPCRobot from '../entities/NPCRobot.js';
import i18n from '../i18n.js';

// scrollable world width
const WORLD_W = 5000;

// Sfx volume
const sfxGunFireVolume = 0.8;

// checkpoints after death
const CHECKPOINTS = [600, 1070, 1300, 1700, 2280, 3050, 3785, 4200];

/**
 * GameScene — movement test for the broken robot.
 *
 * Virtual resolution: 320x180 (zoomed x4 = 1280x720 on screen).
 *
 * Controls (standing):
 *   ← / → / A / D / Q      — move
 *
 * Controls (lying / crawling):
 *   → then ← then → then ←  — crawl right (alternating left/right)
 *   SPACE                    — get up
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.audio('robot-steps', 'sfx/bannythecoolio-large-mech-robot-steps-432560.mp3');
    this.load.audio('theme', 'sfx/kaazoom-under-the-bleak-sky-post-apocalyptic-cinematic-music-436655.mp3');
    this.load.audio('gunfire', 'sfx/lordsonny-plasma-gun-fire-162136.mp3');
    this.load.audio('chains', 'sfx/freesound_community-chains-6909.mp3');
    this.load.audio('skulls-falling', 'sfx/freesound_community-falling-rock-105396.mp3');
    this.load.audio('warning-alarm', 'sfx/freesound_community-severe-warning-alarm-98704.mp3');
    this.load.audio('cam-fire', 'sfx/daviddumaisaudio-sci-fi-weapon-laser-shot-04-316416.mp3');
    this.load.audio('explosion', 'sfx/universfield-epic-cinematic-explosion-454857.mp3');
    this.load.audio('ammo-picked', 'sfx/freesound_community-2011-macbook-turning-on-45550.mp3');
    this.load.audio('robot-wakeup', 'sfx/freesound_community-robot-power-off-97246.mp3');
    this.load.audio('robot-crawling', 'sfx/freesound_community-robot-walk-82499.mp3');
    this.load.audio('robot-metal', 'sfx/dragon-studio-groaning-metal-511322.mp3');
    this.load.audio('standing-up', 'sfx/freesound_community-029974_inside-the-robot-70923.mp3');
    this.load.audio('computer-text', 'sfx/estudiocoati-interface-digital-de-texto-text-digital-interface-218128.mp3');
  }

  create() {
    // ── Launch UI overlay (subtitles + instruction) ───────────────────────
    this.scene.launch('UIScene');

    // FadeIn
    this.cameras.main.fadeIn(2000, 0, 0, 0);

    // ── Virtual world dimensions ──────────────────────────────────────────
    const VW      = 320;
    const VH      = 180;
    const GH       = 60;          // ground height (3× original 20px)
    const GROUND_Y = VH - GH;    // = 120 — top of ground, robot stands here
    this._groundY = GROUND_Y;

    // ── Camera zoom x4 — 1 virtual pixel = 4 screen pixels ───────────────
    this.cameras.main.setZoom(4);
    // Camera bounds = world bounds (camera won't scroll past edges)
    this.cameras.main.setBounds(0, 0, WORLD_W, VH);

    // Physics world bounds
    this.physics.world.setBounds(0, 0, WORLD_W, VH + 40);

    // ── Backgrounds ───────────────────────────────────────────────────────    
    const exteriorBg = this.add.graphics();
    exteriorBg.fillStyle(0xa5a5b6, 1);
    exteriorBg.fillRect(1000, -60, WORLD_W + 1000, VH);
    exteriorBg.setScrollFactor(0.4, 1);
    exteriorBg.setDepth(-10);

    const interiorBg = this.add.graphics();
    interiorBg.fillStyle(0x000000, 1);
    interiorBg.beginPath();
    interiorBg.moveTo(0, -60);
    interiorBg.lineTo(4000, -60);
    interiorBg.lineTo(4020, VH);
    interiorBg.lineTo(0, VH);
    interiorBg.closePath();
    interiorBg.fill();
    interiorBg.setDepth(0);

    // ── Mountains (Exterior) ──────────────────────────────────────────────
    const mountsPosition = WORLD_W - 3000;

    const backMountainGfx = this.add.graphics();
    backMountainGfx.fillStyle(0x47473c, 1);
    const backMtWidth = [300, 400, 450, 350, 450];
    const backMtHeights = [95, 110, 130, 120, 110];
    for (let i = 0; i < backMtHeights.length; i++) {
      const x = mountsPosition - 300 + i * 140;
      const w = backMtWidth[i];
      const h = backMtHeights[i];
      
      backMountainGfx.fillTriangle(
        x - w / 2, GROUND_Y,
        x + w / 2, GROUND_Y,
        x,         GROUND_Y - h
      );
    }
    backMountainGfx.setScrollFactor(0.35, 1);
    backMountainGfx.setDepth(-5);

    const mountainGfx = this.add.graphics();
    mountainGfx.fillStyle(0x62644d, 1);
    const mtWidth = [250, 300, 350, 300, 250];
    const mtHeights = [70, 90, 110, 100, 90];
    for (let i = 0; i < mtHeights.length; i++) {
      const x = mountsPosition + i * 140;
      const w = mtWidth[i];
      const h = mtHeights[i];
      
      mountainGfx.fillTriangle(
        x - w / 2, GROUND_Y,
        x + w / 2, GROUND_Y,
        x,         GROUND_Y - h
      );
    }
    mountainGfx.setScrollFactor(0.4, 1);
    mountainGfx.setDepth(-5);

    // ── Big Building (Exterior) ──────────────────────────────────────────────
    const buildingGfx = this.add.graphics();
    buildingGfx.setDepth(-4).setScrollFactor(0.4, 1);

    // Bottom building base and window grid (1px square, color 0x999999, 2px vertical gap)
    buildingGfx.fillStyle(0xdddddd, 1).fillRect(mountsPosition + 240, GROUND_Y - 120, 80, 40);
    buildingGfx.fillStyle(0x999999, 1);
    for (let wy = 6; wy < 36; wy += 3) {
      for (let wx = 8; wx < 74; wx += 6) {
        buildingGfx.fillRect(mountsPosition + 241 + wx, GROUND_Y - 120 + wy, 1, 1);
      }
    }

    // Top building base and window grid (1px square, color 0x999999, 2px vertical gap)
    buildingGfx.fillStyle(0xeeeeee, 1).fillRect(mountsPosition + 260, GROUND_Y - 140, 40, 20);
    buildingGfx.fillStyle(0x999999, 1);
    for (let wy = 4; wy < 18; wy += 3) {
      for (let wx = 6; wx < 36; wx += 6) {
        buildingGfx.fillRect(mountsPosition + 261 + wx, GROUND_Y - 140 + wy, 1, 1);
      }
    }

    // Wall and decorative beams
    buildingGfx.fillStyle(0xaaaaaa, 1).fillRect(mountsPosition + 200, GROUND_Y - 75, 160, 20);
    buildingGfx.fillStyle(0x999999, 1);
    [195, 215, 235, 255, 275, 295, 315, 335, 355].forEach(bx => {
      buildingGfx.fillRect(mountsPosition + bx, GROUND_Y - 77, 5, 22);
    });

    // ── Exterior Particles (Dust/Mist) ────────────────────────────────────
    if (!this.textures.exists('exterior_spark')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture('exterior_spark', 1, 1);
      g.destroy();
    }
    this.add.particles(0, 0, 'exterior_spark', {
      x: { min: 4000, max: WORLD_W },
      y: { min: 0, max: VH },
      lifespan: { min: 3000, max: 7000 },
      speed: { min: 4, max: 12 },
      scale: { start: 0.5, end: 2 },
      alpha: { start: 0.2, end: 0.6 },
      frequency: 60,
      gravityY: 3,
    }).setDepth(1);

    // ── Pipe background — procedural, parallax ────────────────────────────
    this._buildPipeBackground(4000, GROUND_Y);

    // ── Ground ────────────────────────────────────────────────────────────
    // Physics ground — static body spanning the full world
    const groundBody = this.add.rectangle(WORLD_W / 2, GROUND_Y + GH / 2, WORLD_W, GH, 0x000000, 0);
    this.physics.add.existing(groundBody, true);
    this._groundBody = groundBody;
    this._finalSequence = false;
    this._finalNpc = null;

    // ── Ground plates — metal panels, tiled across the full world ─────────
    const gfx = this.add.graphics();
    const platePattern = [40, 54, 36, 62, 44, 38, 46]; // base pattern (sums 320)
    let gx = -1;
    let pi = 0;
    while (gx < WORLD_W+1) {
      const pw = Math.min(platePattern[pi % platePattern.length], WORLD_W - gx);
      gfx.fillStyle(0x000000, 1);
      gfx.fillRect(gx, GROUND_Y - 5, pw, GH + 12);
      gfx.lineStyle(1, 0xffffff, 1);
      gfx.strokeRect(gx, GROUND_Y - 5, pw, GH + 12);
      gfx.fillStyle(0xffffff, 1);
      if (pw >= 20) {
        gfx.fillCircle(gx + 5,      GROUND_Y + 5,      1.5);
        gfx.fillCircle(gx + pw - 5, GROUND_Y + 5,      1.5);
        gfx.fillCircle(gx + 5,      GROUND_Y + GH - 5, 1.5);
        gfx.fillCircle(gx + pw - 5, GROUND_Y + GH - 5, 1.5);
      }
      gx += platePattern[pi % platePattern.length];
      pi++;
    }

    // ── Vines / ivy — organic tendrils from x=4000 onward ───────────────
    this._buildVines(4000, WORLD_W, GROUND_Y, GH);

    // ── Robot — starts lying on the ground ───────────────────────────────
    this.robot = new Robot(this, 200, GROUND_Y);
    this.robot.setDepth(10);
    this.physics.add.collider(this.robot.body_proxy, groundBody);

    new Wall(this, -25, GROUND_Y + 10);

    // ── Dead robot + wall ─────────────────────────────────────────────────
    // Wall added first so it renders behind the robot body
    new Wall(this, 438, GROUND_Y);
    this._deadRobot = new DeadRobot(this, 440, GROUND_Y);

    // ── Chain — hangs from ceiling, reaches robot mid-height ──────────────
    // Robot head world y = GROUND_Y - 26*3 = 42 → mid-height y = (42+120)/2 = 81
    new Chain(this, 290, -180, GROUND_Y - 60, this.robot);
    new Chain(this, 1335, -180, GROUND_Y - 60, this.robot);
    new Chain(this, 1355, -180, GROUND_Y - 60, this.robot);
    new Chain(this, 3790, -180, GROUND_Y - 60, this.robot);
    new Chain(this, 3800, -180, GROUND_Y - 60, this.robot);
    new Chain(this, 3810, -180, GROUND_Y - 60, this.robot);

    this.add.text(310, -10, i18n.tag, { color:'#ffffff', align: 'center' })
    .setAngle(-15)
    .setScrollFactor(0.35, 1);

    // ── Alone Skulls ─────────────────────────────────────────────────────
    // on the left
    new Skull(this, 130, GROUND_Y + 3);
    // after the first dead robot
    new Skull(this, 500, GROUND_Y + 3);

    // ── Surveillance camera ───────────────────────────────────────────────
    this._surveillanceCams = [800, 1500, 2800, 2900, 3965].map(x =>
      new SurveillanceCamera(this, x, -60, GROUND_Y)
    );

    // ── Skull pyramid ─────────────────────────────────────────────────────
    this._skulls           = [];
    this._pyramidTriggered = false;
    this._buildSkullPyramid(1100, GROUND_Y, groundBody);

    // ── Wide wall + computer terminal at mid-height ───────────────────────
    const COMP_WALL_H = 70;
    const COMP_X      = 1250;
    new Wall(this, COMP_X, GROUND_Y, { width: 60, height: COMP_WALL_H, offsetX: 0 });
    this._computer = new Computer(this, COMP_X + 30, GROUND_Y - COMP_WALL_H / 2);
    this._computerState = null;  // null | 'active' | 'done'

    // ── Armed dead robot + wall ───────────────────────────────────────────
    new Wall(this, 1750, GROUND_Y);
    this._armedDeadRobot = new ArmedDeadRobot(this, 1750, GROUND_Y);

    // ── NPC robots ────────────────────────────────────────────────────────
    this._npcRobots = [2150, 2750, 3400, 3600, 4610].map(x => {
      const npc = new NPCRobot(this, x, GROUND_Y);
      this.physics.add.collider(npc.body_proxy, groundBody);
      return npc;
    });

    // ── Second Wide wall + computer terminal
    new Wall(this, 2290, GROUND_Y, { width: 60, height: COMP_WALL_H, offsetX: 0 });
    this._computer2 = new Computer(this, 2320, GROUND_Y - COMP_WALL_H / 2);
    this._computerState2 = null;

    // ── Ceiling wall — hangs from top, x 2630–2670, 10 px tall ──────────
    // Wall origin = bottom of wall (y=20), height=10 → draws from y=10 to y=20
    new Wall(this, 2830, 20, { width: 40, height: 10, offsetX: 0 }).setDepth(6);
    {
      const ceilBody = this.add.rectangle(2850, 15, 40, 10, 0x000000, 0);
      this.physics.add.existing(ceilBody, true);
      this.physics.add.collider(this.robot.body_proxy, ceilBody);
    }

    // Mask: hide camera beams (2800, 2900) in the ceiling wall zone
    // Two separate mask instances — Phaser GeometryMask can't be shared between objects
    {
      const makeMask = () => {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff);
        g.fillTriangle(2830, 10, 2870, 10, 2850, 180);
        const m = g.createGeometryMask();
        m.invertAlpha = true;
        return m;
      };
      this._surveillanceCams[2]._spotlight.setMask(makeMask()); // x=2800
      this._surveillanceCams[3]._spotlight.setMask(makeMask()); // x=2900
    }
    this._ceilWallMinX = 2830;
    this._ceilWallMaxX = 2870;
    this.events.on('camera-hit', () => this._robotExplode());
    this.events.on('npc-fire', (npc, npcX, npcY, facingRight) => this._npcShoot(npc, npcX, npcY, facingRight));

    // ── Third Wide wall + computer terminal
    new Wall(this, 4860, GROUND_Y, { width: 60, height: COMP_WALL_H, offsetX: 0 });
    this._computer3 = new Computer(this, 4890, GROUND_Y - COMP_WALL_H / 2);
    this._computerState3 = null;

    // ── Touch detection ───────────────────────────────────────────────────
    this._isTouch = this.sys.game.device.input.touch || ('ontouchstart' in window);

    // ── Virtual input (touch controls written by UIScene) ─────────────────
    this._virtX        = 0;   // joystick x, -1..1
    this._virtY        = 0;   // joystick y, -1..1
    this._virtXPrev    = 0;
    this._virtYPrev    = 0;
    this._virtFire     = false;  // one-shot tap (consumed once per update)
    this._virtFireHeld = false;  // continuous hold

    // ── Silent mode — ?nosounds in URL disables all audio ────────────────
    this._silent = new URLSearchParams(window.location.search).has('nosounds');

    // ── Debug mode — ?debug in URL ────────────────────────────────────────
    this._debug = new URLSearchParams(window.location.search).has('debug');
    if (this._debug) {
      this.keyPageUp   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_UP);
      this.keyPageDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN);
    }

    this.betterCheckpoint = 0;

    // ── Ammo ──────────────────────────────────────────────────────────────
    this._ammo        = 1;
    this._maxAmmo     = 1;
    this._ammoPickups = [];

    // ── Wake-up state ─────────────────────────────────────────────────────
    this._wakeCount = 0;   // space presses so far
    this._awake     = false;

    // ── Camera: follow robot from start, centered (offset applied on wake-up) ─
    this.cameras.main.startFollow(this.robot, true);
    this.cameras.main.setFollowOffset(0, 0);

    this._zoomedOut = false;

    // ── Robot stood up — show post-standup dialogue ───────────────────────
    this.events.on('robot-stood-up', () => {
      this.time.delayedCall(600, () => {
        this._startDialogue(i18n.dialogueStandup);
        this._dlgDismissOnWalk = true;
      });
    }, this);

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyQ    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyW    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyZ    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyS    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyM    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    // Crawl combo state (lying only): right → left alternating
    this._crawlStep        = 0;
    this._crawlActiveUntil = 0;

    // Leg-retrieval interaction state
    // null | 'blocked' | 'instruction' | 'pulling' | 'done'
    this._legState         = null;
    this._legPressCount    = 0;
    this._dlgDismissOnWalk  = false;
    this._robotWaiting         = false;  // true while a blocking dialogue is active
    this._skullDialogueDone    = false;  // true once dialogueSkullsFound has fired
    this._buildingDialogueDone = false;  // true once dialogueBuilding has fired
    this._titleCardActive      = false;  // true while title card is visible
    this._titleCardReady       = false;  // true once 3s have elapsed (Space allowed)

    // Arm-retrieval interaction state (armed dead robot, standing phase)
    this._armState      = null;  // null | 'blocked' | 'instruction' | 'pulling' | 'done'
    this._armPressCount = 0;

    // Charge-shot state (available once armed arm is retrieved)
    this._chargingShot = false;
    this._chargeStart  = 0;
    this._chargeFired  = false;
    this._chargeAngle  = 5;

    // ── Dark zone overlay (x 3100–3800) — eyes/stripes at depth 85 show through ─
    this._darkOverlay = this.add.rectangle(400, 200, 500, 300, 0x000000)
      .setScrollFactor(0, 0).setOrigin(0, 0).setDepth(80).setAlpha(0);
    this._inDarkZone = false;
    this._darkTween  = null;

    // Play theme
    this.theme = this.sound.add('theme', { loop: true, volume: 0.4 });
    this.theme.play();

    // SFX
    this.sfxGunFire = this.sound.add('gunfire', { volume: sfxGunFireVolume });
    this.sfxSkullsFalling = this.sound.add('skulls-falling', { volume: 1 });
    this.sfxWarningAlarm = this.sound.add('warning-alarm', { volume: 1 });
    this.sfxCamFire = this.sound.add('cam-fire', { volume: 1 });
    this.sfxExplosion = this.sound.add('explosion', { volume: 1 });
    this.sfxAmmoPicked = this.sound.add('ammo-picked', { volume: 1 });
    this.sfxRobotMetal = this.sound.add('robot-metal', { volume: 1 });
    this.sfxStandingUp = this.sound.add('standing-up', { volume: 0.8 });
    this.sfxComputerText = this.sound.add('computer-text', { volume: 0.8 });
  }

  update() {
    const r = this.robot;

    // ── Virtual joystick "just" pulses (direction crossing threshold) ─────
    const vRightJust = this._virtX >  0.3 && this._virtXPrev <= 0.3;
    const vLeftJust  = this._virtX < -0.3 && this._virtXPrev >= -0.3;
    const vUpJust    = this._virtY < -0.3 && this._virtYPrev >= -0.3;
    const vDownJust  = this._virtY >  0.3 && this._virtYPrev <= 0.3;
    const vFireJust  = this._virtFire; this._virtFire = false;
    this._virtXPrev  = this._virtX;
    this._virtYPrev  = this._virtY;

    if (!this._awake && (Phaser.Input.Keyboard.JustDown(this.keySpace) || vFireJust)) {
      this._wakeCount++;
      r.flickerEye();
      if (this._wakeCount === 8) {
        this._wakeUp(r);
        // Don't let this same keypress also trigger get-up below
        r.setMoveIntent(0);
        r.update(this.game.loop.delta);
        return;
      }
    }

    // debug: test the get up
    if (this._debug && Phaser.Input.Keyboard.JustDown(this.keyM)) {
      this._wakeUp(r);
      r.getUp();
      if (!this._zoomedOut) {
        this._zoomedOut = true;
        this._zoomOut();
      }
    }

    // debug: teleport robot ±200px + position display
    if (this._debug) {
      if (Phaser.Input.Keyboard.JustDown(this.keyPageDown)) {
        r.body_proxy.setX(r.body_proxy.x + 200);
      } else if (Phaser.Input.Keyboard.JustDown(this.keyPageUp)) {
        r.body_proxy.setX(r.body_proxy.x - 200);
      }
      console.info(`x:${Math.round(r.x)}`);
    }

    // Block all movement until the robot is awake
    if (!this._awake) {
      r.setMoveIntent(0);
      r.update(this.game.loop.delta);
      return;
    }

    if (r.state === RobotState.LYING) {
      // ── Leg interaction trigger ───────────────────────────────────────
      if (this._awake && this._legState === null) {
        const headWorldX = r.x + r.head.x * Math.abs(r.scaleX);
        if (headWorldX >= this._deadRobot.x - 10) {
          this._startLegInteraction();
        }
      }

      if (this._legState !== null) {
        // Blocked at dead robot — stop all forward movement
        r.body_proxy.body.setVelocityX(0);
        r.setMoveIntent(0);

        // ↑ / ↓ alternating during instruction phase
        if (this._legState === 'instruction') {
          const up   = Phaser.Input.Keyboard.JustDown(this.cursors.up)
                    || Phaser.Input.Keyboard.JustDown(this.keyW)
                    || Phaser.Input.Keyboard.JustDown(this.keyZ)
                    || vUpJust;
          const down = Phaser.Input.Keyboard.JustDown(this.cursors.down)
                    || Phaser.Input.Keyboard.JustDown(this.keyS)
                    || vDownJust;
          const dir  = up ? 'up' : (down ? 'down' : null);
          if (dir && dir !== this._legLastPull) {
            this._legLastPull = dir;
            this._legPressCount++;
            // Brief lurch (player robot strains)
            r.body_proxy.body.setVelocityX(25);
            this.time.delayedCall(120, () => r.body_proxy.body.setVelocityX(0));
            this._deadRobot.shake();

            if (this._legPressCount >= 3) {
              this.sfxRobotMetal.play();
              this._legState = 'pulling';
              this.game.events.emit('instr-hide');
              this._deadRobot.removeLeg();
              this._deadRobot.collapse();
              this.sfxStandingUp.play();
              this.time.delayedCall(1000, () => {
                this._legState = 'done';
                this.robot.shake(() => {
                  this.robot.getUp();
                  if (!this._zoomedOut) {
                    this._zoomedOut = true;
                    this._zoomOut();
                  }
                });
              });
            }
          }
        }
      } else {
        // Normal crawl
        this._tickCrawlSequence(r, vRightJust, vLeftJust);
        r.setMoveIntent(this.time.now < this._crawlActiveUntil ? 1 : 0);
      }

      // SPACE: continue dialogue if active
      if ((Phaser.Input.Keyboard.JustDown(this.keySpace) || vFireJust) && this._dlgWaiting) {
        this._dialogueContinue();
      }
    } else {
      const canMove = !this._robotWaiting
        && (r.state === RobotState.STANDING || r.state === RobotState.WALKING);
      if (canMove) {
        const left  = this.cursors.left.isDown  || this.keyA.isDown || this.keyQ.isDown || this._virtX < -0.3;
        const right = this.cursors.right.isDown || this.keyD.isDown                     || this._virtX >  0.3;
        if (left && !right)      r.setMoveIntent(-1);
        else if (right && !left) r.setMoveIntent(1);
        else                     r.setMoveIntent(0);
      } else {
        r.setMoveIntent(0);
      }

      // SPACE: continue dialogue if active while standing/walking (not while charging)
      // (_dlgWaiting checked first so JustDown isn't consumed when there's no dialogue)
      if (!this._chargingShot && this._dlgWaiting && (Phaser.Input.Keyboard.JustDown(this.keySpace) || vFireJust)) {
        this._dialogueContinue();
      }

      // SPACE: dismiss title card (only once 3s have elapsed)
      if (this._titleCardActive && this._titleCardReady && (Phaser.Input.Keyboard.JustDown(this.keySpace) || vFireJust)) {
        this._titleCardActive = false;
        this._titleCardReady  = false;
        this.game.events.emit('title-card-hide');
        this.game.events.emit('instr-hide');
        this._robotWaiting = false;
      }

      // Auto-dismiss standup dialogue 2s after the robot starts walking
      if (this._dlgDismissOnWalk && this._dlgWaiting && r.state === RobotState.WALKING) {
        this._dlgDismissOnWalk = false;
        this.time.delayedCall(2000, () => {
          if (this._dlgWaiting) this._dialogueContinue();
        });
      }

      this._inFrontOfSkulls();
      this._checkComputerProximity();
      this._checkComputer2Proximity();
      this._checkComputer3Proximity();
      this._checkArmProximity();

      if (this._armState === 'done' && !this._robotWaiting && !this._dlgWaiting) {
        this._tickChargeShot(r);
      }

      // ── Arm pulling (↑↓ alternating) ──────────────────────────────────────
      if (this._armState === 'instruction') {
        const up   = Phaser.Input.Keyboard.JustDown(this.cursors.up)
                  || Phaser.Input.Keyboard.JustDown(this.keyW)
                  || Phaser.Input.Keyboard.JustDown(this.keyZ)
                  || vUpJust;
        const down = Phaser.Input.Keyboard.JustDown(this.cursors.down)
                  || Phaser.Input.Keyboard.JustDown(this.keyS)
                  || vDownJust;
        const dir  = up ? 'up' : (down ? 'down' : null);
        if (dir && dir !== this._armLastPull) {
          this._armLastPull = dir;
          this._armPressCount++;
          this._armedDeadRobot.shake();
          r.body_proxy.body.setVelocityX(-15);
          this.time.delayedCall(120, () => r.body_proxy.body.setVelocityX(0));

          if (this._armPressCount >= 3) {
            this.sfxRobotMetal.play();
            this._armState = 'pulling';
            this.game.events.emit('instr-hide');
            this.sfxStandingUp.play();
            this._armedDeadRobot.removeArm(() => {
              this._armedDeadRobot.collapse();
              this.time.delayedCall(1000, () => {
                this._armState = 'done';
                this.robot.shake(() => {
                  this._startDialogue(i18n.dialogueArmDone, () => {
                    this._robotWaiting = false;
                  });
                });
              });
            });
          }
        }
      }
    }

    r.update(this.game.loop.delta);

    if (this._chargingShot) {
      this._chargeAngle = Phaser.Math.Linear(this._chargeAngle, -90, 0.15);
      r.upperArmR.setAngle(this._chargeAngle);
      if (this._chargeStripe) {
        const progress = Math.min((this.time.now - this._chargeStart) / 1000, 1);
        const h = Math.max(3, Math.round(progress * 30));
        this._chargeStripe
          .setSize(3, h)
          .setPosition(r.x + r.upperArmR.x * r.scaleX, r.y + r.upperArmR.y * r.scaleY - 3)
          .setAngle(r.upperArmR.angle * Math.sign(r.scaleX));
      }
    }

    const headWorldX = r.x + r.head.x * r.scaleX;
    const headWorldY = r.y + r.head.y * r.scaleY;
    const underCeiling = headWorldX >= this._ceilWallMinX && headWorldX <= this._ceilWallMaxX;
    this._surveillanceCams.forEach(cam => { if (!underCeiling) cam.checkHead(headWorldX, headWorldY); });

    this._checkSkullCollision();
    this._checkAmmoPickups(r);
    this._npcRobots.forEach(npc => npc.npcUpdate(this.game.loop.delta, this.robot.x));
    if (this._finalSequence) this._updateFinalNpc();
    this._checkBuildingDialogue();
    this._updateDarkZone();
  }

  _inFrontOfSkulls() {
    if (this._skullDialogueDone || this._pyramidTriggered || !this._skulls.length) return;

    const r = this.robot;
    const proxyRight = r.body_proxy.body.right;
    const gap = this._skulls[0].proxy.body.left - proxyRight;
    if (gap < 20 && gap > 1) {
      this._startSkullInteraction();
    }
  }

  /**
   * Build a pyramid of skulls: 8 at base, 7 on top, …, 1 at apex.
   * @param {number} centerX   world x of the pyramid centre
   * @param {number} groundY   world y of the surface (skull bases rest here)
   * @param groundBody         static Arcade body used for colliders
   */
  _buildSkullPyramid(centerX, groundY, groundBody) {
    const ROWS    = 8;
    const SKULL_W = 16;   // visual / spacing width
    const SKULL_H = 14;   // row height (proxy height)

    for (let row = 0; row < ROWS; row++) {
      const count = ROWS - row;           // 8, 7, 6 … 1
      const y     = groundY - row * SKULL_H + 3;
      // Centre the row horizontally
      const startX = centerX - ((count - 1) * SKULL_W) / 2;

      for (let col = 0; col < count; col++) {
        const x = startX + col * SKULL_W;
        const skull = new Skull(this, x, y);
        this.physics.add.collider(skull.proxy, groundBody);
        this._skulls.push(skull);
      }
    }
  }

  /**
   * Detect when the robot contacts the front skull in the pyramid and
   * trigger a ripple collapse.
   */
  _checkSkullCollision() {
    if (this._pyramidTriggered || !this._skulls.length) return;

    const r  = this.robot;
    const vx = r.body_proxy.body.velocity.x;
    if (vx <= 0) return;   // only trigger on rightward movement

    // Rightmost extent of the robot
    const proxyRight = r.body_proxy.body.right;
    const headRight  = r.x + (r.head.x + r.head.width / 2) * Math.abs(r.scaleX);
    const robotRight = Math.max(proxyRight, headRight);

    for (const skull of this._skulls) {
      if (skull._activated) continue;
      const gap = skull.proxy.body.left - robotRight;
      if (gap < 4 && gap > -12) {
        this._startDialogue(i18n.dialogueSkullFall);

        this._pyramidTriggered = true;
        this._triggerCascade(skull);
        this.sfxSkullsFalling.play();
        return;
      }
    }
  }

  /**
   * Ripple collapse: skulls closer to the hit point fly first.
   * Delay per skull = distance × 8 ms.  Direction = away from hit point.
   * @param {Skull} hitSkull   the skull the robot first touched
   */
  _triggerCascade(hitSkull) {
    const hx = hitSkull.x;
    const hy = hitSkull.y;

    for (const skull of this._skulls) {
      const dx    = skull.x - hx;
      const dy    = skull.y - hy;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      const delay = dist * 8;
      const angle = Math.atan2(dy, dx);

      this.time.delayedCall(delay, () => {
        skull.push(1 + (1 / (dist + 1)), angle);
      });
    }
  }

  /**
   * Zoom ×4 → ×2, keeping ground anchored at screen bottom.
   * startFollow stays active for X; followOffset.y is recalculated
   * each tween frame so scrollY = VH − viewH stays exact.
   * Starts immediately when the robot begins getting up.
   */
  _zoomOut() {
    const cam = this.cameras.main;

    // Allow camera to scroll into negative world-Y (empty space above world)
    cam.setBounds(0, -720, WORLD_W, 900);

    // Tween a plain proxy — tweening cam.zoom directly is unreliable
    // (Phaser stores zoom internally as _zoomX/_zoomY in newer versions)
    const proxy = { zoom: cam.zoom };
    this.tweens.add({
      targets:  proxy,
      zoom:     3,
      duration: 2800,   // covers the full get-up animation (≈ 2850 ms)
      ease:     'Sine.InOut',
      onUpdate: () => {
        cam.setZoom(proxy.zoom);
        const viewH = 720 / proxy.zoom;
        // Keep ground (VH) at screen bottom: scrollY = VH − viewH
        // Via follow: scrollY = robot.y − viewH/2 + offsetY → offsetY = VH − viewH/2 − robot.y
        cam.setFollowOffset(-80, viewH / 2 - this.robot.y);
      },
    });
  }

  /** Called once after 8 space presses — activates the robot. */
  _wakeUp(r) {
    this._awake = true;
    r.activate();
    this.game.events.emit('instruction-hide');
    this.game.events.emit('camera-released');
    this._wakeUpTime = this.time.now;
    // Smoothly slide the follow offset from 0 → -80 (no startFollow re-call)
    const offsetProxy = { x: 0 };
    this.tweens.add({
      targets:  offsetProxy,
      x:        -80,
      duration: 1500,
      ease:     'Sine.easeInOut',
      onUpdate: () => this.cameras.main.setFollowOffset(offsetProxy.x, 0),
    });
    this.time.delayedCall(2000, () => this._startDialogue(i18n.dialogueWakeup));
  }

  // ─── Dialogue system ──────────────────────────────────────────────────────

  /**
   * Play a sequence of robot lines one at a time.
   * After 2s each, show "Presser espace pour continuer" — unless the player
   * already advanced before the 2s timer fires.
   * @param {string[]} lines
   */
  /** Trigger the leg-retrieval sequence. */
  _startLegInteraction() {
    this._legState      = 'blocked';
    this._legPressCount = 0;
    this._legLastPull   = null;
    // Stop any crawl momentum
    this.robot.body_proxy.body.setVelocityX(0);
    this._crawlActiveUntil = 0;
    this._startDialogue(i18n.dialogueLeg, () => {
      this._legState = 'instruction';
      this.game.events.emit('instr-show', { text: i18n.instructionLeg });
    });
  }

  /** Trigger the arm-retrieval sequence (standing robot). */
  _checkArmProximity() {
    if (this._armState !== null) return;
    const r   = this.robot;
    const gap = this._armedDeadRobot.x - r.body_proxy.body.right;
    if (gap < 30 && gap > -50) {
      this._startArmInteraction();
    }
  }

  _startArmInteraction() {
    this._armState      = 'blocked';
    this._armPressCount = 0;
    this._armLastPull   = null;
    this._robotWaiting  = true;
    this.robot.setMoveIntent(0);
    this.robot.body_proxy.body.setVelocityX(0);
    this._startDialogue(i18n.dialogueArm, () => {
      this._armState = 'instruction';
      this.game.events.emit('instr-show', { text: i18n.instructionArm });
    });
  }

  /** Trigger the skull sequence — freezes the robot until the dialogue is dismissed. */
  _startSkullInteraction() {
    this._skullDialogueDone = true;  // prevent re-triggering this dialogue
    this._robotWaiting      = true;
    this.robot.setMoveIntent(0);
    this.robot.body_proxy.body.setVelocityX(0);
    this._startDialogue(i18n.dialogueSkullsFound, () => {
      this._robotWaiting = false;
    });
  }

  /** Trigger when the robot reaches the computer wall. */
  _checkComputerProximity() {
    if (this._computerState !== null) return;
    const r = this.robot;
    const gap = this._computer.x - r.body_proxy.body.right;
    if (gap < 10 && gap > -10) {
      this._startComputerInteraction();
    }
  }

  _startComputerInteraction() {
    this._computerState = 'active';
    this._robotWaiting  = true;
    this.robot.setMoveIntent(0);
    this.robot.body_proxy.body.setVelocityX(0);

    // Phase 1 — robot spots the computer
    this._startDialogue(i18n.dialogueComputer, () => {
      // Space pressed → start blinking screen, then 2s later: second dialogue
      this._computer.startHacking();
      this.sfxComputerText.play();
      this.time.delayedCall(2000, () => {
        this._startDialogue(i18n.journalFirst, () => {
          this._computer.stopHacking();
          this._computerState = 'done';
          this._showTitleCard();
        });
      });
    });
  }

  _checkComputer2Proximity() {
    if (this._computerState2 !== null) return;
    const r = this.robot;
    const gap = this._computer2.x - r.body_proxy.body.right;
    if (gap < 10 && gap > -10) {
      this._startComputer2Interaction();
    }
  }

  _startComputer2Interaction() {
    this._computerState2 = 'active';
    this._robotWaiting   = true;
    this.robot.setMoveIntent(0);
    this.robot.body_proxy.body.setVelocityX(0);

    this._computer2.startHacking();
    this.sfxComputerText.play();
    this.time.delayedCall(500, () => {
      this._startDialogue(i18n.journalSecond, () => {
        this._computer2.stopHacking();
        this._computerState2 = 'done';
        this._robotWaiting   = false;
      });
    });
  }

  _checkComputer3Proximity() {
    if (this._computerState3 !== null) return;
    const r = this.robot;
    const gap = this._computer3.x - r.body_proxy.body.right;
    if (gap < 10 && gap > -10) {
      this._startComputer3Interaction();
    }
  }

  _startComputer3Interaction() {
    this._computerState3 = 'active';
    this._robotWaiting   = true;
    this.robot.setMoveIntent(0);
    this.robot.body_proxy.body.setVelocityX(0);

    this._computer3.startHacking();
    this.sfxComputerText.play();
    this.time.delayedCall(500, () => {
      this._startDialogue(i18n.journalThird, () => {
        this._computer3.stopHacking();
        this._computerState3 = 'done';
        this._startFinalSequence();
      });
    });
  }

  /**
   * Play a sequence of robot lines one at a time.
   * @param {Array<{text:string,speak:boolean}>} lines
   * @param {(() => void) | null} [onComplete]  called when all lines are done
   */
  _startDialogue(lines, onComplete = null) {
    this._dlgLines      = lines;
    this._dlgIndex      = 0;
    this._dlgWaiting    = false;
    this._dlgTimer      = null;
    this._dlgInstrOn    = false;
    this._dlgOnComplete = onComplete;
    this._dlgPlayLine();
  }

  _dlgPlayLine() {
    const line = this._dlgLines[this._dlgIndex];
    this._dlgWaiting = false;
    this._robotSpeak(line.text, { keepVisible: true, speak: line.speak });

    // Show "press space" 2s after line starts, unless already advanced
    this._dlgTimer = this.time.delayedCall(2000, () => {
      if (!this._dlgWaiting) return;  // already advanced
      this._dlgInstrOn = true;
      this.game.events.emit('instr-show', { text: this._isTouch ? i18n.instrContinueTouch : i18n.instructionContinue });
    });

    this._dlgWaiting = true;
  }

  /** Called from update() when SPACE is pressed during active dialogue. */
  _dialogueContinue() {
    this._dlgWaiting = false;

    if (this._dlgTimer) { this._dlgTimer.remove(); this._dlgTimer = null; }

    if (this._dlgInstrOn) {
      this.game.events.emit('instr-hide');
      this._dlgInstrOn = false;
    }

    this._dlgIndex++;
    if (this._dlgIndex < this._dlgLines.length) {
      this._dlgPlayLine();
    } else {
      this._dlgLines   = null;
      this._dlgWaiting = false;
      this.game.events.emit('subtitle-hide');
      if (this._dlgOnComplete) {
        const cb = this._dlgOnComplete;
        this._dlgOnComplete = null;
        cb();
      }
    }
  }

  /**
   * Speak a line using the browser's speech synthesis with a robotic voice.
   * Prefers a French voice; falls back to whatever is available.
   * @param {string} text
   * @param {{ keepVisible?: boolean, speak?: boolean }} opts
   *   keepVisible — don't auto-hide subtitle when speech ends
   *   speak       — pass false to show subtitle only, skip voice synthesis (default true)
   */
  _robotSpeak(text, { keepVisible = false, speak = true } = {}) {
    // Cancel any ongoing speech before starting a new line
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    this.game.events.emit('subtitle-show', { text });

    const fadeOut = () => {
      if (!keepVisible) this.game.events.emit('subtitle-hide');
    };

    if (!speak || this._silent || !window.speechSynthesis) {
      if (!keepVisible) this.time.delayedCall(4000, fadeOut);
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang   = i18n.speechLang;    // e.g. 'fr-FR' or 'en-US'
    utter.rate   = 0.8;  // slow and laboured
    utter.pitch  = 0.5;  // very low = robotic
    utter.volume = 1;
    utter.onend  = fadeOut;

    const applyVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const voice  = voices.find(v => v.lang.startsWith(i18n.speechLangPrefix));
      if (voice) utter.voice = voice;
      window.speechSynthesis.speak(utter);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      applyVoice();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', applyVoice, { once: true });
    }
  }

  /**
   * Crawl combo while the robot is lying: strict alternating right / left.
   * Step 0 — wait for right. Step 1 — wait for left. Step 2 — wrong key pressed at
   * step 1: movement stops; must press left before right is accepted again.
   */
  _tickCrawlSequence(r, vRightJust = false, vLeftJust = false) {
    const K     = Phaser.Input.Keyboard;
    const right = K.JustDown(this.cursors.right) || K.JustDown(this.keyD) || vRightJust;
    const left  = K.JustDown(this.cursors.left)  || K.JustDown(this.keyA) || K.JustDown(this.keyQ) || vLeftJust;

    const ACTIVE_MS = 250;
    const ok = (nextStep) => {
      this._crawlStep        = nextStep;
      this._crawlActiveUntil = this.time.now + ACTIVE_MS;
    };

    switch (this._crawlStep) {
      case 0: if (right) ok(1); break;                                                    // first press must be right
      case 1: if (left) ok(0); else if (right) { this._crawlStep = 2; this._crawlActiveUntil = 0; } break; // wrong key: penalty
      case 2: if (left) this._crawlStep = 0; break;                                       // recover: press left to restart
    }
  }

  _tickChargeShot(r) {
    if (!this.keySpace.isDown && !this._virtFireHeld) {
      if (this._chargingShot) this._cancelCharge(r);
      return;
    }
    if (this._ammo <= 0) {
      if (Phaser.Input.Keyboard.JustDown(this.keySpace)) this._doNoAmmoArmRaise(r);
      return;
    }
    if (!this._chargingShot) {
      if (this.time.now < (this._shotCooldownUntil || 0)) return;
      this._startCharge(r);
      return;
    }
    if (!this._chargeFired && this.time.now - this._chargeStart >= 1000) {
      this._chargeFired = true;
      this._firePlayerShot(r);
    }
  }

  _startCharge(r) {
    this._chargingShot = true;
    this._chargeStart  = this.time.now;
    this._chargeFired  = false;
    this._chargeAngle  = r.upperArmR.angle ?? 5;

    // Replace plain arm rect with sub-container holding arm + red stripe
    const savedPos = { x: r.upperArmR.x, y: r.upperArmR.y };
    const savedAng = r.upperArmR.angle;
    r.remove(r.upperArmR, true);

    const armRect = this.add.rectangle(0, 0, 3, 10, 0xeeeeee).setOrigin(0.5, 0);
    const armCont = this.add.container(savedPos.x, savedPos.y, [armRect]);
    armCont.setAngle(savedAng);
    r.add(armCont);
    r.upperArmR = armCont;
    // Stripe outside container so it renders above the dark overlay (depth 85)
    this._chargeStripe = this.add.rectangle(0, 0, 3, 3, 0xff2200).setOrigin(0.5, 0).setDepth(85);

    // play sfx
    this.sfxGunFire.setVolume(sfxGunFireVolume);
    this.sfxGunFire.play();
  }

  _cancelCharge(r) {
    if (!this._chargingShot) return;

    // stop sfx
    this.tweens.add({ targets: this.sfxGunFire, volume: 0, duration: 200, ease: 'Linear', onComplete: () => this.sfxGunFire.stop() });

    this._chargingShot = false;
    this._restoreArm(r, true);
  }

  _restoreArm(r, tween = false) {
    if (this._chargeStripe) { this._chargeStripe.destroy(); this._chargeStripe = null; }
    if (!r.upperArmR) return;
    const pos = { x: r.upperArmR.x, y: r.upperArmR.y };
    const ang = r.upperArmR.angle;
    r.remove(r.upperArmR, true);
    const newArm = this.add.rectangle(0, 0, 3, 10, 0xeeeeee).setOrigin(0.5, 0);
    newArm.setPosition(pos.x, pos.y);
    newArm.setAngle(ang);
    r.add(newArm);
    r.upperArmR    = newArm;
    this._chargeAngle  = ang;
    this._chargeStripe = null;
    if (tween) {
      this.tweens.add({ targets: newArm, angle: 5, duration: 300, ease: 'Sine.easeOut' });
    }
  }

  _firePlayerShot(r) {
    this._restoreArm(r);
    this._chargingShot = false;
    this._shotCooldownUntil = this.time.now + 400;
    this._ammo = Math.max(0, this._ammo - 1);
    if (this._ammo <= 0) this._startArmBlink(r);

    // Lock arm so _updateWalking doesn't override the recoil tween
    r.lockArm(400);

    // Recoil: arm kicks past -90° then returns to rest
    this.tweens.killTweensOf(r.upperArmR);
    r.upperArmR.setAngle(-90);
    this.tweens.add({
      targets:  r.upperArmR,
      angle:    -110,
      duration: 60,
      ease:     'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: r.upperArmR, angle: 5, duration: 250, ease: 'Sine.easeOut' });
      },
    });

    // Fire horizontally from arm-tip world position
    const startX = r.x + (r.facingRight ? 10 : -10);
    const startY = r.y - 54;
    const targetX = r.facingRight ? WORLD_W + 400 : -400;

    const dist = Math.abs(targetX - startX);
    const duration = (dist / 500) * 1000;

    const bolt = this.add.rectangle(startX, startY, 8, 2, 0xffffff);
    bolt.setAngle(r.facingRight ? 0 : 180);
    bolt.setDepth(90);
    const auraP = this.add.arc(startX, startY, 20, 0, 360, false, 0xffffff);
    auraP.setAlpha(0.3);
    auraP.setDepth(89);

    // Hit the first non-destroyed NPC in the firing direction
    const dir = r.facingRight ? 1 : -1;
    const firstNpc = this._npcRobots
      .filter(n => !n._destroyed
        && Math.sign(n.x - startX) === dir
        && Math.abs(n.x - r.x) < 350)
      .sort((a, b) => dir * (a.x - b.x))[0];

    let boltTween;

    if (firstNpc) {
      const hitTime = (Math.abs(firstNpc.x - startX) / 500) * 1000;
      this.time.delayedCall(hitTime, () => {
        if (boltTween) boltTween.stop();
        bolt.destroy();
        auraP.destroy();
        this._spawnImpact(firstNpc.x, startY);
        this._npcRobotExplode(firstNpc);
      });
    }

    boltTween = this.tweens.add({
      targets:  [bolt, auraP],
      x:        targetX,
      duration,
      ease:     'Linear',
      onComplete: () => { bolt.destroy(); auraP.destroy(); },
    });
  }

  _npcRobotExplode(npc) {
    if (npc._destroyed) return;
    this.tweens.add({ targets: npc.sfxGunFire, duration: 100, volume: 0 });
    npc._destroyed = true;
    npc._fired = true;
    npc.setMoveIntent(0);
    if (npc._fireTimer) { npc._fireTimer.remove(); npc._fireTimer = null; }

    this.cameras.main.flash(200, 255, 255, 255);
    this._spawnExplosion(npc.x, npc.y - 20);
    this._spawnAmmoPickup(npc.x, this._groundY);

    this.tweens.add({
      targets:  [npc, npc.eye],
      alpha:    0,
      duration: 200,
      ease:     'Linear',
      onComplete: () => npc.setVisible(false),
    });
  }

  _npcShoot(npc, npcX, npcY, facingRight) {
    if (npc._destroyed) return;
    const startX = npcX + (facingRight ? 14 : -14);
    const startY = npcY - 35;
    const dist   = Math.abs(this.robot.x - startX);

    const bolt = this.add.rectangle(startX, startY, 8, 2, 0xffffff);
    bolt.setDepth(90);
    const auraN = this.add.arc(startX, startY, 20, 0, 360, false, 0xffffff);
    auraN.setAlpha(0.3);
    auraN.setDepth(89);

    this.tweens.add({
      targets:  [bolt, auraN],
      x:        this.robot.x,
      duration: (dist / 400) * 1000,
      ease:     'Linear',
      onComplete: () => {
        bolt.destroy();
        auraN.destroy();
        this._robotExplode();
      },
    });
  }

  _spawnImpact(x, y) {
    const emitter = this.add.particles(0, 0, 'pixel_spark', {
      speed:    { min: 40, max: 120 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 2, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 280,
      emitting: false,
    });
    emitter.setDepth(90);
    emitter.explode(14, x, y);
    this.time.delayedCall(350, () => emitter.destroy());
  }

  _spawnExplosion(cx, cy) {
    if (!this.textures.exists('pixel_spark')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture('pixel_spark', 1, 1);
      g.destroy();
    }
    const emitter = this.add.particles(0, 0, 'pixel_spark', {
      speed:    { min: 40, max: 150 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 5, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 800,
      emitting: false,
    });
    emitter.setDepth(91);
    emitter.explode(200, cx, cy);
    this.time.delayedCall(900, () => emitter.destroy());

    this.sfxExplosion.play();
  }

  _startArmBlink(r) {
    if (this._armBlinkEvent) return;
    let state = false;
    this._armBlinkEvent = this.time.addEvent({
      delay:    150,
      repeat:   -1,
      callback: () => {
        state = !state;
        if (r.upperArmR) r.upperArmR.setAlpha(state ? 0.12 : 1);
      },
    });
  }

  _stopArmBlink(r) {
    if (this._armBlinkEvent) { this._armBlinkEvent.remove(false); this._armBlinkEvent = null; }
    if (r && r.upperArmR) r.upperArmR.setAlpha(1);
  }

  _doNoAmmoArmRaise(r) {
    if (r._armLocked) return;
    r.lockArm(750);
    this.tweens.killTweensOf(r.upperArmR);
    this.tweens.add({
      targets:  r.upperArmR,
      angle:    -90,
      duration: 220,
      ease:     'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(120, () => {
          this.tweens.add({ targets: r.upperArmR, angle: 5, duration: 360, ease: 'Sine.easeIn' });
        });
      },
    });
  }

  _spawnAmmoPickup(x, groundY) {
    const block = this.add.rectangle(x, groundY - 3, 6, 6, 0x2266ff);
    block.setDepth(88);
    const aura = this.add.arc(x, groundY - 3, 8, 0, 360, false, 0xffffff);
    aura.setAlpha(0.5);
    aura.setDepth(87);
    const auraTween = this.tweens.add({
      targets:  aura,
      alpha:    { from: 0.1, to: 0.6 },
      duration: 380,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
    this._ammoPickups.push({ block, aura, auraTween, x });
  }

  _checkAmmoPickups(r) {
    for (let i = this._ammoPickups.length - 1; i >= 0; i--) {
      const p = this._ammoPickups[i];
      if (Math.abs(r.x - p.x) < 12) {
        p.auraTween.stop();
        p.block.destroy();
        p.aura.destroy();
        this._ammoPickups.splice(i, 1);
        this.sfxAmmoPicked.play();
        if (this._ammo < this._maxAmmo) {
          this._ammo++;
          this._stopArmBlink(r);
        }
      }
    }
  }

  _buildPipeBackground(worldW, groundY) {
    const FACTOR = 0.35;
    // Width needed: camera scrolls up to (worldW - 320), background shifts FACTOR of that
    const BG_W = Math.ceil((worldW - 320) * FACTOR) + 360;

    const gfx = this.add.graphics();
    gfx.setScrollFactor(FACTOR, 1); // parallax on X only
    gfx.setDepth(0);

    const rng = new Phaser.Math.RandomDataGenerator(['pipes_v1']);

    const PIPE  = 0x252525;
    const JOINT = 0x282828;
    const BOLT  = 0x2f2f2f;

    const hpipe = (x, y, len, thick) => {
      gfx.fillStyle(PIPE, 1);
      gfx.fillRect(x, y, len, thick);
    };
    const vpipe = (x, y, len, thick) => {
      gfx.fillStyle(PIPE, 1);
      gfx.fillRect(x, y, thick, len);
    };
    const joint = (x, y, s) => {
      gfx.fillStyle(JOINT, 1);
      gfx.fillRect(x - 1, y - 1, s + 2, s + 2);
    };
    const bolt = (x, y) => {
      gfx.fillStyle(BOLT, 1);
      gfx.fillRect(x, y, 2, 2);
    };

    // ── Horizontal pipe layers ─────────────────────────────────────────────
    const layers = [
      { y: -48,   thick: 4 },
      { y: -22,  thick: 2 },
      { y: -2,  thick: 3 },
      { y: 18,  thick: 2 },
      { y: 54,  thick: 4 },
      { y: 80,  thick: 2 },
      { y: 108, thick: 3 },
    ];

    layers.forEach(({ y, thick }) => {
      let x = 0;
      while (x < BG_W) {
        const len = rng.between(50, 260);
        const end = Math.min(x + len, BG_W);
        hpipe(x, y, end - x, thick);
        // bolts near each end of segment
        if (len > 20) {
          bolt(x + 3,       y + Math.floor(thick / 2) - 1);
          bolt(end - 5,     y + Math.floor(thick / 2) - 1);
        }
        x = end + rng.between(0, 25);
      }
    });

    // ── Vertical connectors between adjacent layers ────────────────────────
    for (let li = 0; li < layers.length - 1; li++) {
      const { y: y1, thick: t1 } = layers[li];
      const { y: y2 } = layers[li + 1];
      let x = rng.between(15, 70);
      while (x < BG_W) {
        const thick = rng.pick([2, 2, 3]);
        vpipe(x, y1 + t1, y2 - y1 - t1, thick);
        joint(x, y1, thick);
        joint(x, y2, thick);
        x += rng.between(60, 200);
      }
    }

    // ── Scattered short stub pipes (horizontal, random heights) ───────────
    for (let i = 0; i < 60; i++) {
      const sx = rng.between(0, BG_W);
      const sy = rng.between(5, groundY - 15);
      const sw = rng.between(8, 30);
      const st = rng.pick([1, 2]);
      hpipe(sx, sy, sw, st);
    }
  }

  _startFinalSequence() {
    this._finalSequence = true;
    this._robotWaiting = true;

    const r = this.robot;
    const spawnX = r.x - 400;
    const npc = new NPCRobot(this, spawnX, this._groundY);
    npc.facingRight = true;
    this.physics.add.collider(npc.body_proxy, this._groundBody);
    this._finalNpc = npc;
  }

  _updateFinalNpc() {
    const npc = this._finalNpc;
    if (!npc || npc._destroyed) return;

    const dist = Math.abs(npc.x - this.robot.x);

    if (npc._fired) {
      npc.npcUpdate(this.game.loop.delta, this.robot.x);
      return;
    }

    if (dist < 220) {
      npc.facingRight = this.robot.x > npc.x;
      npc.setMoveIntent(0);
      npc.update(this.game.loop.delta);
      npc._syncArmStripe();
      if (!npc._armRaised) {
        npc._armRaised = true;
        this.time.delayedCall(260, () => npc._raiseArm());
      }
    } else {
      npc.facingRight = true;
      npc.setMoveIntent(1);
      npc.update(this.game.loop.delta);
      npc._syncArmStripe();
    }
  }

  _showTitleCard() {
    this._titleCardActive = true;
    this._titleCardReady  = false;
    this._robotWaiting    = true;
    this.game.events.emit('title-card-show');
    this.time.delayedCall(3000, () => {
      this._titleCardReady = true;
      this.game.events.emit('instr-show', { text: this._isTouch ? i18n.instrContinueTouch : i18n.instructionContinue });
    });
  }

  _checkBuildingDialogue() {
    if (this._buildingDialogueDone) return;
    if (this._finalSequence) return;
    if (this._robotWaiting) return;
    if (this.robot.x < 4500) return;
    if (!this._npcRobots.every(npc => npc._destroyed)) return;

    this._buildingDialogueDone = true;
    this._robotWaiting = true;
    this.robot.setMoveIntent(0);
    /** @type {Phaser.Physics.Arcade.Body} */ (this.robot.body_proxy.body).setVelocityX(0);
    this._startDialogue(i18n.dialogueBuilding, () => {
      this._robotWaiting = false;
    });
  }

  _updateDarkZone() {
    const inZone = this.robot.x >= 3100 && this.robot.x <= 3800;
    if (inZone !== this._inDarkZone) {
      this._inDarkZone = inZone;
      if (this._darkTween) { this._darkTween.stop(); this._darkTween = null; }
      this._darkTween = this.tweens.add({
        targets:  this._darkOverlay,
        alpha:    inZone ? 1 : 0,
        duration: 1200,
        ease:     'Sine.easeInOut',
      });
    }
  }

  _robotExplode() {
    const r = this.robot;
    r.setMoveIntent(0);
    if (r.body_proxy && r.body_proxy.body) /** @type {Phaser.Physics.Arcade.Body} */ (r.body_proxy.body).setVelocityX(0);
    this._robotWaiting = true;
    this.cameras.main.flash(200, 255, 255, 255);

    this._spawnExplosion(r.x, r.y - 20);
    r.setAlpha(0);
    r.eye.setAlpha(0);
    if (this._chargeStripe) { this._chargeStripe.setAlpha(0); }

    if (this._finalSequence) {
      // Stop all NPC activity before fadeout covers the screen
      const fnpc = this._finalNpc;
      if (fnpc) {
        // Stop behaviour immediately — but keep visible until fadeout covers the screen
        fnpc._destroyed = true;
        fnpc._fired = true;
        if (fnpc._fireTimer) { fnpc._fireTimer.remove(); fnpc._fireTimer = null; }
        this.tweens.killTweensOf(fnpc);
        this.tweens.killTweensOf(fnpc.upperArmR);
        /** @type {Phaser.Physics.Arcade.Body} */ (fnpc.body_proxy.body).setVelocityX(0);
      }

      this.cameras.main.fadeOut(3000, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        const elapsed = this.time.now - (this._wakeUpTime ?? this.time.now);
        const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
        const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
        const ms = String(Math.round(elapsed % 1000)).padStart(3, '0');
        this.game.events.emit('title-card-show');
        this.game.events.emit('game-time', { text: `${i18n.gameTime} : ${mm}:${ss}:${ms}` });

        // Screen is black — safe to destroy NPC and detach camera
        if (fnpc) { fnpc.destroy(); this._finalNpc = null; }
        this.cameras.main.stopFollow();

        this.time.delayedCall(2000, () => {
          this.game.events.emit('subtitle-card-show');
          // Fade the game back in (title card visible on top during this 2s)
          this.cameras.main.fadeIn(2000, 0, 0, 0);
          // Once fully visible: hide title card and start slow pan back to world start
          this.cameras.main.once('camerafadeincomplete', () => {
            this.cameras.main.pan(160, 90, 40000, 'Sine.easeInOut');
            this.time.delayedCall(38000, () => this.cameras.main.fadeOut(2000, 0, 0, 0));
          });
        });
      });
      return;
    }

    // Fadeout then respawn at nearest checkpoint behind explosion
    const spawnX = [...CHECKPOINTS].reverse().find(cpX => cpX < r.x) ?? 200;
    if (spawnX > this.betterCheckpoint) this.betterCheckpoint = spawnX;

    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const gy = this._groundY;
      r.setPosition(this.betterCheckpoint, gy);
      r.body_proxy.setPosition(this.betterCheckpoint, gy - 42);
      /** @type {Phaser.Physics.Arcade.Body} */ (r.body_proxy.body).setVelocity(0, 0);
      r.facingRight = true;
      r.setScale(3, 3);
      r.setAlpha(1);
      r.eye.setAlpha(1);
      r.sfxWakeUp.play();
      this._robotWaiting = false;
      this._surveillanceCams.forEach(cam => cam.reset());
      this._npcRobots.forEach(npc => {
        if (npc._destroyed && npc.x >= this.betterCheckpoint) {
          npc.reset();
          // Remove the ammo pickup that was spawned for this NPC if not yet collected
          const pi = this._ammoPickups.findIndex(p => Math.abs(p.x - npc.x) < 5);
          if (pi !== -1) {
            const p = this._ammoPickups.splice(pi, 1)[0];
            p.auraTween.stop();
            p.block.destroy();
            p.aura.destroy();
          }
        } else if (!npc._destroyed) npc.reset();
      });
      this._cancelCharge(r);
      this._stopArmBlink(r);
      this._ammo = 1;

      this.cameras.main.fadeIn(1000, 0, 0, 0);
    });
  }

  // ── Ivy crawling along the ground (x ≥ 4000) ────────────────────────────
  // Horizontal meandering strands spread across the full ground height, with
  // scattered leaves and moss dots. No upright stems.
  _buildVines(startX, endX, groundY, groundH) {
    const gfx = this.add.graphics().setDepth(4);
    const rng = (a, b = 0) => { const s = Math.sin(a * 91.3 + b * 253.7) * 43758.5453; return s - Math.floor(s); };

    const C_STEM = 0x243d10;
    const C_LEAF = 0x3a5c1a;
    const C_DARK = 0x182808;
    const W      = endX - startX;

    // ── Winding horizontal creepers across the full ground height ─────────
    const creepers = [];
    for (let i = 0; i < 140; i++) {
      const sx     = startX + rng(i * 3.7) * W;
      const dir    = rng(i * 7.1) > 0.5 ? 1 : -1;
      const len    = 30 + rng(i * 1.9) * 110;
      // baseY anywhere within the ground slab
      const baseY  = groundY + rng(i * 2.3) * groundH;
      const amp    = 1 + rng(i * 4.1) * 2;
      const period = 10 + rng(i * 5.3) * 14;
      const phase  = rng(i * 8.7) * Math.PI * 2;
      const alpha  = 0.55 + rng(i * 6.1) * 0.35;

      const pts = [];
      const steps = Math.max(8, Math.floor(len / 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = sx + dir * t * len;
        const y = baseY + Math.sin(phase + (t * len) / period * Math.PI * 2) * amp;
        pts.push(x, y);
      }

      gfx.lineStyle(1, i % 3 === 0 ? C_DARK : C_STEM, alpha);
      gfx.beginPath();
      gfx.moveTo(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) gfx.lineTo(pts[k], pts[k + 1]);
      gfx.strokePath();

      creepers.push(pts);
    }

    // ── Leaves scattered along creepers ───────────────────────────────────
    for (const pts of creepers) {
      const count = 2 + Math.floor((pts.length / 2) / 5);
      for (let l = 0; l < count; l++) {
        const seed = pts[0] * 0.31 + l * 7.7;
        const idx  = Math.floor(rng(seed, l) * (pts.length / 2 - 1)) * 2;
        const lx   = pts[idx]     + (rng(seed, l + 10) - 0.5) * 3;
        const ly   = pts[idx + 1] + (rng(seed, l + 20) - 0.5) * 1.5;
        const lw   = 2 + rng(seed, l + 30) * 2;
        gfx.fillStyle(rng(seed, l + 40) > 0.55 ? C_DARK : C_LEAF, 0.55 + rng(seed, l + 50) * 0.3);
        gfx.fillEllipse(lx, ly, lw, Math.max(1.5, lw - 1));
      }
    }

    // ── Moss / leaf speckles across the full ground height ───────────────
    for (let i = 0; i < 600; i++) {
      const lx = startX + rng(i * 13.1 + 1500) * W;
      const ly = groundY + rng(i * 17.3 + 1500) * groundH;
      const lw = 1 + Math.floor(rng(i * 19.1 + 1500) * 2);
      gfx.fillStyle(rng(i * 21.7 + 1500) > 0.5 ? C_LEAF : C_DARK, 0.35 + rng(i * 23.3 + 1500) * 0.35);
      gfx.fillRect(lx, ly, lw, 1);
    }
  }
}
