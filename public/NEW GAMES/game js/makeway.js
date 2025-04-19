const isMobile = /Mobi|Android/i.test(navigator.userAgent);
_CONFIG.deviceOrientation = isMobile ? 'portrait' : 'landscape';

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.scoreAccumulator = 0; // Accumulator for fractional score increments
    }

    preload() {
        this.score = 0;
        this.lives = 3;

        // Load In-Game Assets from assetsLoader
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image('heart', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png');
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        addEventListenersPhaser.bind(this)();
        displayProgressLoader.call(this);
    }

    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        this.vfx = new VFXLibrary(this);
        // Debug: Verify VFXLibrary methods
        console.log('VFXLibrary methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.vfx)));

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', 'Score: 0', 40).setOrigin(0.5).setDepth(11);
        this.gameOverText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'GAME OVER!', 60).setOrigin(0.5).setDepth(11).setTint(0xff0000).setAlpha(0);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.game.config.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());
        
        this.hearts = [];
        for (let i = 0; i < this.lives; i++) {
            let x = 50 + (i * 35);
            this.hearts[i] = this.add.image(x, 60, "heart").setScale(0.025).setDepth(11);
        }

        gameSceneCreate(this);
        this.input.keyboard.disableGlobalCapture();

        this.targetVelocityX = 0;
        this.currentVelocityX = 0;
        this.isAccelerating = false;
        this.maxPlayerSpeed = 800; // Maximum forward speed limit
        this.speedIncrement = 100; // Forward speed increase per interval
        this.backwardSpeed = 150; // Fixed backward speed
        this.laneChangeSpeed = 300; // Fixed speed for up/down movement
        this.lastSpeedIncreaseTime = 0;

        // Initialize smoke trail using existing VFXLibrary methods
        if (typeof this.vfx.addCircleTexture === 'function' && typeof this.vfx.createEmitter === 'function') {
            // Create smaller dark grey circle texture for smoke
            this.vfx.addCircleTexture('smokeParticle', 0x333333, 0.7, 20); // Smaller radius (20px)
            // Create particle emitter for smoke with compact config
            this.smokeEmitter = this.vfx.createEmitter(
                'smokeParticle',
                this.player.x,
                this.player.y,
                0.15, // Smaller scaleStart
                0.3,  // Smaller scaleEnd
                200,  // Shorter lifespan for tighter area
                {
                    speed: { min: 30, max: 60 }, // Slower speed for compact effect
                    anglePlanned: { min: 160, max: 200 }, // Emit mostly backward
                    alpha: { start: 0.7, end: 0 }, // Fade out
                    frequency: 80, // Emit every 80ms for denser effect
                    blendMode: 'NORMAL',
                    emitting: false
                }
            );
            this.smokeEmitter.setDepth(10); // Ensure smoke is behind the player
        } else {
            console.error('Required VFXLibrary methods (addCircleTexture or createEmitter) are missing.');
        }
    }

    update(time, delta) {
        // Handle vertical movement (lane changes)
        this.laneChangeSpeed = 300; // Safeguard to prevent overwrite
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-this.laneChangeSpeed); // Use laneChangeSpeed
            // Tilt car upward (front up)
            this.tweens.add({
                targets: this.player,
                angle: -10, // Subtle upward tilt
                duration: 200,
                ease: 'Linear'
            });
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(this.laneChangeSpeed); // Use laneChangeSpeed
            // Tilt car downward (front down)
            this.tweens.add({
                targets: this.player,
                angle: 10, // Subtle downward tilt
                duration: 200,
                ease: 'Linear'
            });
        } else {
            this.player.setVelocityY(0);
            // Return car to straight position
            this.tweens.add({
                targets: this.player,
                angle: 0, // Back to straight
                duration: 200,
                ease: 'Linear'
            });
        }

        // Handle horizontal movement with acceleration
        if (this.cursors.right.isDown && !this.cursors.left.isDown) {
            // Increase playerSpeed over time (forward only)
            if (time > this.lastSpeedIncreaseTime + 500) { // Increase every 0.5 seconds
                this.playerSpeed = Math.min(this.playerSpeed + this.speedIncrement, this.maxPlayerSpeed);
                this.lastSpeedIncreaseTime = time;
            }
            if (this.targetVelocityX < 0) {
                // Moving backward, need to stop first
                this.stopCar(500, () => {
                    this.accelerateCar(this.playerSpeed, 800);
                });
            } else if (this.targetVelocityX === 0 && !this.isAccelerating) {
                // Stopped, accelerate forward
                this.accelerateCar(this.playerSpeed, 800);
            } else if (this.targetVelocityX > 0 && !this.isAccelerating) {
                // Already moving forward, adjust to new speed
                this.accelerateCar(this.playerSpeed, 500);
            }
        } else if (this.cursors.left.isDown && !this.cursors.right.isDown) {
            if (this.targetVelocityX > 0) {
                // Moving forward, need to stop first
                this.stopCar(1000, () => {
                    this.accelerateCar(-this.backwardSpeed, 500); // Use backwardSpeed
                });
            } else if (this.targetVelocityX === 0 && !this.isAccelerating) {
                // Stopped, accelerate backward
                this.accelerateCar(-this.backwardSpeed, 500); // Use backwardSpeed
            }
        } else if (!this.cursors.left.isDown && !this.cursors.right.isDown && this.targetVelocityX !== 0) {
            // No keys pressed, decelerate to stop
            this.stopCar(1000);
        }

        // Apply current velocity
        this.player.setVelocityX(this.currentVelocityX);

        // Update score based on forward movement
        if (this.currentVelocityX > 0) {
            // Calculate score increment based on velocity and delta time
            // Max speed (800) should give ~50 points per second
            const scoreRate = (this.currentVelocityX / this.maxPlayerSpeed) * 50 / 1000; // Points per millisecond
            this.scoreAccumulator += scoreRate * delta;
            while (this.scoreAccumulator >= 1) {
                this.updateScore(1);
                this.scoreAccumulator -= 1;
            }
        }

        // Dynamic background speed based on car movement
        this.background.tilePositionX += this.currentVelocityX * 0.02; // Background movement

        // Update enemy positions with dynamic speed
        let enemySpeed = 5 - (this.currentVelocityX * 0.01); // Adjust enemy speed relative to player
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.isSpinning) {
                // Spinning enemies move vertically based on their set velocity
                enemy.x += enemySpeed; // Maintain horizontal movement
                enemy.y += enemy.spinVelocityY * (delta / 1000); // Apply vertical velocity, adjusted for delta time
                // Destroy if off-screen (top or bottom)
                if (enemy.y < -50 || enemy.y > this.height + 50) {
                    enemy.destroy();
                }
            } else {
                // Normal enemies move horizontally
                enemy.x += enemySpeed;
                if (enemy.x > this.width + 50 || enemy.x < -50) enemy.destroy();
            }
        });

        // Update bomb positions to match background speed exactly
        let bombSpeed = this.currentVelocityX * 0.02; // Same speed as background
        this.bombs.getChildren().forEach(bomb => {
            bomb.x -= bombSpeed; // Update position to match background movement
            if (bomb.x < -50 || bomb.x > this.width + 50) bomb.destroy(); // Destroy if off-screen
        });

        // Update smoke emitter position and state
        if (this.smokeEmitter) {
            // Position the emitter behind the rear tyre, a little down and more to the left
            const angleRad = Phaser.Math.DegToRad(this.player.angle);
            const baseOffsetX = -Math.cos(angleRad) * 80; // Slightly further back
            const baseOffsetY = -Math.sin(angleRad) * 65;
            const extraOffsetX = -5; // Additional leftward shift
            const extraOffsetY = 20; // Downward shift
            this.smokeEmitter.x = this.player.x + baseOffsetX + extraOffsetX;
            this.smokeEmitter.y = this.player.y + baseOffsetY + extraOffsetY;
            // Enable/disable emitting based on forward movement
            if (this.currentVelocityX > 0) {
                this.smokeEmitter.start();
            } else {
                this.smokeEmitter.stop();
            }
        }

        // Keep player within custom bounds
        const customRightBoundary = 400;
        this.player.x = Phaser.Math.Clamp(this.player.x, 0, customRightBoundary);
        this.player.y = Phaser.Math.Clamp(this.player.y, 0, this.height);
    }

    accelerateCar(targetVelocity, duration) {
        if (this.isAccelerating) return;
        this.isAccelerating = true;
        this.targetVelocityX = targetVelocity;
        this.tweens.add({
            targets: this,
            currentVelocityX: targetVelocity,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                this.isAccelerating = false;
            }
        });
    }

    stopCar(duration, onComplete = null) {
        if (this.isAccelerating) return;
        this.isAccelerating = true;
        this.targetVelocityX = 0;
        this.tweens.add({
            targets: this,
            currentVelocityX: 0,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                this.isAccelerating = false;
                if (onComplete) onComplete();
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

    gameOver() {
        this.sound.stopAll();
        this.hearts.forEach(heart => {
            if (heart && heart.visible) {
                this.tweens.add({
                    targets: heart,
                    alpha: 0,
                    duration: 500,
                    ease: 'Linear'
                });
            }
        });
        this.sounds.lose.setVolume(0.5).setLoop(false).play();
        this.timerEvent?.destroy();
        this.gameOverText.setAlpha(1);
        this.vfx.blinkEffect(this.gameOverText, 400, 3);
        this.vfx.shakeCamera(300, 0.04);
        this.time.delayedCall(2500, () => {
            initiateGameOver.bind(this)({ score: this.score });
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

function gameSceneCreate(game) {
    game.sounds.background.setVolume(0.3).setLoop(true).play();
    game.speed = 5; // Speed for enemies and bombs
    game.playerSpeed = 300; // Initial player movement speed (forward)
    game.lane = 1;
    game.lanes = [100, 300, 500, 700];

    // Add background with adjusted size
    game.background = game.add.tileSprite(game.width / 2, game.height / 2, game.width * 1.5, game.height * 1.5, 'background').setScrollFactor(0);
    game.background.setOrigin(0.5);
    game.background.setScale(0.8); // Scale down to fit screen

    // Add player with adjusted size
    game.player = game.physics.add.sprite(200, game.height / 2, 'player').setScale(0.2);
    game.player.setCollideWorldBounds(true);
    game.cursors = game.input.keyboard.createCursorKeys();

    // Add enemy and bomb groups
    game.enemies = game.physics.add.group();
    game.bombs = game.physics.add.group();

    // Collision handling
    game.physics.add.collider(game.player, game.enemies, hitEnemy, null, game);
    game.physics.add.collider(game.player, game.bombs, hitBomb, null, game);

    // Spawn enemies and bombs
    game.time.addEvent({
        delay: 2000,
        callback: spawnEnemy,
        callbackScope: game,
        loop: true
    });

    game.time.addEvent({
        delay: 3000,
        callback: spawnBomb,
        callbackScope: game,
        loop: true
    });
}

function spawnEnemy() {
    const laneIdx = Phaser.Math.Between(0, 3);
    const spawnX = Phaser.Math.Between(this.width / 2, this.width); // Spawn between middle and right side
    const enemy = this.enemies.create(spawnX, this.lanes[laneIdx], 'enemy').setScale(0.5);
    enemy.isSpinning = false; // Initialize spinning state
    enemy.spinVelocityY = 0; // Initialize vertical velocity
}

function spawnBomb() {
    const laneIdx = Phaser.Math.Between(0, 3);
    const bomb = this.bombs.create(this.width + 50, this.lanes[laneIdx], 'bomb').setScale(0.2);
    // No velocity needed; position update handled in update loop
}

function hitEnemy(player, enemy) {
    this.speed = Math.max(2, this.speed - 1);
    this.sounds.damage.setVolume(0.5).setLoop(false).play();
    
    // Mark enemy as spinning
    enemy.isSpinning = true;
    
    // Randomly choose to spin upward or downward
    const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1; // -1 for up, 1 for down
    enemy.spinVelocityY = direction * 300; // Set vertical velocity (300 pixels/second)

    // Apply spinning animation
    this.tweens.add({
        targets: enemy,
        angle: 360, // Full rotation
        duration: 500, // Spin duration for one rotation
        ease: 'Linear',
        repeat: -1 // Repeat indefinitely until off-screen
    });
}

function hitBomb(player, bomb) {
    this.lives--;
    let heart = this.hearts[this.lives];
    this.tweens.add({
        targets: heart,
        y: heart.y - 20,
        alpha: 0,
        duration: 500,
        ease: 'Linear',
        onComplete: () => heart.destroy()
    });

    if (this.lives > 0) {
        this.sounds.damage.setVolume(0.5).setLoop(false).play();
        this.vfx.shakeCamera(100, 0.01);
        bomb.destroy();
    } else {
        this.gameOver();
    }
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