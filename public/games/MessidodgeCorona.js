
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


        this.load.image('heart', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png');
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        addEventListenersPhaser.bind(this)();

        displayProgressLoader.call(this)
    }

    create() {
        this.vfx = new VFXLibrary(this);
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.score = 0;
        this.level = 0;
        this.playerSpeed = 400;
        this.playerSpeedOnTouch = this.playerSpeed * 2;

        this.maxEnemySpeed = 1000;
        this.enemySpeed = 100;
        this.enemySpeedInc = 40;

        this.maxEnemies = 15;
        this.minSpawnerInterval = 100;
        this.enemySpawnTimeInteval = 500;

        this.pointerDown = false;
        this.px = 0;
        this.py = 0;

        this.level = 0;
        this.levelScoreThreshold = 100;

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }


        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0);
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale)

        this.sounds.background.setVolume(3).setLoop(true).play();

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 10, 'pixelfont', 'Score: 0', 35).setDepth(11).setTint(0xffa500).setOrigin(0.5, 0);
        this.levelText = this.add.bitmapText(20, 20, 'pixelfont', 'Level: 0', 28).setDepth(11);
        this.levelUpText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', 'LEVEL UP', 50).setOrigin(0.5, 0.5).setAlpha(0).setDepth(11);

        this.lives = 3;
        this.hearts = [];
        for (let i = 0; i < this.lives; i++) {
            let x = 40 + (i * 35);
            this.hearts[i] = this.add.image(x, 100, "heart").setScale(0.025).setDepth(11);
        }

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.game.config.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.cursor = this.input.keyboard.createCursorKeys();

        this.player = this.physics.add.sprite(this.game.config.width / 2, this.game.config.height / 2, 'player');
        this.player.setScale(0.15).setDepth(11);
        this.player.body.setSize(this.player.body.width / 1.5, this.player.body.height / 1.5);
        this.player.setCollideWorldBounds(true);

        this.particleEmitter = this.vfx.createEmitter('avoidable', 0, 0, 0.02, 0, 600).setAlpha(0.5);
        this.whiteParticle = this.vfx.addCircleTexture('whiteCircle', 0xffffff, 1, 8);
        this.followEmitter = this.vfx.createEmitter('whiteCircle', 0, 0, 1, 0, 600).setAlpha(0.8);
        this.followEmitter.startFollow(this.player);
        this.playerParticleEmitter = this.vfx.createEmitter('player', 0, 0, 0.03, 0, 1000).setAlpha(0.5);

        this.enemies1 = this.physics.add.group();

        this.enemyTimer = this.time.addEvent({ delay: this.enemySpawnTimeInteval, callback: this.spawnEnemy, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 1000, callback: this.incrementScoreAndLevel, callbackScope: this, loop: true });

        // Enable touch input for moving the player
        this.input.on('pointerdown', () => {
            this.pointerDown = true;
        });

        // Stop the player when the touch is released
        this.input.on('pointerup', () => {
            this.pointerDown = false;
        });
        this.input.keyboard.disableGlobalCapture();

    }

    update(time, delta) {
        if (this.gameOverFlag) return;
        this.player.setVelocity(0);

        this.followEmitter.stop();
        if (this.cursor.left.isDown) {
            this.followEmitter.start();
            this.player.setVelocityX(-this.playerSpeed);
        } else if (this.cursor.right.isDown) {
            this.followEmitter.start();
            this.player.setVelocityX(this.playerSpeed);
        }

        if (this.cursor.up.isDown) {
            this.followEmitter.start();
            this.player.setVelocityY(-this.playerSpeed);
        } else if (this.cursor.down.isDown) {
            this.followEmitter.start();
            this.player.setVelocityY(this.playerSpeed);
        }


        if (this.pointerDown && !this.player.body.hitTest(this.input.x, this.input.y)) {
            this.physics.moveTo(this.player, this.input.x, this.input.y, this.playerSpeedOnTouch);
        }
        this.physics.world.collide(this.player, this.enemies1, this.playerHit, null, this);

    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateLevel(lvl = 1) {
        this.level = lvl;
        this.updateLevelText();
    }


    incrementScoreAndLevel() {
        let oldLevel = this.level;
        this.updateScore(10);
        this.level = Math.floor(this.score / this.levelScoreThreshold);
        this.updateLevel(this.level);
        if (oldLevel < this.level) {

            if (this.gameOverFlag) return;
            this.vfx.blinkEffect(this.levelUpText, 400, 3);
            this.sounds.success.setVolume(0.7).setLoop(false).play()
            if (this.enemySpawnTimeInteval > this.minSpawnerInterval && !(this.level % 3)) {
                this.enemySpawnTimeInteval -= 20;
            }
            if (this.enemySpeed < this.maxEnemySpeed) {
                this.enemySpeed += this.enemySpeedInc;
            }
            if (!(this.level % 3)) {
                this.maxEnemies -= 1;
            }
            this.time.removeEvent(this.enemyTimer);
            this.enemyTimer = this.time.addEvent({ delay: this.enemySpawnTimeInteval, callback: this.spawnEnemy, callbackScope: this, loop: true });
        }
    }

    spawnEnemy() {
        if (this.enemies1.getChildren().length > this.maxEnemies) {
            this.enemies1.remove(this.enemies1.getChildren()[0], true, true);
        }
        let enemy;
        let x, y, tox, toy;
        let randu = Phaser.Math.Between(0, 3);

        if (randu === 0) {
            x = Phaser.Math.Between(0, this.game.config.width - 20);
            y = 0;
        } else if (randu === 1) {
            x = Phaser.Math.Between(0, this.game.config.width - 20);
            y = this.game.config.height;
        } else if (randu === 2) {
            x = 0;
            y = Phaser.Math.Between(0, this.game.config.height - 20);
        } else {
            x = this.game.config.width;
            y = Phaser.Math.Between(0, this.game.config.height - 20);
        }

        tox = Phaser.Math.Between(0, this.game.config.width);
        toy = Phaser.Math.Between(0, this.game.config.height);

        enemy = this.enemies1.create(x, y, 'avoidable');
        enemy.setScale(0.14);
        enemy.body.setSize(enemy.body.width / 1.5, enemy.body.height / 1.5);
        this.physics.moveTo(enemy, tox, toy, this.enemySpeed);
        (Math.random() < 0.5) ? -50 : 50
        enemy.setAngularVelocity((Math.random() < 0.5) ? -80 : 80)
        this.tweens.add({
            targets: enemy,
            scale: enemy.scale + 0.02,
            duration: 600,
            yoyo: true,
            loop: -1,
            ease: 'sine.inout'
        });

    }

    playerHit(player, enemy) {
        this.lives--;
        if (this.lives > 0) {
            this.sounds.damage.setVolume(0.7).setLoop(false).play()
            this.particleEmitter.explode(100, enemy.x, enemy.y)
            enemy.destroy();
            this.hearts[this.lives].destroy();
            this.vfx.shakeCamera(200, 0.01);
        } else {
            this.gameOverFlag = true;
            this.hearts[this.lives].destroy();
            this.followEmitter.stop();
            this.physics.pause();
            this.sound.stopAll();
            this.player.setTint(0xff0000);

            this.time.delayedCall(1000, () => {

                this.playerParticleEmitter.explode(400, player.x, player.y);
                this.sounds.loose.setVolume(0.7).setLoop(false).play()
                this.vfx.shakeCamera(300, 0.04);
                this.player.destroy();
                this.time.delayedCall(2000, () => {
                    this.gameOver();
                });

            });

        }
        this.vfx.rotateGameObject(this.player, 400)
    }

    updateScoreText() {
        this.scoreText.setText(`Score: ${this.score}`);
    }

    updateLevelText() {
        this.levelText.setText(`Level: ${this.level}`);
    }

    gameOver() {
        this.enemyTimer.destroy();
        initiateGameOver.bind(this)({
            score: this.score
        })
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
            gravity: { y: 0 },
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
