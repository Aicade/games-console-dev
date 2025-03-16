const joystickEnabled = false;
const buttonEnabled = false;

const gameOptions = {
    "hingeCount": 4,
    "timeLimit": 5000,
    "ropeColor": 0x000000,
    "ropeAlpha": 0.5,
    "hingeColor": 0x000000,
    "hingeAlpha": 0.5,
}

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.score = 0;

        this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        // Load In-Game Assets from assetsLoader
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        addEventListenersPhaser.bind(this)();

        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        this.load.audio('bgm', ['https://aicade-ui-assets.s3.amazonaws.com/GameAssets/music/bgm-3.mp3']);
        this.load.audio('collect', ['https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/collect_1.mp3']);
        this.load.audio('flap', ['https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/jump_3.mp3']);

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }

    create() {
        this.vfx = new VFXLibrary(this);

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(1).setLoop(true).play();

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Score display: positioned at the very top center (y = 0)
        this.scoreText = this.add.bitmapText(this.width / 2, 0, 'pixelfont', '0', 128).setOrigin(0.5, 0);
        this.scoreText.setDepth(11);

        const joyStickRadius = 50;
        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 2,
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
            });
        }

        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 80, this.height - 100, 80, 80, 0xcccccc, 0.5);
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });
            this.buttonA.button.on('down', function (button, gameObject) {
                console.log("button clicked");
            });
        }

        // Game code starts here
        this.matter.world.setBounds(0, 0, config.width, config.height);
        this.player = this.matter.add.image(400, 100, 'player', null, { shape: 'circle' }).setScale(0.2);

        this.currentRope = null;
        this.hinges = [];
        this.closestHinge = null;
        for (let i = 0; i < gameOptions.hingeCount; i++) {
            let xCord = this.width * 0.1 + (((this.width * 0.8) / (gameOptions.hingeCount - 1)) * i);
            let yCord = Phaser.Math.Between(this.height * 0.1, this.height * 0.4);
            const circle = this.add.circle(xCord, yCord, 30, gameOptions.hingeColor, gameOptions.hingeAlpha);
            const body = this.matter.add.circle(xCord, yCord, 30, { isStatic: true, isSensor: true });
            let hinge = this.matter.add.gameObject(circle, body);
            this.hinges.push(hinge);
        }

        this.collectible = null;
        this.spawnCollectible();

        // Collision event modified to add overlay text when a collectible is collected.
        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach(pair => {
                if ((pair.bodyA === this.player.body && pair.bodyB === this.collectible.body) ||
                    (pair.bodyB === this.player.body && pair.bodyA === this.collectible.body)) {

                    // Capture collectible's position before it's destroyed.
                    const overlayX = this.collectible.x;
                    const overlayY = this.collectible.y;
                    // Create overlay text showing "+10" in green.
                    const overlayText = this.add.bitmapText(overlayX, overlayY, 'pixelfont', '+10', 64)
                                              .setOrigin(0.5, 0.5)
                                              .setTint(0x00FF00);
                    // Tween: move up and fade out.
                    this.tweens.add({
                        targets: overlayText,
                        y: overlayY - 50,
                        alpha: 0,
                        duration: 1000,
                        ease: 'Linear',
                        onComplete: () => overlayText.destroy()
                    });

                    this.sounds.collect.setVolume(1).setLoop(false).play();
                    this.spawnCollectible();
                    this.startTimer();
                    this.updateScore(10);
                    if (this.timeLimit >= 3000) {
                        this.timeLimit -= 100;
                    }
                }
            });
        });

        this.ropeGraphics = this.add.graphics();

        this.input.on('pointerdown', function (pointer) {
            this.sounds.move.setVolume(1).setLoop(false).play();
            this.closestHinge = this.getClosestHinge(pointer.x, pointer.y);
            const playerDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.closestHinge.x, this.closestHinge.y);

            if (this.closestHinge) {
                if (this.currentRope) {
                    this.matter.world.removeConstraint(this.currentRope);
                    this.ropeGraphics.clear();
                }
                this.currentRope = this.matter.add.constraint(this.player, this.closestHinge, playerDistance, 0.15);
            }
        }, this);

        this.input.on('pointerup', function (pointer) {
            if (this.currentRope) {
                this.matter.world.removeConstraint(this.currentRope);
                this.ropeGraphics.clear();
                this.currentRope = null;
            }
        }, this);

        this.timeLimit = gameOptions.timeLimit;
        this.timeRemaining = this.timeLimit;
        this.timerWidth = this.width;
        this.timerGraphics = this.add.graphics();
        this.updateTimerGraphics();
        this.startTimer();
        this.input.keyboard.disableGlobalCapture();
    }

    getClosestHinge(x, y) {
        let closestHinge = null;
        let shortestDistance = Infinity;
        this.hinges.forEach(hinge => {
            let distance = Phaser.Math.Distance.Between(x, y, hinge.x, hinge.y);
            if (distance < shortestDistance) {
                closestHinge = hinge;
                shortestDistance = distance;
            }
        });
        return closestHinge;
    }

    // Modified spawnCollectible to avoid the top center region (safe area)
    spawnCollectible(player, collectible) {
        if (this.collectible) {
            this.collectible.destroy();
        }
        let x, y;
        // Define safe area for score display: central 200px horizontally and top 100px vertically.
        const safeXMin = this.width / 2 - 100;
        const safeXMax = this.width / 2 + 100;
        const safeYMax = 100;
        do {
            x = Phaser.Math.Between(50, this.width - 50);
            y = Phaser.Math.Between(Math.floor(this.height * 0.2), Math.floor(this.height * 0.6));
        } while (x >= safeXMin && x <= safeXMax && y <= safeYMax);
        
        this.collectible = this.matter.add.image(x, y, 'collectible', null, {
            shape: 'circle',
            isStatic: true,
            isSensor: true,
        }).setScale(0.2);
    }

    drawRope(x1, y1, x2, y2) {
        this.ropeGraphics.clear();
        this.ropeGraphics.lineStyle(2, gameOptions.ropeColor, gameOptions.ropeAlpha);
        this.ropeGraphics.beginPath();
        this.ropeGraphics.moveTo(x1, y1);
        this.ropeGraphics.lineTo(x2, y2);
        this.ropeGraphics.strokePath();
    }

    // Updated timer graphics: smoothly transitions from green to yellow to red.
    updateTimerGraphics() {
        this.timerGraphics.clear();

        let ratio = this.timeRemaining / this.timeLimit;
        let width = ratio * this.timerWidth;
        let color;
        if (ratio > 0.5) {
            // Transition from green to yellow.
            let progress = (1 - ratio) * 2; // progress = 0 when ratio = 1, progress = 1 when ratio = 0.5
            let red = Math.floor(255 * progress);
            let green = 255;
            color = (red << 16) | (green << 8);
        } else {
            // Transition from yellow to red.
            let progress = ratio * 2; // progress = 1 when ratio = 0.5, progress = 0 when ratio = 0
            let green = Math.floor(255 * progress);
            let red = 255;
            color = (red << 16) | (green << 8);
        }
        this.timerGraphics.fillStyle(color, 1);
        this.timerGraphics.fillRect(0, this.height - 40, width, 20);
    }

    startTimer() {
        this.timeRemaining = this.timeLimit;
        if (this.timerEvent) this.timerEvent.remove();
        this.timerEvent = this.time.addEvent({
            delay: 50,
            callback: () => {
                this.timeRemaining -= 50;
                if (this.timeRemaining <= 0) {
                    this.gameOver();
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    update() {
        this.hinges.forEach(hinge => {
            hinge.y += Math.sin(hinge.x + this.time.now / 500);
        });

        if (this.currentRope) {
            this.currentRope.length -= 6;

            if (this.currentRope.length < 50) {
                this.matter.world.removeConstraint(this.currentRope);
                this.ropeGraphics.clear();
                this.currentRope = null;
            } else {
                this.drawRope(this.player.x, this.player.y, this.closestHinge.x, this.closestHinge.y);
            }
        }

        this.updateTimerGraphics();
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        initiateGameOver.bind(this)({
            score: this.score
        });
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
        orientation: Phaser.Scale.Orientation.PORTRAIT
    },
    pixelArt: true,
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            debug: false
        }
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation==="portrait"
};
