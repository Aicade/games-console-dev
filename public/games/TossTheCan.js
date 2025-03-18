// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
    }

    preload() {
        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.image('heart', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png');
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');

        displayProgressLoader.call(this);
    }

    create() {
        this.vfx = new VFXLibrary(this);
        this.difficulty = 1;
        this.difficultyDelay = 5000;
        this.spawnTimeDelay = 1500 * this.difficulty;
        this.startDelay = 2000;

        // Make an empty object for all #sounds
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.width = this.game.config.width;
        this.height = this.game.config.height;

        this.lives = 10;
        this.heart = this.add.image(30, 62, "heart").setScale(0.025).setDepth(11);
        this.livesText = this.add.bitmapText(45, 30, 'pixelfont', 'x ' + this.lives, 28).setOrigin(0).setDepth(11);

        this.gameSceneBackground();

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 20, 'pixelfont', 'Score: 0', 35).setOrigin(0.5, 0).setTint(0xff9900).setDepth(11);
        this.gameOverText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'GAME OVER!', 55).setOrigin(0.5, 0.5).setTint(0xff0000).setDepth(11);
        this.gameOverText.visible = false;

        this.instructionText = this.add.bitmapText(
            this.width / 2, 
            this.height / 2, 
            'pixelfont', 
            'Tap on Projectile to Land it', 
            40
        ).setOrigin(0.5, 0.5).setTint(0xffffff).setDepth(11);
        
        // Make it fade out after 7 seconds
        this.tweens.add({
            targets: this.instructionText,
            alpha: 0,
            duration: 7000,
            onComplete: () => {
                this.instructionText.destroy();
            }
        });

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        const pauseButton = this.add.sprite(this.game.config.width * 0.9, this.game.config.height * 0.1, "pauseButton").setOrigin(0.5, 0.5).setScale(2);
        pauseButton.setInteractive({ cursor: 'pointer' });
        pauseButton.on('pointerdown', () => this.pauseGame());
        this.score = 0;
        this.missed = 0;

        this.landingTarget = this.physics.add.staticSprite(this.width - 200, this.height, 'platform')
            .setScale(0.6).setOrigin(0.5, 1).refreshBody();
        this.landingTarget.preFX.addShine(0.7);
        this.landingTarget.body.setSize(this.landingTarget.body.width / 1.5, this.landingTarget.body.height / 1.5);


        this.projectiles = this.physics.add.group({});
        // this.projectiles.setCollideWorldBounds(true);

        this.physics.add.collider(this.projectiles, this.projectiles);
        this.physics.add.collider(this.projectiles, this.landingTarget, this.projectileLanding, null, this);

        this.sounds.background.setVolume(3).setLoop(true).play();

        this.input.keyboard.disableGlobalCapture();

    }

    spawnProjectile() {
        for (var i = 0; i < 1; i++) {
            const projectile = this.projectiles.create(0, Phaser.Math.Between(this.height - 150, this.height / 2 - 150), 'projectile');
            projectile.setScale(0.35);
            projectile.body.setSize(projectile.body.width, projectile.body.height);
            projectile.setVelocity(Phaser.Math.Between(100, 150), Phaser.Math.Between(-250, -300));
            projectile.setAngularVelocity(900).setBounce(0.5);

            projectile.setInteractive();

            projectile.on("pointerdown", () => {
                this.sounds.jump.play();
                
                // Store initial speed value to avoid referencing issues
                const initialSpeed = projectile.body ? projectile.body.speed : 200;
                
                projectile.emitter = this.add.particles(0, 0, 'projectile', {
                    frequency: 2,
                    speed: 200,
                    lifespan: 300,
                    alpha: {
                        // Use a safer approach with a fixed value or the stored initial speed
                        onEmit: () => {
                            // Check if projectile and body still exist
                            if (projectile && projectile.body) {
                                return Phaser.Math.Percent(projectile.body.speed, 0, 300) * 1000;
                            }
                            // Fallback to a default value if projectile or body is undefined
                            return Phaser.Math.Percent(initialSpeed, 0, 300) * 1000;
                        }
                    },
                    scale: { start: 0.015, end: 0 },
                    blendMode: 'ADD',
                });
                
                if (projectile.active) {
                    projectile.emitter.startFollow(projectile);
                    this.time.delayedCall(300, () => {
                        if (projectile.emitter && projectile.emitter.active) {
                            projectile.emitter.stop();
                        }
                    });
                    
                    projectile.setVelocityY(-250);
                }
            }, this);
        }
    }

    projectileLanding(target, projectile) {
        if (projectile.body.touching.down && target.body.touching.up) {
            this.updateScore(10);
            this.scorePointAnim();
            
            // Make sure to stop and destroy the emitter if it exists before destroying the projectile
            if (projectile.emitter) {
                projectile.emitter.stop();
                projectile.emitter.destroy();
            }
            
            projectile.destroy();
            this.sounds.collect.play();
        } else {
            projectile.setAngularVelocity(60);
            this.updateLives(1);
            this.sounds.damage.play();
        }
    }

    update() {
        if (this.projectiles.getChildren().length) {
            this.projectiles.children.iterate((p) => {
                if (p == undefined) return;

                if (p.x > this.width || p.y > this.height) {
                    // Make sure to stop and destroy the emitter if it exists before destroying the projectile
                    if (p.emitter) {
                        p.emitter.stop();
                        p.emitter.destroy();
                    }
                    
                    p.destroy();

                    this.sounds.damage.play();
                    this.updateLives(1);
                    this.shakeTarget();
                }
            });
        }

        if (this.time.now > this.spawnTimeDelay && this.time.now > this.startDelay) {
            this.spawnProjectile();
            this.spawnTimeDelay = this.time.now + (2500 * this.difficulty);
        }

        if (this.time.now > this.difficultyDelay && this.difficulty > 0.1) {
            this.difficulty -= 0.02;
            this.difficultyDelay = this.time.now + 10000;
        }
    }

    shakeTarget() {
        this.tweens.add({
            targets: this.landingTarget,
            x: this.landingTarget.x + 10,
            yoyo: true,
            repeat: 2,
            duration: 50
        });
    }

    shakeTarget() {
        this.tweens.add({
            targets: this.landingTarget,
            x: this.landingTarget.x + 10,
            yoyo: true,
            repeat: 2,
            duration: 50
        });
    }

    scorePointAnim() {
        let dx = this.landingTarget.x - 50;
        let dy = this.game.config.height - this.landingTarget.displayHeight;
        let scoreText = this.add.bitmapText(dx, dy, 'pixelfont', '+10', 45).setTint(0xff9900);

        this.tweens.add({
            targets: scoreText,
            y: dy - 100,
            duration: 800,
            ease: 'Power1',
            onComplete: function () {
                scoreText.destroy();
            }
        });
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`Score: ${this.score}`);
    }

    updateLives(misses) {
        this.lives -= misses;
        this.updateLivesText();
        if (this.lives < 4) {
            this.vfx.blinkEffect(this.livesText, 200, 2);
            this.time.delayedCall(1000, () => {
                this.livesText.setAlpha(1);
            })
        }
        if (this.lives < 1) {
            this.physics.pause();
            // this.projectiles.destroy();
            this.gameOverText.visible = true;
            this.sounds.lose.play();
            this.time.delayedCall(2000, () => {
                this.gameOver();
            })
        }
    }

    updateLivesText() {
        this.livesText.setText(`x ${this.lives}`);
    }

    gameOver() {
        initiateGameOver.bind(this)({
            "score": this.score,
        });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }

    gameSceneBackground() {
        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);
        const scale = Math.max(this.width / this.bg.displayWidth, this.height / this.bg.displayHeight);
        this.bg.setScale(scale);
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
            gravity: { y: 200 },
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