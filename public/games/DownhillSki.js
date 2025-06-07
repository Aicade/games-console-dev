// Touuch Screen Controls
const joystickEnabled = false;
const buttonEnabled = false;


// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.distanceTravelled = 0;
        this.coinsCollected = 0;
    }

    preload() {
        this.score = 0;
        this.isGameOver = false;

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        addEventListenersPhaser.bind(this)();

        if (joystickEnabled && _CONFIG.rexJoystickUrl) {
            this.load.plugin('rexvirtualjoystickplugin', _CONFIG.rexJoystickUrl, true);
        }
        if (buttonEnabled && _CONFIG.rexButtonUrl) {
            this.load.plugin('rexbuttonplugin', _CONFIG.rexButtonUrl, true);
        }



        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);

    }
    gameSceneBackground() {
        let bgSize = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width > _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height ? _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width : _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height;
        this.bg = this.add
            .tileSprite(0, 0, bgSize, bgSize, "background")
            .setOrigin(0, 0)
            .setScrollFactor(1).setDepth(-11);
    }

    create() {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.isGameOver = false;

        this.sounds.background.setVolume(0.1).setLoop(true).play();
        this.gameSceneBackground();

        this.vfx = new VFXLibrary(this);
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.score = 0;
        this.gameScore = 0;
        this.gameLevel = 1;
        this.levelThreshold = 100;

        this.player = this.physics.add.image(this.width / 2, this.height / 2 - 250, 'player').setScale(0.25, 0.25);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(this.player.width * 0.7, this.player.height * 0.7);

        this.enemies = this.physics.add.group();
        this.boosters = this.physics.add.group(); // Add boosters group  <--- ADD THIS LINE AFTER THIS LINE
        this.physics.add.overlap(this.player, this.boosters, this.collectBooster, null, this); // Add overlap for boosters <--- ADD THIS LINE AFTER THIS LINE

        this.coins = this.physics.add.group();
        this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.isMovingRight = true;
        this.input.on('pointerdown', () => {
            this.sounds.move.setVolume(1).setLoop(false).play()
            this.isMovingRight = !this.isMovingRight;
        });

        this.physics.add.collider(this.player, this.enemies, (player, enemy) => {
            this.resetGame();
        });

        this.time.addEvent({
            delay: 1000,
            callback: this.updateGameLevel,
            callbackScope: this,
            loop: true,
            args: [1]
        });

        this.scoreText = this.add.bitmapText(this.game.config.width / 2, 100, 'pixelfont', '0', 128)
        .setOrigin(0.5, 0.5);
        const textScaleFactor = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width / 1100;
        this.scoreText.setScale(textScaleFactor);
        this.scoreText.setDepth(11);

        this.coinCounterText = this.add.bitmapText(
            _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width * 0.1, 
            100, 'pixelfont', 'Coins: 0', 64)
            .setOrigin(0, 0.5);
        this.coinCounterText.setScale(textScaleFactor);
        this.coinCounterText.setDepth(11);

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
        this.vfx.scaleGameObject(this.player, 1.1, 500);

        this.player._originalScale = 0.25;
        this.scaleAssetToOrientation(this.player);

        // Apply scaling to UI elements
        this.scaleAssetToOrientation(this.pauseButton);
        // const textScaleFactor = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width / 800;
        this.scoreText.setScale(textScaleFactor);
        this.coinCounterText.setScale(textScaleFactor);
        this.coinCounterText.setFontSize(Math.floor(64 * _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width / 800));

        // Adjust position of coin counter for different screen sizes
        this.coinCounterText.setPosition(
            _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width * 0.055,
            100
        );

        let bubble = this.add.graphics({ x: -100, y: 0, add: false });

        const bubbleRadius = 10;
        const bubbleColor = 0xffffff; // A nice bubble color

        bubble.fillStyle(bubbleColor, .3); // Semi-transparent
        bubble.fillCircle(bubbleRadius, bubbleRadius, bubbleRadius);
        bubble.generateTexture('bubbles', 100, 100);

        this.trail = this.add.particles(0, 70, 'bubbles', {
            speed: 100,
            scale: { start: 0.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 600,
            angle: { min: -40, max: -10 },
            emitZone: { type: 'edge', source: new Phaser.Geom.Line(-10, -10, 10, 10), quantity: .2, yoyo: false }
        });
        this.trail.startFollow(this.player);
        this.input.keyboard.disableGlobalCapture();
        this.scale.on('resize', this.handleResize, this);
    }

    scaleAssetToOrientation(gameObject) {
        const baseWidth = 800; // Reference width for scaling calculations
        const currentWidth = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width;
        const scaleFactor = currentWidth / baseWidth;
        
        // Apply the scale factor to the game object
        if (gameObject.setScale) {
            // For objects that already have a scale, multiply by the scaleFactor
            const originalScale = gameObject._originalScale || 1;
            gameObject.setScale(originalScale * scaleFactor);
        }
        
        return gameObject;
    }

    handleResize() {
        // Re-scale all active game objects when the window is resized
        if (this.player && this.player.active) this.scaleAssetToOrientation(this.player);
        
        // Rescale enemies
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active) this.scaleAssetToOrientation(enemy);
        });
        
        // Rescale boosters
        this.boosters.getChildren().forEach(booster => {
            if (booster.active) this.scaleAssetToOrientation(booster);
        });
        
        // Rescale coins
        this.coins.getChildren().forEach(coin => {
            if (coin.active) this.scaleAssetToOrientation(coin);
        });
        
        // Update UI elements
        if (this.scoreText) {
            const textScaleFactor = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width / 1000;
            this.scoreText.setScale(textScaleFactor);
        }
        
        if (this.coinCounterText) {
            const textScaleFactor = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width / 800;
            this.coinCounterText.setScale(textScaleFactor);
            this.coinCounterText.setPosition(
                _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width * 0.1,
                100
            );
        }
        
        if (this.pauseButton) this.scaleAssetToOrientation(this.pauseButton);
    }

    update(time, delta) {
        if (!this.isGameOver) {
            this.bg.tilePositionY += 3;
            if(this.distanceIncrement === undefined){
              this.distanceIncrement = 0.003;
            }
            this.distanceTravelled += this.distanceIncrement;
            this.updateScoreText();

            // Update player speed based on immunity
            if (this.player.isImmune) {
                const boostedSpeed = 600;
                this.player.setVelocityX(this.isMovingRight ? boostedSpeed : -boostedSpeed);
            } else {
                const originalSpeed = 300;
                this.player.setVelocityX(this.isMovingRight ? originalSpeed : -originalSpeed);
            }

            this.enemySpawn();
            this.boosterSpawn();
            this.coinSpawn();
        }

    }

    collectBooster(player, booster) { // Add collectBooster function <--- ADD THIS FUNCTION AFTER THE END OF THE `update` FUNCTION
        booster.destroy();
        // this.updateScore(10); // Or any other score increase
        // this.sounds.booster.play();
        this.increasePlayerSpeedAndImmunity();
        this.increaseDistanceIncrement();
    }

    increaseDistanceIncrement() {
        const originalIncrement = 0.003;
        const boostedIncrement = 0.1;
        const incrementDuration = 5000;

        this.distanceIncrement = boostedIncrement;

        this.time.delayedCall(incrementDuration, () => {
            this.distanceIncrement = originalIncrement; // Reset here!
        }, [], this);
    }


    increasePlayerSpeedAndImmunity() {
        const originalSpeed = 300;
        const boostedSpeed = 600; // Double the speed, adjust as needed
        const immunityDuration = 5000; // 5 seconds
    
        this.player.setVelocityX(this.isMovingRight ? boostedSpeed : -boostedSpeed);
        this.player.isImmune = true; // Add a flag for immunity
    
        // Change collider temporarily
        this.physics.world.removeCollider(this.player.body.collider);
    
        // Reset speed and immunity after 5 seconds
        this.time.delayedCall(immunityDuration, () => {
            // Check if player still exists before modifying properties
            if (this.player && this.player.active) {
                this.player.setVelocityX(this.isMovingRight ? originalSpeed : -originalSpeed);
                this.player.isImmune = false;
                this.physics.add.collider(this.player, this.enemies, (player, enemy) => {
                    this.resetGame();
                }); // Re-add the collider
            }
        }, [], this);
    }

    boosterSpawn() {
        let spawnProbability = 0.001 + this.gameLevel * 0.0005; // Less frequent than enemies

        if (Math.random() < spawnProbability) {
            let spawnX = Phaser.Math.Between(0, this.game.config.width);
            let velocityY = -(150 + this.gameLevel * 10);

            var booster = this.boosters.create(spawnX, this.game.config.height + 50, 'collectible_1');
            booster._originalScale = 0.25;
            this.scaleAssetToOrientation(booster);
            booster.body.setSize(booster.width * 0.7, booster.height * 0.7);
            booster.setVelocityY(velocityY);
        }
    }

    coinSpawn() {
        let spawnProbability = 0.0015 + this.gameLevel * 0.00075; // Adjust frequency as needed

        if (Math.random() < spawnProbability) {
            let spawnX = Phaser.Math.Between(0, this.game.config.width);
            let velocityY = -(150 + this.gameLevel * 10);

            var coin = this.coins.create(spawnX, this.game.config.height + 50, 'collectible');
            coin._originalScale = 0.1;
            this.scaleAssetToOrientation(coin);
            coin.body.setSize(coin.width * 0.7, coin.height * 0.7);
            coin.setVelocityY(velocityY);
        }
    }

    collectCoin(player, coin) {
        coin.destroy();
        this.updateScore(1); // Adjust score value as needed
        // this.sounds.coin.play(); // Play coin collection sound
        this.coinsCollected++; // Increment coin counter
        this.updateCoinCounterText();
    }
    updateCoinCounterText() {
        this.coinCounterText.setText('Coins: ' + this.coinsCollected);
    }

    updateGameLevel() {
        if (!this.isGameOver) {
            this.gameScore += 1;
            this.updateScore(1);
            if (this.gameScore >= this.levelThreshold) {
                this.gameLevel++;
                this.levelThreshold += 200;
            }
        }
    }
    enemySpawn() {

        let spawnProbability = 0.005 + this.gameLevel * 0.005;

        if (Math.random() < spawnProbability) {
            let spawnX = Phaser.Math.Between(0, this.game.config.width);
            let velocityY = -(200 + this.gameLevel * 10);

            var enemy = this.enemies.create(spawnX, this.game.config.height + 50, 'enemy');
            enemy._originalScale = 0.25;
            this.scaleAssetToOrientation(enemy);
            enemy.body.setSize(enemy.width * 0.7, enemy.height * 0.7);
            enemy.setVelocityY(velocityY);
        }
    }
    resetGame() {
        this.isGameOver = true;
        this.physics.pause();
        this.player.destroy();
        this.vfx.shakeCamera();
        this.trail.destroy();

        let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 200, 'pixelfont', 'Game Over', 64)
            .setOrigin(0.5)
            .setVisible(false)
            .setAngle(-15);

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


    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(Math.floor(this.distanceTravelled) + "m");
    }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({ distance: Math.floor(this.distanceTravelled) + "m",
        coins: this.coinsCollected }); // Pass distance travelled as score
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
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.PORTRAIT
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
    deviceOrientation: _CONFIG.deviceOrientation==="portrait"
};