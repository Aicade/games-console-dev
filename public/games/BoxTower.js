// Device detection: mobile devices use portrait; desktop devices use landscape.
const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
_CONFIG.deviceOrientation = isMobile ? "portrait" : "landscape";

// Game Scene
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.score = 0;
    this.onceGameOverCall = false;
    this.canDrop = true;
  }

  preload() {
    this.score = 0;
    addEventListenersPhaser.bind(this)();

    for (const key in _CONFIG.imageLoader) {
      this.load.image(key, _CONFIG.imageLoader[key]);
    }
    for (const key in _CONFIG.soundsLoader) {
      this.load.audio(key, [_CONFIG.soundsLoader[key]]);
    }

    this.load.image("pauseButton", _CONFIG.libLoader.pauseButton);
    this.load.image("pillar", _CONFIG.libLoader.pillar);

    const fontName = "pix";
    const fontBaseURL =
      "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
    this.load.bitmapFont(
      "pixelfont",
      _CONFIG.fontLoader.pixelfont_png,
      _CONFIG.fontLoader.pixelfont_xml
    );

    displayProgressLoader.call(this);
  }

  create() {
    this.onceGameOverCall = false;
    this.canDrop = true;
    this.vfx = new VFXLibrary(this);

    this.width = this.game.config.width;
    this.height = this.game.config.height;
    this.bg = this.add
      .image(
        this.game.config.width / 2,
        this.game.config.height / 2,
        "background"
      )
      .setOrigin(0.5);
    const scale = Math.max(
      this.game.config.width / this.bg.displayWidth,
      this.game.config.height / this.bg.displayHeight
    );
    this.bg.setScale(scale).setScrollFactor(0);

    // High Score Display
    this.highScore = localStorage.getItem("boxTowerHighScore")
      ? parseInt(localStorage.getItem("boxTowerHighScore"))
      : 0;
    this.highScoreText = this.add
      .bitmapText(10, 10, "pixelfont", "High Score: " + this.highScore, 28)
      .setOrigin(0, 0);
    this.highScoreText.setDepth(11).setScrollFactor(0);

    this.scoreText = this.add
      .bitmapText(this.width / 2, 100, "pixelfont", "0", 128)
      .setOrigin(0.5, 0.5);
    this.scoreText.setDepth(11).setScrollFactor(0);

    this.input.keyboard.on("keydown-ESC", () => this.pauseGame());

    this.pauseButton = this.add
      .sprite(this.game.config.width - 60, 60, "pauseButton")
      .setOrigin(0.5, 0.5);
    this.pauseButton.setInteractive({ cursor: "pointer" });
    this.pauseButton.setScale(3).setScrollFactor(0);
    this.pauseButton.on("pointerdown", () => this.pauseGame());

    this.sounds = {};
    for (const key in _CONFIG.soundsLoader) {
      this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
    }
    this.sounds.background.setVolume(1).setLoop(true).play();

    this.groundObj = this.add.image(this.width / 2, this.height, "pillar");
    this.ground = this.matter.add.gameObject(this.groundObj);
    this.ground.setStatic(true);
    this.ground.setScale(4, 1.3);

    // Set pointer input to drop blocks.
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.addMovingObject();

    this.blocks = [];
    this.onGround = [];

    this.groundCollided = false;
    this.groundCollidedId = null;

    // Matter collision callback
    this.matter.world.on("collisionstart", (event) => {
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Check if the last dropped block is involved
        if (this.blocks.length > 0) {
          let lastBlock = this.blocks[this.blocks.length - 1];
          if (
            (pair.bodyA.id === lastBlock.body.id ||
              pair.bodyB.id === lastBlock.body.id) &&
            !lastBlock.landed
          ) {
            lastBlock.landed = true; // Mark as landed
            this.updateScore(100);
            this.pointsEffect(lastBlock.x, lastBlock.y, 100);
          }
          // Allow dropping a new block once the last one has collided
          this.canDrop = true;
        }

        // Existing ground collision logic
        if (
          bodyA.id == this.ground.body.id ||
          bodyB.id == this.ground.body.id
        ) {
          if (!this.groundCollided) {
            this.groundCollided = true;
            this.groundCollidedId =
              bodyA.id == this.ground.body.id ? bodyB.id : bodyA.id;
          } else if (
            this.groundCollidedId != bodyA.id &&
            this.groundCollidedId != bodyB.id &&
            !this.onceGameOverCall
          ) {
            this.onceGameOverCall = true;
            let gameOverText = this.add
              .bitmapText(
                this.cameras.main.centerX,
                this.cameraYAxis,
                "pixelfont",
                "Game Over",
                64
              )
              .setOrigin(0.5)
              .setVisible(false)
              .setAngle(-15)
              .setTint(0xff0000);
            this.vfx.shakeCamera();
            this.time.delayedCall(500, () => {
              this.sounds.lose.play();
              gameOverText.setVisible(true);
              this.tweens.add({
                targets: gameOverText,
                y: "+=200",
                angle: 0,
                scale: { from: 0.5, to: 2 },
                alpha: { from: 0, to: 1 },
                ease: "Elastic.easeOut",
                duration: 1500,
                onComplete: () => {
                  this.time.delayedCall(1000, this.gameOver, [], this);
                },
              });
            });
          }
        }
      });
    });

    this.input.keyboard.disableGlobalCapture();
  }

  addMovingObject() {
    let movingScale = _CONFIG.deviceOrientation === "landscape" ? 0.2 : 0.3;
    this.movingBlock = this.matter.add
      .image(100, 100, "player", null, { isStatic: true })
      .setScale(movingScale)
      .setDepth(12);
    this.vfx.scaleGameObject(this.movingBlock, 0.9, 500);
    let squareSize = this.movingBlock.displayWidth;
    this.movingBlock.setBody(
      {
        type: "rectangle",
        width: squareSize,
        height: squareSize,
      },
      { isStatic: true }
    );
    this.tweens.add({
      targets: this.movingBlock,
      x: this.width - 100,
      duration: 2000,
      yoyo: true,
      repeat: -1,
    });
  }

  handlePointerDown(pointer) {
    if (!this.onceGameOverCall && this.canDrop) {
      this.canDrop = false; // Prevent new drop until the current block lands
      const x = this.movingBlock.x;
      const y = this.movingBlock.y + this.movingBlock.displayHeight + 50;
      let fallingScale = _CONFIG.deviceOrientation === "landscape" ? 0.2 : 0.3;
      this.block = this.matter.add
        .image(x, y, "player", null, { isStatic: false })
        .setScale(fallingScale);
      // Set a rectangular hitbox: height equals displayHeight; width is 2x displayWidth.
      let newWidth = this.block.displayWidth * 2;
      let newHeight = this.block.displayHeight;
      this.block.setBody({
        type: "rectangle",
        width: newWidth,
        height: newHeight,
      });
      // Mark as not landed yet.
      this.block.landed = false;
      // (No immediate scoring here; score updates when block lands)
      this.sounds.collect.play();
      this.blocks.push(this.block);

      let threshold = _CONFIG.deviceOrientation === "landscape" ? 1 : 4;
      if (this.blocks.length >= threshold) {
        this.movingBlock.y -= this.movingBlock.displayHeight;
        this.cameraYAxis =
          this.movingBlock.y + this.movingBlock.displayHeight * 3;
        this.cameras.main.pan(
          this.cameras.main.scrollX + this.width / 2,
          this.cameraYAxis,
          1000
        );
      }
    }
  }

  pointsEffect(x, y, score) {
    let scoreText = this.add.bitmapText(x, y, "pixelfont", `+${score}`, 50);
    this.tweens.add({
      targets: scoreText,
      y: { from: scoreText.y, to: scoreText.y - 100 },
      alpha: { from: 1, to: 0 },
      scale: { start: 1, to: 1.5 },
      angle: { from: 0, to: 10 },
      duration: 2000,
      ease: "Power2",
      onComplete: function () {
        scoreText.destroy();
      },
      onStart: () => {
        scoreText.setTint(0xffff00);
      },
      yoyo: false,
      repeat: 0,
    });
  }

  update() {}

  updateScore(points) {
    this.score += points;
    this.updateScoreText();
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem("boxTowerHighScore", this.highScore);
      this.highScoreText.setText("High Score: " + this.highScore);
    }
  }

  updateScoreText() {
    this.scoreText.setText(this.score);
  }

  gameOver() {
    initiateGameOver.bind(this)({ score: this.score });
  }

  pauseGame() {
    handlePauseGame.bind(this)();
  }
}

