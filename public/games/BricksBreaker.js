// Detect mobile devices and override orientation accordingly
const isMobile = /Mobile|Android/i.test(navigator.userAgent);
_CONFIG.deviceOrientation = isMobile ? "portrait" : "landscape";

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.score = 0; // Initialize score
    this.isGameOver = false; // Initialize game over state
  }

  preload() {
    for (const key in _CONFIG.imageLoader) {
      this.load.image(key, _CONFIG.imageLoader[key]);
    }
    for (const key in _CONFIG.soundsLoader) {
      this.load.audio(key, [_CONFIG.soundsLoader[key]]);
    }

    this.load.image("heart", _CONFIG.libLoader.heart);
    this.load.bitmapFont(
      "pixelfont",
      _CONFIG.fontLoader.pixelfont_png,
      _CONFIG.fontLoader.pixelfont_xml
    );
    this.load.image("pauseButton", _CONFIG.libLoader.pauseButton);

    addEventListenersPhaser.bind(this)();
    displayProgressLoader.call(this);
  }

  create() {
    this.width = this.game.config.width;
    this.height = this.game.config.height;

    this.bg = this.add
      .image(
        this.game.config.width / 2,
        this.game.config.height / 2,
        "background"
      )
      .setOrigin(0.5);
    // Scale the background image to cover the whole canvas
    const scale = Math.max(
      this.game.config.width / this.bg.displayWidth,
      this.game.config.height / this.bg.displayHeight
    );
    this.bg.setScale(scale);

    this.scoreText = this.add.bitmapText(10, 10, "pixelfont", "Score: 0", 28);

    this.input.keyboard.on("keydown-ESC", () => this.pauseGame());
    this.pauseButton = this.add.image(
      this.game.config.width - 60,
      60,
      "pauseButton"
    );
    this.pauseButton.setInteractive({ cursor: "pointer" });
    this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
    this.pauseButton.on("pointerdown", () => this.pauseGame());
    this.vfx = new VFXLibrary(this);

    this.sounds = {};
    for (const key in _CONFIG.soundsLoader) {
      this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
    }

    // Set background music volume to 25% and enable looping
    this.sounds.background.setVolume(0.25).setLoop(true).play();
    this.input.keyboard.disableGlobalCapture();

    // Call the method to set up game objects (replacing gameSceneCreate)
    this.setupGame();
  }

  // Moved gameSceneCreate logic into a class method
  setupGame() {
    this.physics.world.setBoundsCollision(1, 1, 1, 0);

    this.bricks = this.physics.add.group({
      immovable: true,
      allowGravity: false,
    });

    // Set brick formation settings based on device type:
    // For mobile devices: 13 columns and 5 rows
    // For PC devices: 15 columns and 4 rows
    const numBricksX = isMobile ? 13 : 15;
    const numBricksY = isMobile ? 5 : 4;
    const brickSpacingX = 50;
    const brickSpacingY = 52;
    const brickWidth = 64;
    const brickHeight = 64;

    // Calculate total width of the brick formation and starting X coordinate to center it
    const formationWidth = brickSpacingX * (numBricksX - 1) + brickWidth;
    const startX = (this.width - formationWidth) / 2 + brickWidth / 2;
    const startY = 100;

    for (let y = 0; y < numBricksY; y++) {
      for (let x = 0; x < numBricksX; x++) {
        const brickX = startX + x * brickSpacingX;
        const brickY = startY + y * brickSpacingY;
        const brick = this.bricks
          .create(brickX, brickY, "enemy")
          .setDisplaySize(brickWidth, brickHeight);
        brick.body.setBounce(1);
        this.vfx.scaleGameObject(brick);
      }
    }

    // Set the paddle position:
    // - For PC devices: y = 600
    // - For mobile devices: place the paddle at 75% of the game height
    const paddleY = isMobile ? this.height * 0.75 : 600;
    this.paddle = this.physics.add
      .sprite(this.width * 0.5, paddleY, "platform")
      .setDisplaySize(200, 35)
      .setImmovable();
    this.paddle.refreshBody();

    this.ball = this.physics.add
      .sprite(this.width * 0.5, this.paddle.y - 16, "projectile")
      .setDisplaySize(48, 48)
      .setOrigin(0.5)
      .setCollideWorldBounds(true)
      .setBounce(1);
    this.ball.refreshBody();
    this.ball.setData("onPaddle", true);

    this.physics.add.collider(
      this.ball,
      this.paddle,
      this.ballHitPaddle,
      null,
      this
    );
    this.physics.add.collider(
      this.ball,
      this.bricks,
      this.ballHitBrick,
      null,
      this
    );

    this.input.on("pointerdown", this.releaseBall, this);

    this.gameOverText = this.add
      .bitmapText(this.width / 2, 40, "pixelfont", "GAME OVER !", 40)
      .setDepth(11)
      .setOrigin(0.5)
      .setTint(0xff0000)
      .setAlpha(0);
  }

  update(time, delta) {
    // Moved gameSceneUpdate logic into the update method
    this.paddle.x = this.input.x;

    if (this.paddle.x < 24) {
      this.paddle.x = 24;
    } else if (this.paddle.x > this.physics.world.bounds.width - 24) {
      this.paddle.x = this.physics.world.bounds.width - 24;
    }

    if (this.ball.getData("onPaddle")) {
      this.ball.x = this.paddle.x;
    }

    if (this.ball.body.y > this.height) {
      this.gameOverText.setAlpha(1);
      this.sound.stopAll();
      this.sounds.lose.play();
      this.physics.pause();
      this.time.delayedCall(500, () => {
        this.gameOver();
      });
    }
  }

  // Moved releaseBall function into a class method
  releaseBall() {
    if (this.ball.getData("onPaddle")) {
      this.ball.setVelocity(-75, -300);
      this.ball.setData("onPaddle", false);
    }
  }

  // Moved ballHitBrick function into a class method
  ballHitBrick(ball, brick) {
    this.vfx.createEmitter("enemy", brick.x, brick.y, 0.01, 0, 200).explode(30);
    brick.destroy();
    this.sounds.destroy.play();
    this.updateScore(1);

    if (this.bricks.countActive() === 0) {
      this.sound.stopAll();
      this.sounds.success.play();
      this.gameOverText.setAlpha(1).setTint(0x00ff00).setText("YOU WON !");
      this.physics.pause();
      this.time.delayedCall(1500, () => {
        this.gameOver();
      });
    }
  }

  // Moved ballHitPaddle function into a class method
  ballHitPaddle(ball, paddle) {
    let diff = 0;
    this.sounds.jump.play();
    if (ball.x < paddle.x) {
      diff = paddle.x - ball.x;
      ball.setVelocityX(-10 * diff);
    } else if (ball.x > paddle.x) {
      diff = ball.x - paddle.x;
      ball.setVelocityX(10 * diff);
    } else {
      ball.setVelocityX(2 + Math.random() * 8);
    }
  }

  updateScore(points) {
    this.score += points;
    this.updateScoreText();
  }

  updateScoreText() {
    this.scoreText.setText(`Score: ${this.score}`);
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
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  dataObject: {
    name: _CONFIG.title,
    description: _CONFIG.description,
    instructions32: _CONFIG.instructions,
  },
  orientation: _CONFIG.deviceOrientation === "landscape",
};
