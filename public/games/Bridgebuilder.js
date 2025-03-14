// Device detection: mobile devices use portrait; desktop devices use landscape.
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
const deviceOrientation = isMobileDevice() ? "portrait" : "landscape";

// Touch Screen Controls
const joystickEnabled = false;
const buttonEnabled = false;

const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.score = 0;
        addEventListenersPhaser.bind(this)();

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.image("pillar", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/textures/Bricks/s2+Brick+01+Grey.png");

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }

    create() {
        // Stop any previously playing background music before starting a new instance.
        this.sound.stopByKey("background");

        this.score = 0;
        addEventListenersPhaser.bind(this)();

        // Set up sounds and play background music only if not already playing.
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        if (!this.sounds.background.isPlaying) {
            this.sounds.background.setVolume(8).setLoop(true).play();
        }

        this.vfx = new VFXLibrary(this);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.image(this.width / 2, this.height / 2, "background").setOrigin(0.5);
        const scale = Math.max(this.width / this.bg.displayWidth, this.height / this.bg.displayHeight);
        this.bg.setScale(scale);

        // UI Elements
        this.scoreText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', '0', 128).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(11);

        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // High score display at top-left.
        this.highScore = localStorage.getItem('bridgeBuilderHighScore') ? parseInt(localStorage.getItem('bridgeBuilderHighScore')) : 0;
        this.highScoreText = this.add.bitmapText(10, 10, 'pixelfont', 'High Score: ' + this.highScore, 28).setOrigin(0, 0);
        this.highScoreText.setDepth(11);

        // Add platforms, player, and pole.
        this.addPlatforms();
        this.addPlayer();
        this.addPole();

        // Game input listeners
        this.input.on("pointerdown", this.grow, this);
        this.input.on("pointerup", this.stop, this);
        this.input.keyboard.disableGlobalCapture();
    }

    addPlatforms() {
        this.mainPlatform = 0;
        this.platforms = [];
        this.platforms.push(this.addPlatform(0));
        this.platforms.push(this.addPlatform(this.width));
        this.tweenPlatform();
    }

    // In portrait, platform occupies full height at bottom.
    addPlatform(posX) {
        let yPos, displayHeight;
        if (deviceOrientation === "landscape") {
            yPos = this.game.config.height - (gameOptions.platformHeight * 0.5);
            displayHeight = gameOptions.platformHeight * 0.5;
        } else {
            displayHeight = gameOptions.platformHeight;
            yPos = this.game.config.height - displayHeight;
        }
        let platform = this.physics.add.sprite(posX, yPos, "pillar");
        platform.displayWidth = (gameOptions.platformWidthRange[0] + gameOptions.platformWidthRange[1]) / 2;
        platform.displayHeight = displayHeight;
        platform.setAlpha(1);
        platform.setOrigin(0, 0);
        let bodyHeight = platform.displayHeight * 0.5;
        platform.body.setSize(bodyHeight);
        return platform;
    }

    tweenPlatform() {
        let destination = this.platforms[this.mainPlatform].displayWidth + Phaser.Math.Between(gameOptions.platformGapRange[0], gameOptions.platformGapRange[1]);
        let size = Phaser.Math.Between(gameOptions.platformWidthRange[0], gameOptions.platformWidthRange[1]);
        this.tweens.add({
            targets: [this.platforms[1 - this.mainPlatform]],
            x: destination,
            displayWidth: size,
            duration: gameOptions.scrollTime,
            callbackScope: this,
            onComplete: function () {
                this.gameMode = WAITING;
            }
        });
    }

    addPlayer() {
        let originalX, originalY, originalScale;
        if (deviceOrientation === "landscape") {
            originalX = this.platforms[this.mainPlatform].displayWidth - gameOptions.poleWidth;
            originalY = this.game.config.height - (gameOptions.platformHeight * 0.5);
            originalScale = 0.15;
        } else {
            originalX = this.platforms[this.mainPlatform].displayWidth - gameOptions.poleWidth;
            originalY = this.game.config.height - gameOptions.platformHeight + 20;
            originalScale = 0.20;
        }
        let decreaseAmount = 0.2 * originalX;
        let newX = originalX - decreaseAmount;
        this.player = this.physics.add.sprite(newX, originalY, "player").setScale(originalScale);
        this.player.setOrigin(1, 1);
        this.vfx.scaleGameObject(this.player, 1.1, 500);
    }

    addPole() {
        let poleX, poleY;
        if (deviceOrientation === "landscape") {
            poleX = this.platforms[this.mainPlatform].displayWidth - 60;
            poleY = this.game.config.height - (gameOptions.platformHeight * 0.5) + 20;
        } else {
            poleX = this.platforms[this.mainPlatform].displayWidth - 60;
            poleY = this.game.config.height - gameOptions.platformHeight + 20;
        }
        this.pole = this.physics.add.sprite(poleX, poleY, "projectile");
        this.pole.setOrigin(1, 1);
        this.pole.displayWidth = gameOptions.poleWidth;
        this.pole.displayHeight = gameOptions.playerHeight / 4;
    }

    grow() {
        if (this.gameMode === WAITING) {
            this.gameMode = GROWING;
            this.growTween = this.tweens.add({
                targets: [this.pole],
                displayHeight: gameOptions.platformGapRange[1] + gameOptions.platformWidthRange[1],
                duration: gameOptions.growTime
            });
        }
    }

    stop() {
        if (this.gameMode === GROWING) {
            this.gameMode = IDLE;
            this.growTween.stop();
            if (this.pole.displayHeight > this.platforms[1 - this.mainPlatform].x - this.pole.x) {
                this.tweens.add({
                    targets: [this.pole],
                    angle: 90,
                    duration: gameOptions.rotateTime,
                    ease: "Bounce.easeOut",
                    callbackScope: this,
                    onComplete: function () {
                        this.gameMode = WALKING;
                        if (this.pole.displayHeight < this.platforms[1 - this.mainPlatform].x + this.platforms[1 - this.mainPlatform].displayWidth - this.pole.x) {
                            this.walkTween = this.tweens.add({
                                targets: [this.player],
                                x: this.platforms[1 - this.mainPlatform].x + this.platforms[1 - this.mainPlatform].displayWidth - this.pole.displayWidth,
                                duration: gameOptions.walkTime * this.pole.displayHeight,
                                callbackScope: this,
                                onComplete: function () {
                                    // Play score sound as soon as Mario reaches the platform.
                                    this.sounds.score.setVolume(0.75).setLoop(false).play();
                                    this.tweens.add({
                                        targets: [this.player, this.pole, this.platforms[1 - this.mainPlatform], this.platforms[this.mainPlatform]],
                                        props: { x: { value: "-= " + this.platforms[1 - this.mainPlatform].x } },
                                        duration: gameOptions.scrollTime,
                                        callbackScope: this,
                                        onComplete: function () {
                                            this.prepareNextMove();
                                        }
                                    });
                                }
                            });
                        } else {
                            this.platformTooLong();
                        }
                    }
                });
            } else {
                this.platformTooShort();
            }
        }
    }

    platformTooLong() {
        this.walkTween = this.tweens.add({
            targets: [this.player],
            x: this.pole.x + this.pole.displayHeight + this.player.displayWidth,
            duration: gameOptions.walkTime * this.pole.displayHeight,
            callbackScope: this,
            onComplete: function () {
                this.fallAndDie();
            }
        });
    }

    platformTooShort() {
        this.tweens.add({
            targets: [this.pole],
            angle: 90,
            duration: gameOptions.rotateTime,
            ease: "Cubic.easeIn",
            callbackScope: this,
            onComplete: function () {
                this.gameMode = WALKING;
                this.tweens.add({
                    targets: [this.player],
                    x: this.pole.x + this.pole.displayHeight,
                    duration: gameOptions.walkTime * this.pole.displayHeight,
                    callbackScope: this,
                    onComplete: function () {
                        this.tweens.add({
                            targets: [this.pole],
                            angle: 180,
                            duration: gameOptions.rotateTime,
                            ease: "Cubic.easeIn"
                        });
                        this.fallAndDie();
                    }
                });
            }
        });
    }

    fallAndDie() {
        this.gameMode = IDLE;
        this.tweens.add({
            targets: [this.player],
            y: this.game.config.height + this.player.displayHeight * 2,
            duration: gameOptions.fallTime,
            ease: "Cubic.easeIn",
            callbackScope: this,
            onComplete: function () {
                this.shakeAndRestart();
            }
        });
    }

    prepareNextMove() {
        // Remove sound call from here so that it only plays when Mario lands.
        let pointsText = this.add.bitmapText(this.player.x, this.player.y - 50, 'pixelfont', '+10', 75)
            .setOrigin(0.5, 0.5).setTint(0xffd700);
        this.tweens.add({
            targets: pointsText,
            y: pointsText.y - 200,
            alpha: 0,
            ease: 'Linear',
            duration: 2500,
            onComplete: function () {
                pointsText.destroy();
            }
        });
        this.updateScore(10);
        this.gameMode = IDLE;
        this.platforms[this.mainPlatform].x = this.width;
        this.mainPlatform = 1 - this.mainPlatform;
        this.tweenPlatform();
        this.pole.angle = 0;
        this.pole.x = this.platforms[this.mainPlatform].displayWidth - 40;
        this.pole.displayHeight = gameOptions.poleWidth;
    }

    shakeAndRestart() {
        let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 350, 'pixelfont', 'Game Over', 64)
            .setOrigin(0.5)
            .setVisible(false)
            .setAngle(-15).setTint(0xFF0000);
        this.vfx.shakeCamera();
        this.time.delayedCall(500, () => {
            this.sounds.lose.setVolume(1).setLoop(false).play();
            gameOverText.setVisible(true);
            this.tweens.add({
                targets: gameOverText,
                y: '+=200',
                angle: 0,
                scale: { from: 0.5, to: 2 },
                alpha: { from: 0, to: 1 },
                ease: 'Elastic.easeOut',
                duration: 1500,
                onComplete: () => {
                    this.time.delayedCall(1000, this.gameOver, [], this);
                }
            });
        });
    }

    update(time, delta) {}

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('bridgeBuilderHighScore', this.highScore);
            this.highScoreText.setText('High Score: ' + this.highScore);
        }
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        this.sound.stopAll();
        initiateGameOver.bind(this)({ score: this.score });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

