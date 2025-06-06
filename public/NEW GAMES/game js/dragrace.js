const isMobile = /Mobi|Android/i.test(navigator.userAgent);
_CONFIG.deviceOrientation = isMobile ? 'portrait' : 'landscape';

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.distance = 0;

        // Load assets from config
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for (const key in _CONFIG.atlasLoader) {
        const atlas = _CONFIG.atlasLoader[key];
        this.load.atlas(key, atlas.textureURL, atlas.atlasURL);
    }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        


        // Verify font loading
        this.load.on('filecomplete-bitmapfont-pixelfont', () => {
            console.log('Bitmap font "pixelfont" loaded successfully');
        });
        this.load.on('loaderror', (file) => {
            if (file.key === 'pixelfont') {
                console.error('Failed to load bitmap font "pixelfont"');
            }
        });

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

        // UI elements
        try {
            this.distanceText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', 'Distance: 0', 40).setOrigin(0.5).setDepth(11);
            this.gameOverText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'GAME OVER!', 60).setOrigin(0.5).setDepth(11).setTint(0xff0000).setAlpha(0);
            this.victoryText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'YOU WIN!', 60).setOrigin(0.5).setDepth(11).setTint(0x00ff00).setAlpha(0);
        } catch (e) {
            console.warn('Bitmap font failed for UI text, using fallback:', e);
            this.distanceText = this.add.text(this.width / 2, 50, 'Distance: 0', {
                font: '40px Arial',
                fill: '#ffffff'
            }).setOrigin(0.5).setDepth(11);
            this.gameOverText = this.add.text(this.width / 2, this.height / 2, 'GAME OVER!', {
                font: '60px Arial',
                fill: '#ff0000'
            }).setOrigin(0.5).setDepth(11).setAlpha(0);
            this.victoryText = this.add.text(this.width / 2, this.height / 2, 'YOU WIN!', {
                font: '60px Arial',
                fill: '#00ff00'
            }).setOrigin(0.5).setDepth(11).setAlpha(0);
        }

        // Race map bar
        const mapBarWidth = 600;
        const mapBarHeight = 20;
        const mapBarX = (this.width - mapBarWidth) / 2;
        const mapBarY = 100;
        this.raceMapBar = this.add.graphics().setDepth(10);
        this.raceMapBar.fillStyle(0x808080, 1);
        this.raceMapBar.fillRect(mapBarX, mapBarY, mapBarWidth, mapBarHeight);
        this.raceMapBar.lineStyle(2, 0x000000, 1);
        this.raceMapBar.strokeRect(mapBarX, mapBarY, mapBarWidth, mapBarHeight);

        // Mark points on the race map bar
        this.carPositions = [200, 260, 320, 380, 440, 500, 560, 620, 680]; // 9 positions
        const mapBarPoints = this.carPositions.map(pos => mapBarX + ((pos - 200) / (680 - 200)) * mapBarWidth);
        mapBarPoints.forEach(pointX => {
            this.raceMapBar.fillStyle(0x000000, 1);
            this.raceMapBar.fillRect(pointX - 1, mapBarY - 1, 2, mapBarHeight + 2);
        });

        // Upside-down triangular markers
        this.playerMarker = this.add.triangle(mapBarPoints[0], mapBarY - 15, 0, 0, 10, 0, 5, 10, 0x00ff00).setDepth(11);
        this.enemyMarker = this.add.triangle(mapBarPoints[0], mapBarY - 15, 0, 0, 10, 0, 5, 10, 0xff0000).setDepth(11);

        // Checkered flag at the end of the map bar (9th position)
        this.finishFlag = this.add.graphics().setDepth(10);
        const flagSize = 20;
        const flagX = mapBarX + mapBarWidth;
        const flagY = mapBarY;
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                this.finishFlag.fillStyle((i + j) % 2 === 0 ? 0xffffff : 0x000000, 1);
                this.finishFlag.fillRect(flagX + i * flagSize / 2, flagY + j * flagSize / 2, flagSize / 2, flagSize / 2);
            }
        }

        // Input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.game.config.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Initialize background velocity
        this.bgVelocity = 0;
        this.isCountdownActive = false;
        this.isStartingCountdown = false;
        this.spaceHeld = false;
        this.raceEnded = false;
        this.distanceSpeed = 0;
        this.targetDistanceSpeed = 0;

        // Create pedal animations
        this.anims.create({
            key: 'shiftNormal',
            frames: [{ key: 'brakePedal', frame: 'pedal-brake-normal.png' }],
            frameRate: 1,
            repeat: 0
        });
        this.anims.create({
            key: 'shiftPressed',
            frames: [{ key: 'brakePedal', frame: 'pedal-brake-pressed.png' }],
            frameRate: 1,
            repeat: 0
        });
        this.anims.create({
            key: 'gasNormal',
            frames: [{ key: 'gasPedal', frame: 'pedal-gas-normal.png' }],
            frameRate: 1,
            repeat: 0
        });
        this.anims.create({
            key: 'gasPressed',
            frames: [{ key: 'gasPedal', frame: 'pedal-gas-pressed.png' }],
            frameRate: 1,
            repeat: 0
        });

        // Set up game scene and pedals
        gameSceneCreate(this);
        this.createPedalButtons();
        this.input.keyboard.disableGlobalCapture();
    }

    createPedalButtons() {
        // Shift pedal (left, emulates Shift key)
        this.shiftButton = this.add.sprite(100, this.height - 100, 'brakePedal', 'pedal-brake-normal.png')
            .setOrigin(0.5, 0.5)
            .setScale(0.7)
            .setDepth(100)
            .setScrollFactor(0)
            .setVisible(isMobile);
        this.shiftButton.setInteractive({ cursor: 'pointer' });
        this.shiftButton.on('pointerdown', () => {
            if (this.raceStarted && !this.isAnimating) {
                console.log('Shift pedal pressed, attempting gear shift');
                handleGearShift(this);
                this.shiftButton.play('shiftPressed');
            }
        }, this);
        this.shiftButton.on('pointerup', () => {
            this.shiftButton.play('shiftNormal');
        }, this);
        this.shiftButton.on('pointerout', () => {
            this.shiftButton.play('shiftNormal');
        }, this);

        // Gas pedal (right, emulates Spacebar key)
        this.gasButton = this.add.sprite(this.width - 100, this.height - 100, 'gasPedal', 'pedal-gas-normal.png')
            .setOrigin(0.5, 0.5)
            .setScale(0.7)
            .setDepth(100)
            .setScrollFactor(0)
            .setVisible(isMobile);
        this.gasButton.setInteractive({ cursor: 'pointer' });
        this.gasButton.on('pointerdown', () => {
            if (this.raceStarted && !this.isAnimating) {
                this.spaceHeld = true;
                console.log('Gas pedal pressed, starting line movement');
                this.gasButton.play('gasPressed');
            }
        }, this);
        this.gasButton.on('pointerup', () => {
            if (this.raceStarted && !this.isAnimating && this.timingBarUpdate) {
                this.spaceHeld = false;
                console.log('Gas pedal released, line moving back');
                this.isAnimating = true;
                this.sounds.damage.play();
                this.enemyPositionIndex = Math.min(this.enemyPositionIndex + 1, this.carPositions.length - 1);
                this.tweens.add({
                    targets: this.enemy,
                    x: this.carPositions[this.enemyPositionIndex],
                    duration: 500,
                    ease: 'Linear',
                    onComplete: () => {
                        this.isAnimating = false;
                        this.updateRaceMapMarkers();
                    }
                });
                this.gasButton.play('gasNormal');
            } else if (this.raceStarted) {
                this.spaceHeld = false;
                this.gasButton.play('gasNormal');
            }
        }, this);
        this.gasButton.on('pointerout', () => {
            if (this.raceStarted && !this.isAnimating && this.timingBarUpdate) {
                this.spaceHeld = false;
                console.log('Gas pedal released (pointerout), line moving back');
                this.isAnimating = true;
                this.sounds.damage.play();
                this.enemyPositionIndex = Math.min(this.enemyPositionIndex + 1, this.carPositions.length - 1);
                this.tweens.add({
                    targets: this.enemy,
                    x: this.carPositions[this.enemyPositionIndex],
                    duration: 500,
                    ease: 'Linear',
                    onComplete: () => {
                        this.isAnimating = false;
                        this.updateRaceMapMarkers();
                    }
                });
                this.gasButton.play('gasNormal');
            } else if (this.raceStarted) {
                this.spaceHeld = false;
                this.gasButton.play('gasNormal');
            }
        }, this);
    }

    update() {
        // Update parallax background continuously
        if (this.background1 && !this.isCountdownActive) {
            this.background1.tilePositionX += this.bgVelocity;
        }

        // Update distance counter when race is active
        if (this.raceStarted && !this.raceEnded) {
            if (this.distanceSpeed < this.targetDistanceSpeed) {
                this.distanceSpeed += 0.0005;
                if (this.distanceSpeed > this.targetDistanceSpeed) {
                    this.distanceSpeed = this.targetDistanceSpeed;
                }
            }
            this.distance += this.distanceSpeed;
            this.updateDistanceText();
        }

        // Check if either car reached the final position (9th position, index 8)
        if (this.raceStarted && !this.raceEnded) {
            if (this.enemyPositionIndex >= 8 && this.playerPositionIndex < 8) {
                this.raceEnded = true;
                this.raceStarted = false;
                this.tweens.add({
                    targets: this.enemy,
                    x: this.width + this.enemy.width,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        this.gameOver();
                    }
                });
            } else if (this.playerPositionIndex >= 8) {
                this.raceEnded = true;
                this.raceStarted = false;
                this.tweens.add({
                    targets: this.player,
                    x: this.width + this.player.width,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        this.victory();
                    }
                });
            }
        }

        // Handle finish line movement after 10th gear
        if (this.raceStarted && this.currentGear > 10 && !this.isAnimating && !this.raceEnded) {
            this.finishLine.setAlpha(1);
            this.finishLine.body.setVelocityX(-300);

            this.physics.world.overlap(this.finishLine, this.player, () => {
                this.raceEnded = true;
                this.finishLine.body.setVelocityX(0);
                this.raceStarted = false;
                this.tweens.add({
                    targets: this.player,
                    x: this.width + this.player.width,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        this.victory();
                    }
                });
            });
            this.physics.world.overlap(this.finishLine, this.enemy, () => {
                this.raceEnded = true;
                this.finishLine.body.setVelocityX(0);
                this.tweens.add({
                    targets: this.enemy,
                    x: this.width + this.enemy.width,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        this.gameOver();
                    }
                });
            });
        }
    }

    updateDistance(points) {
        this.distance += points;
        this.updateDistanceText();
    }

    updateDistanceText() {
        this.distanceText.setText(`Distance: ${Math.floor(this.distance)}`);
    }

    gameOver() {
        this.sound.stopAll();
        this.sounds.lose.setVolume(0.5).setLoop(false).play();
        if (this.timingBarUpdate) this.timingBarUpdate.destroy();
        this.gameOverText.setAlpha(1);
        this.vfx.blinkEffect(this.gameOverText, 400, 3);
        this.vfx.shakeCamera(300, 0.04);
        this.time.delayedCall(2500, () => {
            initiateGameOver.bind(this)({ distance: Math.floor(this.distance) });
        });
    }

    victory() {
        this.sound.stopAll();
        this.sounds.success.setVolume(0.5).setLoop(false).play();
        if (this.timingBarUpdate) this.timingBarUpdate.destroy();
        this.updateDistance(10);
        this.victoryText.setAlpha(1);
        this.vfx.blinkEffect(this.victoryText, 400, 3);
        this.vfx.shakeCamera(300, 0.04);
        this.time.delayedCall(2500, () => {
            initiateVictory.bind(this)({ distance: Math.floor(this.distance) });
        });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }

    updateRaceMapMarkers() {
        const mapBarWidth = 600;
        const mapBarX = (this.width - mapBarWidth) / 2;
        const playerMapX = mapBarX + ((this.carPositions[this.playerPositionIndex] - 200) / (680 - 200)) * mapBarWidth;
        const enemyMapX = mapBarX + ((this.carPositions[this.enemyPositionIndex] - 200) / (680 - 200)) * mapBarWidth;

        this.tweens.add({
            targets: this.playerMarker,
            x: playerMapX,
            duration: 500,
            ease: 'Linear'
        });
        this.tweens.add({
            targets: this.enemyMarker,
            x: enemyMapX,
            duration: 500,
            ease: 'Linear'
        });
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
    this.load.on('complete', () => {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

function gameSceneCreate(game) {
    game.sounds.background.setVolume(0.5).setLoop(true).play();

    // Parallax background
    game.background1 = game.add.tileSprite(0, 0, game.width, game.height, 'background').setOrigin(0, 0).setDepth(0);
    game.background1.setScale(game.width / game.background1.width, game.height / game.background1.height);

    // Cars (with physics)
    game.player = game.physics.add.image(200, game.height - 80, 'player').setScale(0.8).setDepth(2);
    game.player.body.setSize(game.player.width * 0.8, game.player.height * 0.8);
    game.player.body.setImmovable(true);
    game.enemy = game.physics.add.image(200, game.height - 250, 'enemy').setScale(0.5).setDepth(1);
    game.enemy.body.setSize(game.enemy.width * 0.8, game.enemy.height * 0.8);
    game.enemy.body.setImmovable(true);

    // Finish line (with physics)
    game.finishLine = game.add.rectangle(game.width, 0, 4, game.height, 0x00ff00).setOrigin(0, 0).setDepth(3).setAlpha(0);
    game.physics.add.existing(game.finishLine);
    game.finishLine.body.setImmovable(true);

    // Race parameters
    game.carPositions = [200, 260, 320, 380, 440, 500, 560, 620, 680];
    game.playerPositionIndex = 0;
    game.enemyPositionIndex = 0;
    game.playerSpeed = 2;
    game.enemySpeed = 2;
    game.currentGear = 0;
    game.raceStarted = false;
    game.isAnimating = false;
    game.lineInRedZone = false;

    // Create Spacebar key object
    game.spaceKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Timing bar
    const barWidth = 400;
    game.barHeight = 30;
    const barX = (game.width - barWidth) / 2;
    const barY = game.height - 50;

    // Color zones with black border
    game.timingBar = game.add.graphics().setDepth(3);
    const greyWidth = barWidth * 0.5;
    const yellowWidth = barWidth * 0.3;
    const greenWidth = barWidth * 0.15;
    const redWidth = barWidth * 0.05;

    game.timingBar.lineStyle(4, 0x000000, 1);
    game.timingBar.strokeRect(barX, barY, barWidth, game.barHeight);
    game.timingBar.fillStyle(0x808080);
    game.timingBar.fillRect(barX, barY, greyWidth, game.barHeight);
    game.timingBar.fillStyle(0xffff00);
    game.timingBar.fillRect(barX + greyWidth, barY, yellowWidth, game.barHeight);
    game.timingBar.fillStyle(0x00ff00);
    game.timingBar.fillRect(barX + greyWidth + yellowWidth, barY, greenWidth, game.barHeight);
    game.timingBar.fillStyle(0xff0000);
    game.timingBar.fillRect(barX + greyWidth + yellowWidth + greenWidth, barY, redWidth, game.barHeight);

    // Vertical line (black)
    game.timingLine = game.add.rectangle(barX, barY, 2, game.barHeight, 0x000000).setOrigin(0, 0).setDepth(4);
    game.linePosition = 0;
    game.lineSpeed = 0;

    // Traffic light
    game.trafficLight = game.add.graphics().setDepth(5);
    const lightWidth = 100;
    const lightHeight = 300;
    const lightX = game.width / 2 - lightWidth / 2;
    const lightY = game.height / 2 - lightHeight / 2;

    // Black rectangle housing
    game.trafficLight.fillStyle(0x000000, 1);
    game.trafficLight.fillRect(lightX, lightY, lightWidth, lightHeight);

    // Circles (red, yellow, green)
    const circleRadius = 30;
    const circleSpacing = lightHeight / 3;
    game.trafficLight.redCircle = { x: lightX + lightWidth / 2, y: lightY + circleSpacing / 2, alpha: 0.3 };
    game.trafficLight.yellowCircle = { x: lightX + lightWidth / 2, y: lightY + circleSpacing * 1.5, alpha: 0.3 };
    game.trafficLight.greenCircle = { x: lightX + lightWidth / 2, y: lightY + circleSpacing * 2.5, alpha: 0.3 };

    // Draw initial light circles
    game.trafficLight.fillStyle(0xff0000, game.trafficLight.redCircle.alpha);
    game.trafficLight.fillCircle(game.trafficLight.redCircle.x, game.trafficLight.redCircle.y, circleRadius);
    game.trafficLight.fillStyle(0xffff00, game.trafficLight.yellowCircle.alpha);
    game.trafficLight.fillCircle(game.trafficLight.yellowCircle.x, game.trafficLight.yellowCircle.y, circleRadius);
    game.trafficLight.fillStyle(0x00ff00, game.trafficLight.greenCircle.alpha);
    game.trafficLight.fillCircle(game.trafficLight.greenCircle.x, game.trafficLight.greenCircle.y, circleRadius);

    // Input listeners for race start (spacebar press to initiate countdown)
    game.input.keyboard.on('keydown-SPACE', () => {
        if (game.isAnimating || game.isStartingCountdown) return;
        if (!game.raceStarted && game.currentGear === 0) {
            game.isStartingCountdown = true;
            game.isCountdownActive = true;
            game.trafficLight.clear();
            game.trafficLight.fillStyle(0x000000, 1);
            game.trafficLight.fillRect(lightX, lightY, lightWidth, lightHeight);
            game.trafficLight.redCircle.alpha = 1.0;
            game.trafficLight.yellowCircle.alpha = 0.3;
            game.trafficLight.greenCircle.alpha = 0.3;
            game.trafficLight.fillStyle(0xff0000, game.trafficLight.redCircle.alpha);
            game.trafficLight.fillCircle(game.trafficLight.redCircle.x, game.trafficLight.redCircle.y, circleRadius);
            game.trafficLight.fillStyle(0xffff00, game.trafficLight.yellowCircle.alpha);
            game.trafficLight.fillCircle(game.trafficLight.yellowCircle.x, game.trafficLight.yellowCircle.y, circleRadius);
            game.trafficLight.fillStyle(0x00ff00, game.trafficLight.greenCircle.alpha);
            game.trafficLight.fillCircle(game.trafficLight.greenCircle.x, game.trafficLight.greenCircle.y, circleRadius);

            game.time.delayedCall(1000, () => {
                game.trafficLight.clear();
                game.trafficLight.fillStyle(0x000000, 1);
                game.trafficLight.fillRect(lightX, lightY, lightWidth, lightHeight);
                game.trafficLight.redCircle.alpha = 0.3;
                game.trafficLight.yellowCircle.alpha = 1.0;
                game.trafficLight.greenCircle.alpha = 0.3;
                game.trafficLight.fillStyle(0xff0000, game.trafficLight.redCircle.alpha);
                game.trafficLight.fillCircle(game.trafficLight.redCircle.x, game.trafficLight.redCircle.y, circleRadius);
                game.trafficLight.fillStyle(0xffff00, game.trafficLight.yellowCircle.alpha);
                game.trafficLight.fillCircle(game.trafficLight.yellowCircle.x, game.trafficLight.yellowCircle.y, circleRadius);
                game.trafficLight.fillStyle(0x00ff00, game.trafficLight.greenCircle.alpha);
                game.trafficLight.fillCircle(game.trafficLight.greenCircle.x, game.trafficLight.greenCircle.y, circleRadius);

                game.time.delayedCall(1000, () => {
                    game.trafficLight.clear();
                    game.trafficLight.fillStyle(0x000000, 1);
                    game.trafficLight.fillRect(lightX, lightY, lightWidth, lightHeight);
                    game.trafficLight.redCircle.alpha = 0.3;
                    game.trafficLight.yellowCircle.alpha = 0.3;
                    game.trafficLight.greenCircle.alpha = 1.0;
                    game.trafficLight.fillStyle(0xff0000, game.trafficLight.redCircle.alpha);
                    game.trafficLight.fillCircle(game.trafficLight.redCircle.x, game.trafficLight.redCircle.y, circleRadius);
                    game.trafficLight.fillStyle(0xffff00, game.trafficLight.yellowCircle.alpha);
                    game.trafficLight.fillCircle(game.trafficLight.yellowCircle.x, game.trafficLight.yellowCircle.y, circleRadius);
                    game.trafficLight.fillStyle(0x00ff00, game.trafficLight.greenCircle.alpha);
                    game.trafficLight.fillCircle(game.trafficLight.greenCircle.x, game.trafficLight.greenCircle.y, circleRadius);

                    game.time.delayedCall(1000, () => {
                        game.raceStarted = true;
                        game.currentGear = 1;
                        game.isCountdownActive = false;
                        game.isStartingCountdown = false;
                        game.tweens.add({
                            targets: game,
                            bgVelocity: 10 * game.playerSpeed,
                            duration: 1000,
                            ease: 'Linear',
                            onComplete: () => {
                                console.log(`Background velocity reached: ${game.bgVelocity}`);
                            }
                        });
                        game.targetDistanceSpeed = 0.02;
                        startTimingBar(game);
                        game.time.delayedCall(500, () => {
                            game.trafficLight.destroy();
                        });
                    });
                });
            });
        }
    });

    // Input listeners for timing bar control and gear shifting
    game.input.keyboard.on('keydown-SPACE', () => {
        if (game.raceStarted && !game.isAnimating) {
            game.spaceHeld = true;
            console.log('Spacebar held, starting line movement');
        }
    });

    game.input.keyboard.on('keyup-SPACE', () => {
        if (game.raceStarted && !game.isAnimating && game.timingBarUpdate) {
            game.spaceHeld = false;
            console.log('Spacebar released, line moving back');
            game.isAnimating = true;
            game.sounds.damage.play();
            game.enemyPositionIndex = Math.min(game.enemyPositionIndex + 1, game.carPositions.length - 1);
            game.tweens.add({
                targets: game.enemy,
                x: game.carPositions[game.enemyPositionIndex],
                duration: 500,
                ease: 'Linear',
                onComplete: () => {
                    game.isAnimating = false;
                    game.updateRaceMapMarkers();
                }
            });
        } else if (game.raceStarted) {
            game.spaceHeld = false;
            console.log('Spacebar released during animation, updating state');
        }
    });

    game.input.keyboard.on('keydown-SHIFT', () => {
        if (game.raceStarted && !game.isAnimating) {
            console.log(`Shift key pressed, attempting gear shift at gear: ${game.currentGear}`);
            handleGearShift(game);
        }
    });
}

function startTimingBar(game) {
    const barWidth = 400;
    let lineSpeed;
    let greenWidth;

    switch (game.currentGear) {
        case 1:
            lineSpeed = 0.02;
            greenWidth = barWidth * 0.15;
            break;
        case 2:
            lineSpeed = 0.015;
            greenWidth = barWidth * 0.1;
            break;
        case 3:
            lineSpeed = 0.01;
            greenWidth = barWidth * 0.07;
            break;
        case 4:
            lineSpeed = 0.008;
            greenWidth = barWidth * 0.05;
            break;
        case 5:
            lineSpeed = 0.006;
            greenWidth = barWidth * 0.04;
            break;
        case 6:
            lineSpeed = 0.005;
            greenWidth = barWidth * 0.03;
            break;
        case 7:
            lineSpeed = 0.004;
            greenWidth = barWidth * 0.025;
            break;
        case 8:
            lineSpeed = 0.003;
            greenWidth = barWidth * 0.02;
            break;
        case 9:
            lineSpeed = 0.002;
            greenWidth = barWidth * 0.015;
            break;
        case 10:
            lineSpeed = 0.001;
            greenWidth = barWidth * 0.01;
            break;
        default:
            lineSpeed = 0.01;
            greenWidth = barWidth * 0.1;
    }

    const barX = (game.width - barWidth) / 2;
    const barY = game.height - 50;
    const greyWidth = barWidth * 0.5;
    const yellowWidth = barWidth - greyWidth - greenWidth - (barWidth * 0.05);
    const redWidth = barWidth * 0.05;

    game.timingBar.clear();
    game.timingBar.lineStyle(4, 0x000000, 1);
    game.timingBar.strokeRect(barX, barY, barWidth, game.barHeight);
    game.timingBar.fillStyle(0x808080);
    game.timingBar.fillRect(barX, barY, greyWidth, game.barHeight);
    game.timingBar.fillStyle(0xffff00);
    game.timingBar.fillRect(barX + greyWidth, barY, yellowWidth, game.barHeight);
    game.timingBar.fillStyle(0x00ff00);
    game.timingBar.fillRect(barX + greyWidth + yellowWidth, barY, greenWidth, game.barHeight);
    game.timingBar.fillStyle(0xff0000);
    game.timingBar.fillRect(barX + greyWidth + yellowWidth + greenWidth, barY, redWidth, game.barHeight);

    game.lineSpeed = lineSpeed;
    game.linePosition = game.currentGear <= 4 ? 0 : 0.5;
    game.lineInRedZone = false;
    game.timingLine.x = barX + (game.linePosition * barWidth);

    if (game.timingBarUpdate) game.timingBarUpdate.destroy();

    game.timingBarUpdate = game.time.addEvent({
        delay: 16,
        callback: () => {
            if (game.isAnimating) return;
            const minLinePosition = game.currentGear <= 4 ? 0 : 0.5;
            if (game.spaceHeld && !game.lineInRedZone) {
                game.linePosition += game.lineSpeed;
                if (game.linePosition >= 1) {
                    game.linePosition = 0.95;
                    game.lineInRedZone = true;
                }
            } else if (!game.spaceHeld && game.linePosition > minLinePosition) {
                game.linePosition -= game.lineSpeed * 2;
                if (game.linePosition <= minLinePosition) {
                    game.linePosition = minLinePosition;
                    game.lineInRedZone = false;
                }
            }
            game.timingLine.x = barX + (game.linePosition * barWidth);
        },
        loop: true
    });
}

function handleGearShift(game) {
    if (game.currentGear > 10 || game.isAnimating) return;

    const barWidth = 400;
    const barX = (game.width - barWidth) / 2;
    const greyWidth = barWidth * 0.5;
    let yellowWidth;
    let greenWidth;

    switch (game.currentGear) {
        case 1:
            greenWidth = barWidth * 0.15;
            break;
        case 2:
            greenWidth = barWidth * 0.1;
            break;
        case 3:
            greenWidth = barWidth * 0.07;
            break;
        case 4:
            greenWidth = barWidth * 0.05;
            break;
        case 5:
            greenWidth = barWidth * 0.04;
            break;
        case 6:
            greenWidth = barWidth * 0.03;
            break;
        case 7:
            greenWidth = barWidth * 0.025;
            break;
        case 8:
            greenWidth = barWidth * 0.02;
            break;
        case 9:
            greenWidth = barWidth * 0.015;
            break;
        case 10:
            greenWidth = barWidth * 0.01;
            break;
        default:
            greenWidth = barWidth * 0.1;
    }
    yellowWidth = barWidth - greyWidth - greenWidth - (barWidth * 0.05);

    const linePos = game.timingLine.x - barX;
    game.isAnimating = true;
    if (game.timingBarUpdate) game.timingBarUpdate.destroy();

    const currentVelocity = game.bgVelocity;

    if (linePos < greyWidth) {
        game.sounds.damage.play();
        game.vfx.shakeCamera(100, 0.01);
        game.enemyPositionIndex = Math.min(game.enemyPositionIndex + 1, game.carPositions.length - 1);
        game.tweens.add({
            targets: game.enemy,
            x: game.carPositions[game.enemyPositionIndex],
            duration: 500,
            ease: 'Linear',
            onComplete: () => {
                game.isAnimating = false;
                game.spaceHeld = game.spaceKey.isDown;
                game.updateRaceMapMarkers();
                startTimingBar(game);
                game.tweens.add({
                    targets: game,
                    bgVelocity: currentVelocity,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        console.log(`Background velocity after gear ${game.currentGear}: ${game.bgVelocity}`);
                    }
                });
            }
        });
    } else if (linePos < greyWidth + yellowWidth) {
        game.playerSpeed += 0.5;
        game.enemySpeed += 1;
        game.sounds.damage.play();
        game.enemyPositionIndex = Math.min(game.enemyPositionIndex + 1, game.carPositions.length - 1);
        game.tweens.add({
            targets: game.enemy,
            x: game.carPositions[game.enemyPositionIndex],
            duration: 500,
            ease: 'Linear',
            onComplete: () => {
                game.isAnimating = false;
                game.spaceHeld = game.spaceKey.isDown;
                game.updateRaceMapMarkers();
                startTimingBar(game);
                game.tweens.add({
                    targets: game,
                    bgVelocity: 10 * game.playerSpeed,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        console.log(`Background velocity after gear ${game.currentGear}: ${game.bgVelocity}`);
                    }
                });
            }
        });
    } else if (linePos < greyWidth + yellowWidth + greenWidth) {
        game.playerSpeed += 1.5;
        game.enemySpeed += 0.5;
        game.sounds.success.play();
        game.playerPositionIndex = Math.min(game.playerPositionIndex + 1, game.carPositions.length - 1);
        game.tweens.add({
            targets: game.player,
            x: game.carPositions[game.playerPositionIndex],
            duration: 500,
            ease: 'Linear',
            onComplete: () => {
                game.isAnimating = false;
                game.currentGear++;
                game.spaceHeld = game.spaceKey.isDown;
                game.updateRaceMapMarkers();
                if (game.currentGear <= 10) {
                    startTimingBar(game);
                }
                game.tweens.add({
                    targets: game,
                    bgVelocity: 10 * game.playerSpeed,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        console.log(`Background velocity after gear ${game.currentGear}: ${game.bgVelocity}`);
                    }
                });
                game.targetDistanceSpeed += 0.01;
            }
        });
    } else {
        game.playerSpeed += 0.3;
        game.enemySpeed += 1.5;
        game.sounds.damage.play();
        game.enemyPositionIndex = Math.min(game.enemyPositionIndex + 1, game.carPositions.length - 1);
        game.tweens.add({
            targets: game.enemy,
            x: game.carPositions[game.enemyPositionIndex],
            duration: 500,
            ease: 'Linear',
            onComplete: () => {
                game.isAnimating = false;
                game.spaceHeld = game.spaceKey.isDown;
                game.updateRaceMapMarkers();
                startTimingBar(game);
                game.tweens.add({
                    targets: game,
                    bgVelocity: 10 * game.playerSpeed,
                    duration: 1000,
                    ease: 'Linear',
                    onComplete: () => {
                        console.log(`Background velocity after gear ${game.currentGear}: ${game.bgVelocity}`);
                    }
                });
            }
        });
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
    pixelArt: false,
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