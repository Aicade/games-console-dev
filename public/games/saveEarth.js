/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/
class SliceEffect {
    constructor(scene) {
        this.scene = scene;
        this.lines = [];
        this.maxLifetime = 100;
    }

    addSlice(x1, y1, x2, y2) {
        let line = new Phaser.Geom.Line(x1, y1, x2, y2);
        let graphics = this.scene.add.graphics({ lineStyle: { width: 4, color: 0xffffff } });
        graphics.strokeLineShape(line);
        this.lines.push({ graphics, createdAt: this.scene.time.now });

        // Automatically fade and destroy old lines
        this.scene.time.delayedCall(this.maxLifetime, () => {
            graphics.clear();
            graphics.destroy();
        }, [], this);

    }

    update(x, y) {
        if (this.scene.pointerDown) {
            this.emitter.emitParticleAt(x, y);
        }
    }
}

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

        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        addEventListenersPhaser.bind(this)();

        displayProgressLoader.call(this)
    }

    create() {
        this.sliceEffect = new SliceEffect(this); this.vfx = new VFXLibrary(this);
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.score = 0;
        this.level = 0;

        this.maxEnemySpeed = 1500;
        this.enemySpeed = 450;
        this.enemySpeedInc = 80;

        this.maxEnemies = 15;
        this.minSpawnerInterval = 500;
        this.enemySpawnTimeInteval = 1000;
        this.level = 0;
        this.levelScoreThreshold = 100;

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0);
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale)

        this.sounds.background.setVolume(4).setLoop(true).play();

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 10, 'pixelfont', 'Score: 0', 35).setDepth(11).setTint(0xffa500).setOrigin(0.5, 0);
        this.levelText = this.add.bitmapText(20, 20, 'pixelfont', 'Level: 0', 28).setDepth(11);
        this.levelUpText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', 'LEVEL UP', 50).setOrigin(0.5, 0.5).setAlpha(0).setDepth(11);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.game.config.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.player = this.physics.add.sprite(this.width / 2, this.height / 2, 'player');
        this.player.health = 100;
        this.player.setScale(0.3).setDepth(11);
        this.player.body.setSize(this.player.body.width / 1.5, this.player.body.height / 1.5);
        this.player.setCollideWorldBounds(true).setImmovable(true);
        this.player.setAngularVelocity(20);

        this.makeHealthMeter();

        this.particleEmitter = this.vfx.createEmitter('avoidable', 0, 0, 0.02, 0, 600).setAlpha(0.5);
        this.playerParticleEmitter = this.vfx.createEmitter('player', 0, 0, 0.03, 0, 1000).setAlpha(0.5);

        this.enemies = this.physics.add.group();

        this.enemyTimer = this.time.addEvent({ delay: this.enemySpawnTimeInteval, callback: this.spawnEnemy, callbackScope: this, loop: true });

        this.physics.add.collider(this.player, this.enemies, (player, enemy) => {
            enemy.destroy();
            this.playerHit(player, enemy);
        });

        this.input.keyboard.disableGlobalCapture();

    }

    update() {
        // this.sliceEffect.addSlice(this.input.x, this.input.y, this.input.activePointer.prevPosition.x, this.input.activePointer.prevPosition.y);

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
            this.vfx.blinkEffect(this.levelUpText, 400, 3);
            this.sounds.success.setVolume(0.7).setLoop(false).play()
            if (this.enemySpawnTimeInteval > this.minSpawnerInterval && !(this.level % 3)) {
                this.enemySpawnTimeInteval -= 40;
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
        if (this.enemies.getChildren().length > this.maxEnemies) {
            this.enemies.remove(this.enemies.getChildren()[0], true, true);
        }
        let enemy;
        let x, y;
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
        enemy = this.enemies.create(x, y, 'avoidable');

        enemy.setScale(0.27);

        enemy.flamesParticle = this.vfx.addCircleTexture('flames', 0xffa500, 1, 6);
        enemy.followEmitter = this.vfx.createEmitter('flames', 0, 0, 1, 0, 500).setAlpha(0.8);
        enemy.followEmitter.startFollow(enemy).start();
        enemy.setDepth(11);
        enemy.setAngularVelocity((Math.random() < 0.5) ? -200 : 200)

        enemy.body.setSize(enemy.body.width / 1.5, enemy.body.height / 1.5);
        this.physics.moveTo(enemy, this.player.x, this.player.y, this.enemySpeed);
        enemy.setInteractive({ cursor: "pointer" })
        enemy.on('pointerdown', () => {
            this.sounds.shoot.play();
            this.particleEmitter.explode(100, enemy.x, enemy.y);
            this.incrementScoreAndLevel();
            enemy.destroy();
            enemy.followEmitter.stop().destroy();
        });

    }

    playerHit(player, enemy) {
        this.player.health -= 10;

        if (this.player.health <= 30) {
            this.healthMeter.fillColor = 0xff0000;
        }
        this.healthMeter.width = this.healthMeter.width - 15;

        enemy.destroy();
        enemy.followEmitter.stop().destroy();

        if (this.player.health > 0) {
            this.sounds.damage.play();
            this.particleEmitter.explode(100, enemy.x, enemy.y);
            this.vfx.shakeCamera(200, 0.01);
        } else {
            this.enemyTimer.destroy();
            this.physics.pause();
            this.sound.stopAll();
            this.player.setTint(0xff0000);

            this.time.delayedCall(1000, () => {
                this.playerParticleEmitter.explode(400, player.x, player.y);
                this.sounds.loose.play();
                this.vfx.shakeCamera(300, 0.04);
                this.player.destroy();
                this.time.delayedCall(2000, () => {
                    this.gameOver();
                });
            });
        }
    }

    makeHealthMeter(x = this.width / 2, y = this.player.y - 100, width = 150, height = 15) {
        this.healthMeterBg = this.add.rectangle(x, y, width, height, 0x888888);
        this.healthMeter = this.add.rectangle(x, y, width, height, 0x00ff00);
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
