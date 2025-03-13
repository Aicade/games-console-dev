/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.isGameOver = false;
        this.bounceDirection = 1;
        this.socialButtonClicked = false;
        this.isBasketballInScoreZone = false;
        this.timer = 60;
    }

    preload() {
        console.log("call");

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


        this.load.image('basket', `https://play.rosebud.ai/assets/basket_asset_03.png?QN8Y`);
        this.load.image('block', `https://aicade-ui-assets.s3.amazonaws.com/GameAssets/textures/Bricks/s2+Brick+04+Plaster+Grey.png`);

        displayProgressLoader.call(this);
    }

    create() {
        //for keyboard control
        this.input.keyboard.disableGlobalCapture();
        this.physics.world.gravity.y = 1200; 

        this.width = this.game.config.width; this.height = this.game.config.height;
        this.vfx = new VFXLibrary(this);
        //======================================================
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        //======================================================

        this.sounds.background.setVolume(3).setLoop(true).play();
        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);      // Use the larger scale factor to ensure the image covers the whole canvas
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale).setDepth(-5);
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 70, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' }); this.pauseButton.setScale(3).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());
        this.input.addPointer(3);
        this.scoreText = this.add.bitmapText(this.width / 2, 60, 'pixelfont', this.score, 100).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(10);

        console.log("in");
        this.cursors = this.input.keyboard.createCursorKeys();

        //=============================================================================
        this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
        this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
        this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);

        // Create ground collision box
        const ground = this.physics.add.staticImage(this.scale.width / 2, this.scale.height - 16, 'block').setScale(.5);
        ground.displayWidth = this.scale.width;
        ground.refreshBody();

        // Create ground tiles for visual purposes only
        const blockSize = 64;
        this.blocks = this.add.group();
        for (let x = 0; x < this.scale.width; x += blockSize) {
            const block = this.add.image(x + blockSize / 2, this.scale.height - blockSize / 2, 'block').setScale(.2);
            block.setOrigin(0.5, 0.5);
            this.blocks.add(block);
        }

        this.basketball = this.physics.add.sprite(this.scale.width / 2, this.scale.height - blockSize - 75, 'player')
            .setScale(0.2);
        this.basketball.setBounce(0.8);
        this.basketball.setCollideWorldBounds(true);
        this.basketball.setDepth(20);
        this.basketball.body.setCircle(this.basketball.width / 2);

        // Set drag to add friction
        this.basketball.setDrag(10, 0);

        this.physics.add.collider(this.basketball, ground, () => {
            if (this.basketball.body.velocity.y < -50) {
                this.cameras.main.shake(100, 0.001);
                this.basketballHitGround = true;
            }
        });

        this.basketball.body.onWorldBounds = true;
        this.basketball.body.world.on('worldbounds', (body) => {
            if (body.gameObject === this.basketball) {
                this.triggerEffects(body.x, body.y, 50);
                if (body.blocked.left) {
                    this.bounceDirection = 1;
                    this.cameras.main.shake(100, 0.002);
                } else if (body.blocked.right) {
                    this.bounceDirection = -1;
                    this.cameras.main.shake(100, 0.002);
                }
            }
        }, this);

        this.basketContainer = this.add.container(this.scale.width / 2, this.scale.height / 2);
        this.basket = this.add.image(0, 0, 'basket').setScale(1);
        this.basket.setDepth(20);
        this.basket.visible = false;
        this.basketContainer.add(this.basket); // Add Basket to BasketContainer

        this.rim1 = this.physics.add.staticImage(this.basketContainer.x - 50, this.basketContainer.y - 20, 'player').setScale(0.007);
        this.rim1.setOrigin(0.5, 0.5);
        this.rim1.setVisible = false;

        this.rim2 = this.physics.add.staticImage(this.basketContainer.x + 50, this.basketContainer.y - 20, 'player').setScale(0.007);
        this.rim2.setOrigin(0.5, 0.5);
        this.rim2.setVisible = false;

        this.physics.add.collider(this.basketball, [this.rim1, this.rim2], () => {
        });

        this.scoreZone = this.physics.add.image(this.basketContainer.x, this.basketContainer.y - 10, 'block').setScale(0.1, 0.1).setSize(this.basket.width, 10).setOrigin(0.5, 0.5);
        this.scoreZone.setAlpha(0);
        this.scoreZone.body.isSensor = true;
        this.scoreZone.body.setAllowGravity(false);
        this.scoreZone.setVisible = false;

        this.tweens.add({
            targets: [this.basket],
            scale: 0.9,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        this.clickToPlayText = this.add.bitmapText(this.scale.width / 2, this.scale.height / 2, 'pixelfont', 'Click to Play', 120)
            .setOrigin(0.5).setScale(0.75).setTint(0xffa500);


        this.tweens.add({
            targets: this.clickToPlayText,
            y: '-=10',
            ease: 'Power1',
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        this.physics.add.collider(this.basketball, [this.rim1, this.rim2]);

        this.physics.add.overlap(this.basketball, this.scoreZone, () => {
            if (!this.isBasketballInScoreZone) {
                this.updateScore(1);
                this.pointsEffect(this.basketContainer.x, this.basketContainer.y, 1);
                this.isBasketballInScoreZone = true;
                const newCoords = this.findNewBasketPosition();
                this.basketContainer.x = newCoords.x;
                this.basketContainer.y = newCoords.y;
            }
        });

        this.scoreText.visible = false;

        let isFirstClick = true;

        this.input.on('pointerdown', (pointer) => {
            if (!this.isGameOver) {
                if (isFirstClick) {
                    const targets = [this.clickToPlayText];
                    this.tweens.add({
                        targets,
                        alpha: 0,
                        ease: 'Power1',
                        duration: 500,
                        onComplete: () => {
                            targets.forEach(target => target.visible = false);
                            this.basket.visible = true;
                            this.scoreText.visible = true;
                            this.timeElapsed = 0;
                            this.makeTimerMeter();
                            this.startClockTimer();
                        }
                    });

                    isFirstClick = false;
                } else {
                    this.triggerEffects(pointer.x, pointer.y, 10);

                    this.basketball.setVelocityY(-600);
                    this.basketball.setVelocityX(100 * this.bounceDirection);
                }
            }
        });

        this.basketball.body.world.on('worldbounds', (body) => {
            if (body.gameObject === this.basketball) {
                this.triggerEffects(body.x, body.y, 50);
        
                if (body.blocked.left) {
                    this.basketball.setVelocityX(Math.abs(this.basketball.body.velocity.x));  
                    this.cameras.main.shake(100, 0.002);  
                } else if (body.blocked.right) {
                    this.basketball.setVelocityX(-Math.abs(this.basketball.body.velocity.x)); 
                    this.cameras.main.shake(100, 0.002);  
                }
            }
        }, this);

        this.tweens.add({
            targets: this.clickToPlayText,
            alpha: { start: 1, to: 0 },
            duration: 1000,
            ease: 'Power1',
            yoyo: true,
            repeat: -1
        });
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
            this.makeTimerMeter(newStartAngle, 270, true);

            if (this.timer - this.timeElapsed <= 0) {
                this.timeElapsed = 0;
                this.timerEvent.remove(); 
                this.resetGame(); 
            }
        }
    }

    triggerEffects(x, y, bullet) {
        this.vfx.createEmitter('red', x, y - 5, 1, 0, 500).explode(bullet);
        this.vfx.createEmitter('yellow', x, y, 1, 0, 500).explode(bullet);
        this.vfx.createEmitter('orange', x, y + 5, 1, 0, 500).explode(bullet);
    }

    pointsEffect(x, y, score) {
        let scoreText = this.add.bitmapText(x - 50, y, 'pixelfont', `+${score}`, 50);
        this.tweens.add({
            targets: scoreText,
            y: { from: scoreText.y, to: scoreText.y - 200 }, // Move upwards
            alpha: { from: 1, to: .4 }, // Fade out
            scale: { start: .3, to: 1.5 },
            duration: 1000,
            ease: 'Power2',
            onComplete: function () { scoreText.destroy(); },
            onStart: () => {
                scoreText.setTint(0xffff00);
            },
            yoyo: false,
            repeat: 0,
        });

    }

    findNewBasketPosition() {
        let x, y;
        do {
            x = Phaser.Math.Between(100, this.scale.width - 100);
            y = Phaser.Math.Between(500, this.scale.height - 800);
        } while (Phaser.Math.Distance.Between(this.basketContainer.x, this.basketContainer.y, x, y) < 200);
        return { x, y };
    }

    update() {
        this.basketball.setAngularVelocity(this.basketball.body.velocity.x);

        if (this.basketball.body.touching.down) {
            this.basketballHitGround = false;
        }

        const isOverlapping = Phaser.Geom.Intersects.RectangleToRectangle(
            this.basketball.getBounds(),
            this.scoreZone.getBounds()
        );

        if (!isOverlapping) {
            this.isBasketballInScoreZone = false;
        }

        this.updateBasketComponentsPosition();
    }

    updateBasketComponentsPosition() {
        this.rim1.x = this.basketContainer.x - 60;
        this.rim1.y = this.basketContainer.y - 30;
        this.rim1.body.updateFromGameObject();

        this.rim2.x = this.basketContainer.x + 60;
        this.rim2.y = this.basketContainer.y - 30;
        this.rim2.body.updateFromGameObject();

        this.scoreZone.x = this.basketContainer.x;
        this.scoreZone.y = this.basketContainer.y - 10;
    }

    resetGame() {
        this.isGameOver = true;  
        this.vfx.shakeCamera();  

        if (this.gameWin) {
            // no game wins rn!!
        } else {
            let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 250, 'pixelfont', 'Game Over', 64)
                .setOrigin(0.5)
                .setVisible(false)
                .setAngle(-15)
                .setDepth(10)
                .setTint(0xff0000);

            this.time.delayedCall(500, () => {
                this.sounds.loose.setVolume(0.5).setLoop(false).play();
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
        this.sounds.shoot.setVolume(0.5).setLoop(false).play();
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`${this.score}`);
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
    let width = 320; let height = 50; let x = (this.game.config.width / 2) - 160; let y = (this.game.config.height / 2) - 50;
    const progressBox = this.add.graphics(); progressBox.fillStyle(0x222222, 0.8); progressBox.fillRect(x, y, width, height);

    const loadingText = this.make.text({
        x: this.game.config.width / 2, y: this.game.config.height / 2 + 20,
        text: 'Loading...', style: {
            font: '20px monospace',
            fill: '#ffffff'
        }
    }).setOrigin(0.5, 0.5);
    loadingText.setOrigin(0.5, 0.5);

    const progressBar = this.add.graphics();
    this.load.on('progress', (value) => {
        progressBar.clear();
        progressBar.fillStyle(0x364afe, 1); progressBar.fillRect(x, y, width * value, height);
    });
    this.load.on('fileprogress', function (file) {
    });
    this.load.on('complete', function () {
        progressBar.destroy(); progressBox.destroy(); loadingText.destroy();
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
    orientation: _CONFIG.deviceOrientation === "portrait"
};