function displayProgressLoader() {
  let width = 320;
  let height = 50;
  let x = this.game.config.width / 2 - 160;
  let y = this.game.config.height / 2 - 50;
  const progressBox = this.add.graphics();
  progressBox.fillStyle(0x222222, 0.8);
  progressBox.fillRect(x, y, width, height);
  const loadingText = this.make
    .text({
      x: this.game.config.width / 2,
      y: this.game.config.height / 2 + 20,
      text: "Loading...",
      style: {
        font: "20px monospace",
        fill: "#ffffff",
      },
    })
    .setOrigin(0.5, 0.5);
  loadingText.setOrigin(0.5, 0.5);
  const progressBar = this.add.graphics();
  this.load.on("progress", (value) => {
    progressBar.clear();
    progressBar.fillStyle(0x364afe, 1);
    progressBar.fillRect(x, y, width * value, height);
  });
  this.load.on("fileprogress", function (file) {});
  this.load.on("complete", function () {
    progressBar.destroy();
    progressBox.destroy();
    loadingText.destroy();
  });
}

const config = {
  type: Phaser.AUTO,
  width: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].width,
  height: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].height,
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
  physics: {
    default: "matter",
    matter: {
      gravity: { y: 0.5 },
      debug: false,
    },
  },
  dataObject: {
    name: _CONFIG.title,
    description: _CONFIG.description,
    instructions: _CONFIG.instructions,
  },
  orientation: _CONFIG.deviceOrientation === "portrait",
};