function displayProgressLoader() {
    let width = 320;
    let height = 50;
    let x = (this.game.config.width / 2) - 160;
    let y = (this.game.config.height / 2) - 50;
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(x, y, width, height);
    const loadingText = this.make.text({
        x: this.game.config.width / 2,
        y: this.game.config.height / 2 + 20,
        text: 'Loading...',
        style: { font: '20px monospace', fill: '#ffffff' }
    }).setOrigin(0.5, 0.5);
    loadingText.setOrigin(0.5, 0.5);
    const progressBar = this.add.graphics();
    this.load.on('progress', (value) => {
        progressBar.clear();
        progressBar.fillStyle(0x364afe, 1);
        progressBar.fillRect(x, y, width * value, height);
    });
    this.load.on('fileprogress', function (file) {});
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[deviceOrientation].width,
    height: _CONFIG.orientationSizes[deviceOrientation].height,
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
        instructions: _CONFIG.instructions,
    },
    orientation: deviceOrientation
};

let gameOptions = {
    platformGapRange: [200, 400],
    platformWidthRange: [50, 150],
    platformHeight: 600,
    playerWidth: 32,
    playerHeight: 64,
    poleWidth: 15,
    growTime: 1000,
    rotateTime: 500,
    walkTime: 3,
    fallTime: 500,
    scrollTime: 250
};

const IDLE = 0;
const WAITING = 1;
const GROWING = 2;
const WALKING = 3;

const game = new Phaser.Game(config);
