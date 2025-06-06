
var isMobile = false;

// Touuch Screen Controls
const joystickEnabled = true;
const buttonEnabled = false;

// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for (const key in _CONFIG.libraryLoader) {
            this.load.script(key, _CONFIG.libraryLoader[key]);
        }

        this.score = 0;

        addEventListenersPhaser.bind(this)();

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);

    }

    create() {
        isMobile = !this.sys.game.device.os.desktop;

        this.sounds = {};

        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.background.setVolume(1).setLoop(false).play()

        this.vfx = new VFXLibrary(this);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);      // Use the larger scale factor to ensure the image covers the whole canvas
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale).setDepth(-5);


        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', '0', 128).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(11);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        const joyStickRadius = 50;

        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 2,
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
                dir: '8dir',   // 'up&down'|0|'left&right'|1|'4dir'|2|'8dir'|3
                // forceMin: 16,
            });
            this.joystickKeys = this.joyStick.createCursorKeys();
        }

        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 80, this.height - 100, 80, 80, 0xcccccc, 0.5)
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });

            this.buttonA.button.on('down', (button, gameObject) => {
                console.log("buttonA clicked");
            });
        }

        this.lastMoveTime = 0;
        this.moveInterval = 150;
        this.tileSize = 50;
        this.snakeDirection = Phaser.Math.Vector2.RIGHT;
        this.snakeBody = [];
        this.apple = null;
        this.isGameOver = false;
        this.enemy = null;

        this.snakeBody.push(
            this.add.sprite(50, 50, 'player').setDisplaySize(this.tileSize, this.tileSize).setOrigin(0).setDepth(12)
        );

        // this.vfx.addShine(this.snakeBody);

        this.apple = this.add.sprite(50, 50, 'collectible_2').setDisplaySize(this.tileSize, this.tileSize).setOrigin(0).setDepth(15);
        this.vfx.addGlow(this.apple, .9);
        this.vfx.scaleGameObject(this.apple, 1.1, 500);
        this.positionapple();

        this.enemy = this.add.sprite(50, 50, 'avoidable').setDisplaySize(this.tileSize, this.tileSize).setOrigin(0);
        this.vfx.scaleGameObject(this.enemy, 1.1, 500);
        // this.vfx.shakeGameObject(this.enemy, 500, 10);
        this.positionenemy();

        this.setupKeyboardInputs();
        this.joystickKeys = this.joyStick.createCursorKeys();
        this.toggleControlsVisibility(isMobile);
        this.input.keyboard.disableGlobalCapture();

    }
    toggleControlsVisibility(visibility) {
        this.joyStick.base.visible = visibility;
        this.joyStick.thumb.visible = visibility;
        this.buttonA.visible = visibility;
    }

    update(time, delta) {
        if (!this.isGameOver) {
            if (time >= this.lastMoveTime + this.moveInterval) {
                this.lastMoveTime = time;
                this.move();
            }
        }
    }

    positionapple() {
        this.apple.x = Math.floor((Math.random() * this.game.config.width) / this.tileSize) * this.tileSize;
        this.apple.y = Math.floor((Math.random() * this.game.config.height) / this.tileSize) * this.tileSize;


    }

    positionenemy() {
        this.enemy.x = Math.floor((Math.random() * this.game.config.width) / this.tileSize) * this.tileSize;
        this.enemy.y = Math.floor((Math.random() * this.game.config.height) / this.tileSize) * this.tileSize;
    }

    setupKeyboardInputs() {
        const cursors = this.input.keyboard.createCursorKeys();

        this.input.keyboard.on('keydown', (event) => {
            if (cursors.left.isDown && this.snakeDirection !== Phaser.Math.Vector2.RIGHT) {
                this.snakeDirection = Phaser.Math.Vector2.LEFT;
            } else if (cursors.right.isDown && this.snakeDirection !== Phaser.Math.Vector2.LEFT) {
                this.snakeDirection = Phaser.Math.Vector2.RIGHT;
            } else if (cursors.up.isDown && this.snakeDirection !== Phaser.Math.Vector2.DOWN) {
                this.snakeDirection = Phaser.Math.Vector2.UP;
            } else if (cursors.down.isDown && this.snakeDirection !== Phaser.Math.Vector2.UP) {
                this.snakeDirection = Phaser.Math.Vector2.DOWN;
            }
        });
    }

    move() {
        if (this.joystickKeys.left.isDown) {
            this.snakeDirection = Phaser.Math.Vector2.LEFT;
        } else if (this.joystickKeys.right.isDown) {
            this.snakeDirection = Phaser.Math.Vector2.RIGHT;
        } else if (this.joystickKeys.up.isDown) {
            this.snakeDirection = Phaser.Math.Vector2.UP;
        } else if (this.joystickKeys.down.isDown) {
            this.snakeDirection = Phaser.Math.Vector2.DOWN;
        }

        let newX = this.snakeBody[0].x + this.snakeDirection.x * this.tileSize;
        let newY = this.snakeBody[0].y + this.snakeDirection.y * this.tileSize;

        if (newX === this.apple.x && newY === this.apple.y) {
            let lastSegment = this.snakeBody[this.snakeBody.length - 1];

            this.snakeBody.push(
                this.add.sprite(lastSegment.x, lastSegment.y, 'collectible_1')
                    .setDisplaySize(this.tileSize, this.tileSize).setOrigin(0)
            );
            this.sounds.damage.setVolume(0.75).setLoop(false).play()

            let bubble = this.add.graphics({ x: -100, y: 0, add: false });

            // Define the bubble's properties
            const bubbleRadius = 50;
            const bubbleColor = 0x00bfff; // A nice bubble color

            // Draw the bubble
            bubble.fillStyle(bubbleColor, 0.5); // Semi-transparent
            bubble.fillCircle(bubbleRadius, bubbleRadius, bubbleRadius);
            bubble.generateTexture('bubbles', 100, 100);

            const emitter = this.add.particles(this.snakeBody[0].x, this.snakeBody[0].y, 'bubbles', {
                speed: { min: -100, max: 300 },
                scale: { start: .2, end: 0 },
                blendMode: 'MULTIPLY',
                lifespan: 750,
                tint: 0xfafafa
            });
            emitter.explode(70);

            let pointsText = this.add.bitmapText(this.snakeBody[0].x, this.snakeBody[0].y, 'pixelfont', '+10', 45)
                .setOrigin(0.5, 0.5);


            this.tweens.add({
                targets: pointsText,
                y: pointsText.y - 50,
                alpha: 0, // Fade out
                ease: 'Linear', // Animation ease
                duration: 1000,
                onComplete: function () {
                    pointsText.destroy();
                }
            });


            this.positionapple();
            this.positionenemy();
            this.updateScore(10);
            if (this.moveInterval > 100) {
                this.moveInterval -= 5;
            }
        }

        if (newX === this.enemy.x && newY === this.enemy.y) {
            this.enemy.destroy();
            this.gameOverEffect(this.enemy);
            this.isGameOver = true;

        }

        for (let index = this.snakeBody.length - 1; index > 0; index--) {
            this.snakeBody[index].x = this.snakeBody[index - 1].x;
            this.snakeBody[index].y = this.snakeBody[index - 1].y;
        }

        if (this.snakeBody.length > 0) {
            this.snakeBody[0].x = newX;
            this.snakeBody[0].y = newY;
        }

        this.checkthisOver();
    }

    gameOverEffect(gameObject) {
        const emitter = this.add.particles(gameObject.x, gameObject.y, 'bubbles', {
            speed: { min: -100, max: 300 },
            scale: { start: .2, end: 0 },
            blendMode: 'MULTIPLY',
            lifespan: 750,
            tint: 0x93C54B
        });

        // emitter.setPosition(x, y);
        emitter.explode(75);
        let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 150, 'pixelfont', 'Game Over', 64)
            .setOrigin(0.5)
            .setVisible(false)
            .setAngle(-15).setTint(0xFF0000);
        this.vfx.shakeCamera();

        this.time.delayedCall(500, () => {
            this.sounds.lose.setVolume(1).setLoop(false).play()
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

    checkthisOver() {
        if (!this.isGameOver && (this.snakeBody[0].x < 0 ||
            this.snakeBody[0].x >= this.game.config.width ||
            this.snakeBody[0].y < 0 ||
            this.snakeBody[0].y >= this.game.config.height ||
            this.snakeBody.slice(1).some(segment => segment.x === this.snakeBody[0].x && segment.y === this.snakeBody[0].y))) {
            this.isGameOver = true;
            this.gameOverEffect(this.snakeBody[0]);
        }
    }

    resetSnake() {
        this.snakeBody.forEach(segment => segment.destroy());

        this.snakeBody = [];

        let initialX = this.game.config.width / 2;
        let initialY = this.game.config.height / 2;
        this.snakeBody.push(this.add.rectangle(initialX, initialY, this.tileSize, this.tileSize, 0x0000ff).setOrigin(0));
        this.snakeBody.push(
            this.add.sprite(
                initialX,
                initialY,
                'player')
                .setDisplaySize(this.tileSize, this.tileSize).setOrigin(0)
        );

        this.snakeDirection = Phaser.Math.Vector2.LEFT;
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
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
    this.load.on('fileprogress', function (file) {

    });
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

// Configuration object
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
    /* ADD CUSTOM CONFIG ELEMENTS HERE */
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 400 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation === "landscape"
};