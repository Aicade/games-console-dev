// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.score = 0;
        this.lives = 3;

        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for(const key in _CONFIG.libLoader) {
            this.load.script(key, _CONFIG.libLoader[key]);
        }


        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);

    }

    create() {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(1).setLoop(true).play();
        this.lives = 3;
        this.hearts = [];
        for (let i = 0; i < this.lives; i++) {
            let x = 50 + (i * 35);
            this.hearts[i] = this.add.image(x, 50, "heart").setScale(0.025).setDepth(11);
        }


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
        this.startx = 0;
        this.starty = 0;

        this.canShoot = false;
        this.time.delayedCall(500, () => {
            this.canShoot = true
        });

        this.time.addEvent({
            delay: 750,
            callback: this.enhancedEnemySpawn,
            callbackScope: this,
            loop: true,
            args: [this]
        });

        this.enemies = this.physics.add.group({
            allowGravity: false,
        });

        this.sniperScope = this.add.graphics({ fillStyle: { color: 0x000000 } });
        this.sniperScope.setDepth(11);

this.input.on("pointerdown", (pointer) => {
    if (this.isGameOver) return;
    
    // Get all enemies at the pointer position
    const enemiesAtPointer = this.enemies.getChildren().filter(enemy => {
        return enemy.getBounds().contains(pointer.x, pointer.y);
    });

    if (enemiesAtPointer.length > 0) {
        // Player hit an enemy
        const enemy = enemiesAtPointer[0];
        this.sounds.move.setVolume(4).setLoop(false).play();
        
        this.cameras.main.flash(100);
        enemy.body.moves = false;
        
        this.time.delayedCall(400, () => {
            enemy.body.moves = true;
        }, [], this);

        const emitter = this.add.particles(enemy.x, enemy.y, 'bubbles', {
            speed: { min: -100, max: 300 },
            scale: { start: .2, end: 0 },
            blendMode: 'MULTIPLY',
            lifespan: 550,
            tint: 0x93C54B
        });

        emitter.explode(200);

        if (enemy.flipX)
            enemy.angle -= (90 + 45);
        else
            enemy.angle += (90 + 45);
            
        if (enemy.flipTimer) {
            enemy.flipTimer.remove();
        }
        
        enemy.setVelocityX(0);
        enemy.setVelocityY(500);
        this.updateScore(1);
        enemy.removeInteractive();
        
        // Remove the enemy after a delay
        this.time.delayedCall(1000, () => {
            enemy.destroy();
        });
    } else {
        // Player missed
        this.sounds.damage.setVolume(1).setLoop(false).play();
        this.lives -= 1;
        this.updateLives(this.lives);
        this.cameras.main.flash(100);

        let missedText = this.add.bitmapText(
            this.cameras.main.centerX,
            this.cameras.main.centerY, 
            'pixelfont', 
            'MISS',
            64
        )
        .setOrigin(0.5, 0.5)
        .setDepth(11)
        .setTint(0xff0000);

        this.tweens.add({
            targets: missedText,
            scaleX: 2,
            scaleY: 2,
            alpha: 1,
            duration: 500,
            angle: Phaser.Math.Between(-10, 10),
            onComplete: () => {
                missedText.destroy();
            }
        });
    }
}, this);

        let bubble = this.add.graphics({ x: -100, y: 0, add: false });

        // Define the bubble's properties
        const bubbleRadius = 20;
        const bubbleColor = 0xEF6C8B; // A nice bubble color

        // Draw the bubble
        bubble.fillStyle(bubbleColor, 1); // Semi-transparent
        bubble.fillCircle(bubbleRadius, bubbleRadius, bubbleRadius);
        bubble.generateTexture('bubbles', 100, 100);
        this.input.keyboard.disableGlobalCapture();

    }

    resetGame() {
        this.isGameOver = true;
        this.physics.pause();
        // this.player.destroy();
        this.score = 0;
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
    }

    update(time, delta) {
        let worldPoint = this.cameras.main.getWorldPoint(this.input.x, this.input.y);
        // this.drawSniperScope(worldPoint.x, worldPoint.y);

        if (this.lives == 0 && !this.isGameOver) { this.resetGame(); }

    }
    // drawSniperScope(x, y) {
    //     this.sniperScope.clear();
    //     const scopeRadius = 50;

    //     this.sniperScope.beginPath();
    //     this.sniperScope.fillStyle(0xffffff, .1);
    //     this.sniperScope.fillCircle(x, y, scopeRadius);
    //     this.sniperScope.closePath();

    //     this.sniperScope.lineStyle(2, 0xffffff, 1);
    //     this.sniperScope.beginPath();
    //     this.sniperScope.moveTo(x, y - scopeRadius);
    //     this.sniperScope.lineTo(x, y + scopeRadius);
    //     this.sniperScope.moveTo(x - scopeRadius, y);
    //     this.sniperScope.lineTo(x + scopeRadius, y);
    //     this.sniperScope.strokePath();
    // }

    enhancedEnemySpawn() {
        if (!this.isGameOver) {
            let spawnFromLeft = Math.random() < 0.5;
            let spawnX = Phaser.Math.Between(0, this.game.config.width);
            let spawnY = this.game.config.height;
            let velocityX = spawnFromLeft ? 200 : -200;

            var enemy = this.enemies.create(spawnX, spawnY, 'enemy').setScale(.3);
            enemy.flipX = spawnFromLeft ? false : true;
            enemy.setInteractive();

            let originalWidth = enemy.width;
            let originalHeight = enemy.height;
            let newWidth = originalWidth * 0.4;
            let newHeight = originalHeight * 0.5;
            enemy.body.setSize(newWidth, newHeight);

            enemy.on("pointerdown", function () {
                if (!this.isGameOver) {
                    this.sounds.move.setVolume(4).setLoop(false).play()

                    this.cameras.main.flash(100);
                    enemy.body.moves = false;
                    this.time.delayedCall(400, () => {
                        enemy.body.moves = true;
                    }, [], this);

                    const emitter = this.add.particles(enemy.x, enemy.y, 'bubbles', {
                        speed: { min: -100, max: 300 },
                        scale: { start: .2, end: 0 },
                        blendMode: 'MULTIPLY',
                        lifespan: 550,
                        tint: 0x93C54B
                    });

                    emitter.explode(200);

                    if (enemy.flipX)
                        enemy.angle -= (90 + 45);
                    else
                        enemy.angle += (90 + 45);
                    enemy.flipTimer.remove();
                    enemy.setVelocityX(0);
                    enemy.setVelocityY(500);
                    this.updateScore(1);
                    enemy.removeInteractive();
                }
            }, this);

            enemy.setVelocityX(velocityX);
            enemy.setVelocityY(-100);

            let rand = Phaser.Math.Between(1000, 3000);

            enemy.flipTimer = this.time.addEvent({
                delay: rand,
                callback: this.flip,
                callbackScope: this,
                loop: false,
                args: [enemy, velocityX, enemy.flipX]
            });
        }
    }

    flip(enemy, velX, flipX) {
        enemy.setVelocityX(-velX);
        enemy.flipX = !flipX;
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    updateLives(lives) {
        this.hearts[this.lives].destroy();
        this.lives = lives;
        // this.updateLivesText();
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
    orientation: _CONFIG.deviceOrientation === "landscape"
};