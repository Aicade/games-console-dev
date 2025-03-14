// Game Orientation
const orientation = "portrait";
var isMobile = false;
const orientationSizes = {
    "landscape": {
        "width": 1280,
        "height": 720,
    },
    "portrait": {
        "width": 720,
        "height": 1280,
    }
}

// Touuch Screen Controls
const joystickEnabled = true;
const buttonEnabled = false;

// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.isGameOver = false; this.dropDelay = 4000; this.timer = 30; // Timer in seconds
        this.timerBarWidth = 300; this.gameWin = false;
    }

    preload() {

        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image('heart', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png');

        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        displayProgressLoader.call(this);
    }

    create() {


        //for Keyboard control
        this.input.keyboard.disableGlobalCapture();

        isMobile = !this.sys.game.device.os.desktop;

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        this.vfx = new VFXLibrary(this);

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }


        this.sounds.background.setVolume(0.1).setLoop(true).play();

        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);
        this.bg.postFX.addBlur(0.5, 2, 2, 0.8);

        // Use the larger scale factor to ensure the image covers the whole canvas
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.input.addPointer(3);
        const joyStickRadius = 50;

        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 2,
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
                // dir: '8dir',   // 'up&down'|0|'left&right'|1|'4dir'|2|'8dir'|3
                // forceMin: 16,
            });
            this.joystickKeys = this.joyStick.createCursorKeys();
        }

        

        // this.scoreText = this.add.bitmapText(0, 40, 'pixelfont', this.timer + " S", 50);
        // this.scoreText.setDepth(10);

        const centerX = this.game.config.width / 2;
        const centerY = this.game.config.height / 2;

        this.player = this.physics.add.image(centerX, this.game.config.height, 'player').setScale(0.4);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(this.player.body.width / 1.8, this.player.body.height)
        this.vfx.scaleGameObject(this.player, 1.1);

        // // Bullets
        this.bullets = this.physics.add.group();

        // Enemies
        this.enemies = this.physics.add.group();

        // Keyboard Controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.physics.add.collider(this.player, this.enemies, () => {
            this.gameOver();
        });

        this.toggleControlsVisibility(isMobile);

        this.hens = this.physics.add.staticGroup({
            key: 'enemy',
            repeat: 2,
            setXY: { x: 100, y: 50, stepX: 240 }
        });
        this.hens.children.iterate((hen) => {
            hen.setScale(0.1);
            hen.setVisible(false);
        });
        this.eggs = this.physics.add.group();


        this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
        this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
        this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);

        this.physics.add.collider(this.player, this.eggs, (bullet, enemy) => {
            if (!this.isGameOver) {
                this.sounds.collect.play();
                // this.vfx.createEmitter('red', enemy.x, enemy.y, 1, 0, 500).explode(20);
                // this.vfx.createEmitter('yellow', enemy.x, enemy.y, 1, 0, 500).explode(20);
                // this.vfx.createEmitter('orange', enemy.x, enemy.y, 1, 0, 500).explode(20);
                enemy.destroy();
                this.collectEgg(); this.updateScore(10);
            }

        });

        // Input setup
        this.cursors = this.input.keyboard.createCursorKeys();

        // Egg drop timer
        this.startEggDrop();

        this.weaponBar = this.createBar(this.width / 2 - 170, 35, 350, 40, 'Weapon', 0xFFB000);
        this.timeElapsed = 0;
        this.makeTimerMeter();
        this.startClockTimer();
    }

    startClockTimer() {
        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimerMeter,
            callbackScope: this,
            loop: true
        });
    }

    makeTimerMeter(startAngle = -90, endAngle = 270, isUpdated = false) {
        this.cX = 50;
        this.cY = 70;
        if (isUpdated) {
            this.clockText.setText(this.timer - this.timeElapsed);
        } else {
            this.clockText = this.add.bitmapText(this.cX, this.cY, 'pixelfont', this.timer - this.timeElapsed, 30).setOrigin(0.5);
            this.clockText.setDepth(11).setTint(0xFFB000);
        }
        if (this.timer - this.timeElapsed <= 0) {
            this.timeElapsed = 0;
            this.time.delayedCall(100, () => {
                this.resetGame();
                this.clockText.visible = false;
                // this.fadeOut();
            })
        }

        this.clockGraphics = this.add.graphics().setDepth(11);
        this.clockGraphics.lineStyle(4, 0xFFB000, 1);
        this.clockGraphics.arc(this.cX, this.cY, 45, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle));
        this.clockGraphics.strokePath();
    }

    updateTimerMeter() {
        if (!this.gameWin) {
            this.timeElapsed++;
            let newStartAngle = ((360 / this.timer) * this.timeElapsed) - 90;
            if (newStartAngle === 270) {
                newStartAngle = 269;
                this.timerEvent.destroy();
            }
            this.clockGraphics.clear();
            this.makeTimerMeter(newStartAngle, 270, true)
        }
    }

    createBar(x, y, width, height, label, color) {
        const bar = {};
        bar.value = 0;
        bar.graphics = this.add.graphics();
        bar.graphics.setScrollFactor(0).setDepth(10);

        bar.update = () => {
            bar.graphics.clear();
            const filledWidth = Phaser.Math.Clamp(bar.value / 100 * width, 0, width);
            bar.graphics.fillStyle(0x000000);
            bar.graphics.fillRect(x, y, width, height);
            bar.graphics.fillStyle(color);
            bar.graphics.fillRect(x, y, filledWidth, height);
            bar.graphics.lineStyle(2, 0xffffff);
            bar.graphics.strokeRect(x, y, width, height);
        };

        bar.update();
        return bar;
    }

    increaseBar(bar, value) {
        bar.value = Phaser.Math.Clamp(bar.value + value, 0, 100);
        bar.update(); if (bar.value == 100) {
            this.gameWin = true;
        }
    }

    toggleControlsVisibility(visibility) {
        this.joyStick.base.visible = visibility;
        this.joyStick.thumb.visible = visibility;
    }

    update() {
        if (this.cursors.left.isDown || this.joystickKeys.left.isDown) {
            this.player.setVelocityX(-350);
            this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.joystickKeys.right.isDown) {
            this.player.flipX = false;
            this.player.setVelocityX(350);
        } else {
            this.player.setVelocityX(0);
        }


    }
    startEggDrop() {
        if (!this.isGameOver) {
            this.time.addEvent({
                delay: Phaser.Math.Between(1000, this.dropDelay),

                callback: () => {
                    this.dropEgg();
                    this.startEggDrop();
                },
                callbackScope: this
            });
        }
    }

    dropEgg() {
        if (!this.isGameOver) {
            const hen = Phaser.Utils.Array.GetRandom(this.hens.getChildren());
            if (hen) {
                const egg = this.eggs.create(hen.x, hen.y, 'collectible');
                egg.setScale(0.25).setDepth(11);
            }
        }
    }
    pointsEffect(x, y, score) {
        let scoreText = this.add.bitmapText(x, y, 'pixelfont', `+${score}`, 50);
        this.tweens.add({
            targets: scoreText,
            y: { from: scoreText.y, to: scoreText.y - 200 }, // Move upwards
            alpha: { from: 1, to: 0 }, // Fade out
            scale: { start: 1, to: 1.5 },
            angle: { from: 0, to: 10 },
            duration: 4000,
            ease: 'Power2',
            onComplete: function () { scoreText.destroy(); },
            onStart: () => {
                scoreText.setTint(0xffff00);
            },
            yoyo: false,
            repeat: 0,
        });

    }
    collectEgg() {
        this.increaseBar(this.weaponBar, 5);
        this.pointsEffect(this.player.x, this.player.y - 150, 5);

        if (this.score % 10 == 0) {
            this.dropDelay = Math.max(1000, this.dropDelay - 1500);
        } if (this.gameWin) {
            this.resetGame();
        }
    }

    missEgg(egg) {
        egg.destroy();
        this.lives--;
        this.hearts[this.lives].destroy();
        console.log(`Lives: ${this.lives}`);
        this.vfx.shakeCamera(400, .009);

        if (this.lives <= 0) {
            this.isGameOver = true;
            this.resetGame();
            this.eggs.children.iterate((egg) => {
                egg.destroy();
            });
        }
    }

    resetGame() {
        this.isGameOver = true;
        this.vfx.shakeCamera();
        if (this.gameWin) {
            // this.makeTimerMeter(360, 270, false);

            let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 250, 'pixelfont', 'Game Win', 64)
                .setOrigin(0.5)
                .setVisible(false)
                .setAngle(-15)
                .setDepth(10)
                .setTint(0xffff00);
            this.time.delayedCall(500, () => {
                this.sounds.lose.setVolume(0.5).setLoop(false).play()
                this.sounds.background.stop();

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
        } else {
            let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 250, 'pixelfont', 'Game Over', 64)
                .setOrigin(0.5)
                .setVisible(false)
                .setAngle(-15)
                .setDepth(10)
                .setTint(0xff0000);
            this.time.delayedCall(500, () => {
                this.sounds.lose.setVolume(0.5).setLoop(false).play()
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
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {

        // this.scoreText.setText(`Score: ${this.score}`);
    }

    gameOver() {
        initiateGameOver.bind(this)({
            "score": this.score
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
    this.load.on('fileprogress', function (file) {

    });
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

/*
------------------- GLOBAL CODE ENDS HERE -------------------
*/


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
            gravity: { y: 330 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation === "portrait"
};