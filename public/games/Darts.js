// Set game orientation based on device type: mobile devices use portrait, desktop uses landscape.
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
_CONFIG.deviceOrientation = isMobile ? "portrait" : "landscape";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.isgameover = false;
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
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }
    
    // Updated createPin: Increase dart width 5 times the base value.
    createPin(x, y, dt, text) {
        let ret = { x: x, y: y, dt: dt, text: text, sprite: null };

        ret.sprite = this.add.sprite(x, y, 'projectile').setOrigin(0.5);
        let baseScale = 32 / 1024;
        // Horizontal scale increased 5 times; vertical remains the same.
        ret.sprite.setScale(baseScale * 5, baseScale);

        let style = { font: "10px Arial", fill: "#000", align: "center" };
        let t = this.add.text(x, y, text, style).setOrigin(0.5);
        ret.sprite.t = t;

        return ret;
    }
    
    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        // Updated background music volume to 30% (0.3)
        this.backgroundMusic = this.sounds.background.setVolume(0.3).setLoop(true);
        this.backgroundMusic.play();

        this.isgameover = false;
        this.score = 0;

        this.vfx = new VFXLibrary(this);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0).setDepth(-10);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 60, 'pixelfont', '0', 80).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(11);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.numberofPins = 50;
        this.pins = [];
        this.toLaunch = [];
        this.elapsed = 0;
        this.gameover = false;

        let centerCir = this.add.sprite(this.cameras.main.centerX, 350, 'player').setDepth(1).setScale(0.3);
        this.linesCanvasGraphic = this.add.graphics(0, 0);

        // Create the dart already attached to the circle.
        let p = this.createPin(this.cameras.main.centerX + 100, 150, 0, '1');
        this.pins.push(p);

        // Determine the starting Y for waiting darts based on orientation.
        let startY = _CONFIG.deviceOrientation === "portrait" ? 850 : (this.game.config.height - 70);

        // Create waiting darts (the game logic still uses these).
        for (let i = 2; i < this.numberofPins; i++) {
            this.toLaunch.push(this.createPin(this.cameras.main.centerX, startY + ((i - 2) * 50), 0, i.toString()));
        }

        // The next dart to be launched.
        this.pinLaunch = this.toLaunch[0].sprite;

        // Create a clear visual indicator for the next dart.
        // This indicator overlays the waiting dart, uses the same asset but is semi-transparent.
        this.nextDartIndicator = this.add.sprite(this.pinLaunch.x, this.pinLaunch.y, 'projectile').setOrigin(0.5);
        this.nextDartIndicator.setScale(32 / 1024);
        this.nextDartIndicator.setAlpha(0.5);

        this.input.on('pointerdown', this.releasePin, this);
        this.input.keyboard.disableGlobalCapture();

        // Show instructions overlay at game start.
        this.showInstructionsOverlay();
    }
    
    // Instructions overlay method.
    showInstructionsOverlay() {
        // Create a semi-transparent rectangle that covers the entire game screen.
        let overlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.game.config.width,
            this.game.config.height,
            0x000000,
            0.7
        ).setDepth(50);

        // Define instructions text.
        let instructionsText = 
            "Welcome to Dart Throw!\n\n" +
            "Instructions:\n" +
            "- Tap to throw darts.\n" +
            "- Aim carefully to avoid hitting existing darts.\n" +
            "- Clear all darts to win the game.\n\n" +
            "Tap anywhere to begin!";

        // Create the text object.
        let textStyle = {
            font: "24px Arial",
            fill: "#ffffff",
            align: "center",
            wordWrap: { width: this.game.config.width - 50 }
        };
        let instructions = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            instructionsText,
            textStyle
        )
        .setOrigin(0.5)
        .setDepth(51);

        // Make the overlay interactive so it blocks game input.
        overlay.setInteractive();
        overlay.on('pointerdown', () => {
            // Fade out the overlay and instructions text.
            this.tweens.add({
                targets: [overlay, instructions],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    instructions.destroy();
                }
            });
        });
    }
    
    releasePin() {
        if (!this.isgameover) {
            this.sounds.move.setVolume(3).setLoop(false).play();
            let pointsText = this.add.bitmapText(this.pinLaunch.x, this.pinLaunch.y - 75, 'pixelfont', '+10', 45)
                .setOrigin(0.5, 0.5);

            this.tweens.add({
                targets: pointsText,
                y: pointsText.y - 50,
                alpha: 0,
                ease: 'Linear',
                duration: 1000,
                onComplete: function () {
                    pointsText.destroy();
                }
            });
            this.updateScore(1);
            if (this.gameover) {
                return;
            }
            if (this.tweenRunning && this.tweenRunning.isPlaying()) {
                return;
            }

            this.tweenRunning = this.tweens.add({
                targets: this.pinLaunch,
                y: 550,
                duration: 100,
                ease: 'Linear',
                onComplete: () => {
                    this.tweenRunning = null;
                    this.pinLaunch.y = 550;
                    this.checkIntersection();

                    let current = this.toLaunch.shift();
                    current.dt = this.elapsed;
                    this.pins.push(current);

                    if (this.toLaunch.length === 0) {
                        this.gameover = true;
                        this.winAnimations();
                        return;
                    }

                    this.pinLaunch = this.toLaunch[0].sprite;
                    
                    // Update the visual indicator for the next dart.
                    this.nextDartIndicator.x = this.pinLaunch.x;
                    this.nextDartIndicator.y = this.pinLaunch.y;

                    this.toLaunch.forEach((pin) => {
                        this.tweens.add({
                            targets: pin.sprite,
                            y: '-=50',
                            duration: 30,
                            ease: 'Linear'
                        });
                    });
                }
            });
        }
    }

    winAnimations() {
        let winText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY, 'pixelfont', 'You Win!', 64)
            .setOrigin(0.5);
        
        this.time.delayedCall(2000, () => {
            this.backgroundMusic.stop();
            this.scene.restart();
        });
        this.backgroundMusic.stop();
    }

    update() {
        if (this.gameover) {
            return;
        }
        this.elapsed += 1;

        let graphics = this.linesCanvasGraphic;
        graphics.clear();
        graphics.lineStyle(2, 0xFFFF83, 1);

        let ang120 = Math.PI / 2;
        for (let i = 0; i < this.pins.length; i++) {
            let pin = this.pins[i];
            let angle = Math.PI * ((this.elapsed - pin.dt) / 120) + ang120;
            let x = Math.cos(angle) * 200 + this.cameras.main.centerX;
            let y = Math.sin(angle) * 200 + 350;
            pin.sprite.x = x;
            pin.sprite.y = y;
            graphics.moveTo(this.cameras.main.centerX, 350);
            graphics.lineTo(pin.sprite.x, pin.sprite.y);
            graphics.strokePath();
        }
        this.checkIntersection();

        // Always update the next dart indicator's position.
        if (this.nextDartIndicator && this.pinLaunch) {
            this.nextDartIndicator.x = this.pinLaunch.x;
            this.nextDartIndicator.y = this.pinLaunch.y;
        }
    }

    circlesIntersect(s1, s2) {
        let scale = 32 / 1024;
        let c1X = s1.x, c1Y = s1.y;
        let c1Radius = (s1.width * scale) / 2;
        let c2X = s2.x, c2Y = s2.y;
        let c2Radius = (s2.width * scale) / 2;
        let distanceX = c2X - c1X;
        let distanceY = c2Y - c1Y;
        let magnitude = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        console.log(magnitude < (c1Radius + c2Radius));
        return magnitude < (c1Radius + c2Radius);
    }

    checkIntersection() {
        if (!this.tweenRunning || !this.tweenRunning.isPlaying()) {
            return;
        }
        for (let i = 0; i < this.pins.length; i++) {
            let p = this.pins[i];
            if (this.circlesIntersect(p.sprite, this.pinLaunch)) {
                p.sprite.setTint(0xCC0000);
                this.pinLaunch.setTint(0xCC0000);
                this.gameover = true;
                this.isgameover = true;
                this.tweenRunning.pause();
                this.vfx.shakeCamera();
                let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 200, 'pixelfont', 'Game Over', 64)
                    .setOrigin(0.5)
                    .setVisible(false)
                    .setAngle(-15);
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
                break;
            }
        }
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        this.backgroundMusic.stop();
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
        style: {
            font: '20px monospace',
            fill: '#ffffff'
        }
    }).setOrigin(0.5, 0.5);
    loadingText.setOrigin(0.5, 0.5);
    const progressBar = this.add.graphics();
    this.load.on('progress', (value) => {
        progressBar.clear();
        progressBar.fillStyle(0x364afe, 1);
        progressBar.fillRect(x, y, width * value, height);
    });
    this.load.on('fileprogress', function (file) { });
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

// Configuration object
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: _CONFIG.deviceOrientation === "portrait" ? Phaser.Scale.Orientation.PORTRAIT : Phaser.Scale.Orientation.LANDSCAPE
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
    pixelArt: true,
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation === "portrait"
};
