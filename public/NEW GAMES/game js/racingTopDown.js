class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        this.showDebugGraphics = true; 
        
        this.trackPath = []; 
        
        this.TILE_SIZE = 64; 
        this.DIRECTIONS = [
            { x: 1, y: 0 },    // 0 = right
            { x: 0, y: 1 },    // 1 = down
            { x: -1, y: 0 },   // 2 = left
            { x: 0, y: -1 }    // 3 = up
        ];
        this.CURVE_ANGLES = {
            '3-2': 0,    // up → left (bottom-left curve)
            '2-1': 90,   // left → down (top-left curve, rotated 90 deg clockwise)
            '1-0': 180,  // down → right (top-right curve, rotated 180 deg clockwise)
            '0-3': 270,  // right → up (bottom-right curve, rotated 270 deg clockwise)
            '2-3': (0 + 180) % 360, // left -> up (reverse of 3-2)
            '1-2': (90 + 180) % 360, // down -> left (reverse of 2-1)
            '0-1': (180 + 180) % 360, // right -> down (reverse of 1-0)
            '3-0': (270 + 180) % 360   // up → right (reverse of 0-3)
        };
        for (const key in this.CURVE_ANGLES) {
            this.CURVE_ANGLES[key] = (this.CURVE_ANGLES[key] % 360 + 360) % 360;
        }

        this.roadWidth = 40; 
        this.grassTileSize = 200; 

        this.worldWidth = 0;
        this.worldHeight = 0;

        this.checkpointRadius = 25;
        this.maxSpeed = 6; 
        this.forceMagnitude = 0.01; 
        this.lapStartTime = 0;
        this.totalLapTime = 0;
        this.lapTimes = []; 
        this.bestLapTimes = []; 
        this.checkpoints = []; 
        this.currentCheckpoint = 0; 
        this.lapCount = 0; 
        this.score = 0;
        this.isGameOver = false;
        this.isGameStarted = false; 

        this.maxHealth = 5; 
        this.health = this.maxHealth;
        
        this.damageThresholdSpeed = 3; 
        this.damageMultiplier = 5; 

        this.sounds = {};
        
        this.camera = null;
        this.car = null;
        this.cursors = null;

        this.isInvincible = false;
        this.invincibilityDuration = 1500; 
        this.blinkInterval = 100; 
        this.blinkTimer = 0;
        this.invincibilityTimerEvent = null; 
        
        this.CATEGORY_CAR = 0x0001;
        this.CATEGORY_BOUNDARY = 0x0002;
        this.CATEGORY_CHECKPOINT = 0x0004; 
        this.CATEGORY_ENEMY_CAR = 0x0008; 

        this.tireMarksGraphics = null;
        this.tireMarkInterval = 10; 
        this.lastTireMarkTime = 0;
        this.prevRearLeftPos = { x: 0, y: 0 };
        this.prevRearRightPos = { x: 0, y: 0 };
        this.tireMarkSegments = []; 
        this.lateralSlipThreshold = 0.05; 
        this.tireMarkSpeedThreshold = 0.1; 
        this.tireMarkHighSpeedThreshold = this.maxSpeed * 0.8; 

        this.handleTireMarks = this.handleTireMarks.bind(this);
        this.drawFadingTireMarks = this.drawFadingTireMarks.bind(this);

        this.speedometerImage = null;
        this.speedometerNeedle = null; 

        this.boundaryPadding = 5; 
        this.boundaryColor1 = 0xFF0000; 
        this.boundaryColor2 = 0xFFFFFF; 

        this.enemyCars = []; 
        this.enemyCarSpeed = 1; 

        this.ENEMY_RECOVERY_DURATION = 1000; 
        this.ENEMY_RECOVERY_SPEED_MULTIPLIER = 0.3; 

        this.winText = null; 
        this.gameOverText = null; 
        this.startButton = null; 
        this.nextLevelText = null; 
        this.retryButton = null;
        
        this.n2CheckpointBody = null; 

        this.healthIcons = []; 
        this.healthTextLabel = null;

        // New properties for levels
        this.level = 1;
        this.maxLevel = 5; // Define maximum number of levels
        this.levelText = null; // Text to display current level
        this.enemyCarBaseSpeed = 1; // Base speed for enemy cars, increased per level
        this.enemyCarSpeed = this.enemyCarBaseSpeed;
    }

    preload() {
        // Generic loader for all images in _CONFIG.imageLoader
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]); 
        }
        // Generic loader for all sounds in _CONFIG.soundsLoader
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        // Generic loader for all sounds in _CONFIG.libLoader
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }
    }

    create() {
        this.sounds.background = this.sound.add('background', { loop: false, volume: 0.5 });
        this.sounds.move = this.sound.add('move', { loop: false, volume: 0.5 });
        this.sounds.collect = this.sound.add('collect', { loop: false, volume: 0.5 });
        this.sounds.lose = this.sound.add('lose', { loop: false, volume: 0.5 });
        this.sounds.damage = this.sound.add('damage', { loop: false, volume: 0.5 });

        if (this.sounds.damage && this.sounds.damage.key === '__missing') { 
            console.warn("'_CONFIG.soundsLoader.damage' is not defined or loaded. Collision sound will not play.");
        }
        if (this.sounds.background && this.sounds.background.key !== '__missing') {
            this.sounds.background.setVolume(0.3).setLoop(true).play();
        } else {
            console.warn("Background sound not loaded or defined in _CONFIG.soundsLoader.");
        }
        
        this.camera = this.cameras.main;
        this.camera.setPosition(0,0);
        this.camera.setScroll(0,0);
        this.camera.setZoom(4.0); 
        
        // Initial world bounds (will be adjusted after track generation)
        this.matter.world.setBounds(0, 0, 1280, 720);
        this.camera.setBounds(0, 0, 1280, 720);

        // Call the new random track generation function FIRST
        this.generateRandomTrack(); 
        // Then create the grass background based on the generated track's bounds
        this.createGrassBackground();
        this.setupCar(); 

        this.tireMarksGraphics = this.add.graphics({ lineStyle: { width: 3, color: 0x000000, alpha: 0.8 } });
        this.tireMarksGraphics.setDepth(1.5); 
        
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.disableGlobalCapture();
        
        this.setupCollisions();

        this.camera.startFollow(this.car);

        // Player Scoreboard Entries (defined first to calculate scoreboardTopY)
        const playerTextConfig = {
            fontSize: '12px', 
            fill: '#FFFFFF',
            backgroundColor: '#000000', 
            padding: { x: 5, y: 2 },
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 1, stroke: false, fill: true } 
        };
        const iconScale = 0.015; 
        const entryLineHeight = 18; 
        
        // Calculate initial positions for the scoreboard block, relative to the center of the screen
        const scoreboardBlockCenterY = this.cameras.main.height / 2 - 80; 
        const scoreboardBlockCenterX = this.cameras.main.width / 2 - 180;

        // Total height of the scoreboard block (1 player + 3 enemies)
        const totalBlockHeight = entryLineHeight * 4; 
        const scoreboardTopY = scoreboardBlockCenterY - (totalBlockHeight / 2);

        // Player's entry
        this.playerIcon = this.add.image(scoreboardBlockCenterX - 43, scoreboardTopY + entryLineHeight / 2, 'player')
            .setOrigin(0.5, 0.5)
            .setScale(iconScale)
            .setScrollFactor(0)
            .setDepth(1000);
        this.playerLapText = this.add.text(scoreboardBlockCenterX - 43 + 15, scoreboardTopY + entryLineHeight / 2, `You: Lap ${this.lapCount}`, playerTextConfig)
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(1000);

        // Enemy Player Entries (shifted down by one entryLineHeight)
        const enemyEntriesStartY = scoreboardTopY + entryLineHeight;

        // Player 1 (Enemy Car 1)
        this.enemy1Icon = this.add.image(scoreboardBlockCenterX - 43, enemyEntriesStartY + entryLineHeight / 2, 'enemy_1')
            .setOrigin(0.5, 0.5) 
            .setScale(iconScale)
            .setScrollFactor(0)
            .setDepth(1000);
        this.player1Text = this.add.text(scoreboardBlockCenterX - 43 + 15, enemyEntriesStartY + entryLineHeight / 2, 'Player 1: Lap 0', playerTextConfig) 
            .setOrigin(0, 0.5) 
            .setScrollFactor(0)
            .setDepth(1000);

        // Player 2 (Enemy Car 2)
        this.enemy2Icon = this.add.image(scoreboardBlockCenterX - 43, enemyEntriesStartY + entryLineHeight + entryLineHeight / 2, 'enemy_2')
            .setOrigin(0.5, 0.5)
            .setScale(iconScale)
            .setScrollFactor(0)
            .setDepth(1000);
        this.player2Text = this.add.text(scoreboardBlockCenterX - 43 + 15, enemyEntriesStartY + entryLineHeight + entryLineHeight / 2, 'Player 2: Lap 0', playerTextConfig)
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(1000);

        // Player 3 (Enemy Car 3)
        this.enemy3Icon = this.add.image(scoreboardBlockCenterX - 43, enemyEntriesStartY + (entryLineHeight * 2) + entryLineHeight / 2, 'enemy_3')
            .setOrigin(0.5, 0.5)
            .setScale(iconScale)
            .setScrollFactor(0)
            .setDepth(1000);
        this.player3Text = this.add.text(scoreboardBlockCenterX - 43 + 15, enemyEntriesStartY + (entryLineHeight * 2) + entryLineHeight / 2, 'Player 3: Lap 0', playerTextConfig)
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(1000);

        this.setupEnemyCars(); 


        // UI Health Display (positioned relative to camera center)
        const healthUIRootX = this.cameras.main.width / 2 + (_CONFIG.healthUI ? _CONFIG.healthUI.offsetX : -165);
        const healthUIRootY = this.cameras.main.height / 2 + (_CONFIG.healthUI ? _CONFIG.healthUI.offsetY : 110);

        const tireIconSize = 16; 
        const tireIconSpacing = 2;

        this.healthTextLabel = this.add.text(0, 0, 'Health:', { 
            fontSize: '12px', 
            fill: '#FFFF00',   
            backgroundColor: '#000000', 
            padding: { x: 0, y: 0 }, 
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: false, fill: true } 
        })
        .setOrigin(0, 0.5) 
        .setScrollFactor(0) 
        .setDepth(1000); 

        const totalIconsWidth = this.maxHealth * tireIconSize + (this.maxHealth - 1) * tireIconSpacing;

        const combinedWidth = this.healthTextLabel.displayWidth + tireIconSpacing + totalIconsWidth;

        this.healthTextLabel.x = healthUIRootX - (combinedWidth / 2);
        this.healthTextLabel.y = healthUIRootY; 

        this.healthIconsContainer = this.add.container(
            this.healthTextLabel.x + this.healthTextLabel.displayWidth + tireIconSpacing, 
            healthUIRootY 
        );
        this.healthIconsContainer.setScrollFactor(0).setDepth(1000);

        for (let i = 0; i < this.maxHealth; i++) {
            const tireIcon = this.add.image(i * (tireIconSize + tireIconSpacing), 0, 'tire') 
                .setOrigin(0, 0.5) 
                .setTint(0x00FF00); 

            const tireTexture = this.textures.get('tire');
            if (tireTexture && tireTexture.source[0] && tireTexture.source[0].width > 0) {
                tireIcon.setScale(tireIconSize / tireTexture.source[0].width);
            } else {
                console.warn("Tire texture data not fully loaded or has invalid width. Defaulting scale to 1.");
                tireIcon.setScale(1); 
            }

            this.healthIcons.push(tireIcon);
            this.healthIconsContainer.add(tireIcon);
        }

        this.updateHealthUI();

        // Speedometer UI 
        const speedometerX = this.cameras.main.width / 2 + (_CONFIG.speedometerUI ? _CONFIG.speedometerUI.offsetX : 70); 
        const speedometerY = this.cameras.main.height / 2 + (_CONFIG.speedometerUI ? _CONFIG.speedometerUI.offsetY : 100); 

        this.speedometerImage = this.add.image(speedometerX, speedometerY, 'speedometer')
            .setOrigin(0.5, 0.5) 
            .setScale(0.1) 
            .setScrollFactor(0) 
            .setDepth(999); 
        
        // Speedometer Needle
        const needleLength = 15; 
        this.speedometerNeedle = this.add.graphics({ lineStyle: { width: 0.8, color: 0xFF0000, alpha: 1 } }); 
        this.speedometerNeedle.setDepth(1000); 
        this.speedometerNeedle.setScrollFactor(0); 

        this.speedometerNeedle.beginPath();
        this.speedometerNeedle.moveTo(0, 0); 
        this.speedometerNeedle.lineTo(0, -needleLength); 
        this.speedometerNeedle.closePath();
        this.speedometerNeedle.strokePath();

        this.speedometerNeedle.x = speedometerX;
        this.speedometerNeedle.y = speedometerY + 8; 
        
        this.speedometerNeedle.setRotation(Phaser.Math.DegToRad(-135)); 
        
        // Add game over text
        this.gameOverText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'GAME OVER!', {
            fontSize: '64px', 
            fill: '#FF0000', 
            backgroundColor: '#000000',
            padding: { x: 30, y: 15 },
            shadow: { offsetX: 5, offsetY: 5, color: '#000', blur: 8, stroke: false, fill: true }
        })
        .setOrigin(0.5) 
        .setScrollFactor(0) 
        .setDepth(1002) 
        .setVisible(false); 

        // Text for "Moving to next level..."
        this.nextLevelText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 50, 'Moving to next level...', {
            fontSize: '32px',
            fill: '#FFFFFF',
            backgroundColor: '#000000',
            padding: { x: 15, y: 8 },
            shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5, stroke: false, fill: true }
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1001)
        .setVisible(false);

        // Start Button
        this.startButton = this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'play_button')
            .setOrigin(0.5)
            .setScale(0.5) 
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(1003); 

        this.startButton.on('pointerdown', this.startGame, this);

        // Retry Button
        this.retryButton = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 120, 'RETRY', {
            fontSize: '32px',
            fill: '#00FF00',
            backgroundColor: '#000000',
            padding: { x: 20, y: 10 },
            shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5, stroke: false, fill: true }
        })
        .setOrigin(0.5)
        .setInteractive()
        .setScrollFactor(0)
        .setDepth(1002)
        .setVisible(false);

        this.retryButton.on('pointerdown', this.retryGame, this);

        // Level text display
        this.levelText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2, 
            `Level ${this.level} !!`,
            {
                fontSize: '48px',
                fill: '#FFD700',
                backgroundColor: '#000',
                padding: { x: 20, y: 10 },
                shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(1005).setVisible(false);


        // Initially hide all game elements
        this.hideGameElements();

        // Draw debug grid if enabled
        if (this.showDebugGraphics) {
            this.drawDebugGrid(20); 
            this.validateAndDrawCorners(); 
        }

        this.updateCheckpointVisuals(); 
    }

    /**
     * Hides all game elements (player car, enemy cars, UI, etc.).
     */
    hideGameElements() {
        this.car.setVisible(false);
        this.enemyCars.forEach(enemyCar => enemyCar.setVisible(false));
        this.playerIcon.setVisible(false);
        this.playerLapText.setVisible(false);
        this.enemy1Icon.setVisible(false);
        this.player1Text.setVisible(false);
        this.enemy2Icon.setVisible(false);
        this.player2Text.setVisible(false);
        this.enemy3Icon.setVisible(false);
        this.player3Text.setVisible(false);
        this.healthTextLabel.setVisible(false);
        this.healthIconsContainer.setVisible(false);
        this.speedometerImage.setVisible(false);
        this.speedometerNeedle.setVisible(false);
        this.tireMarksGraphics.setVisible(false);
        this.checkpoints.forEach(cp => { if (cp.visualRect) cp.visualRect.setVisible(false); });
        this.nextLevelText.setVisible(false); 
        this.retryButton.setVisible(false); 
        this.levelText.setVisible(false); 
    }

    /**
     * Shows all game elements (player car, enemy cars, UI, etc.).
     */
    showGameElements() {
        this.car.setVisible(true);
        this.enemyCars.forEach(enemyCar => enemyCar.setVisible(true));
        this.playerIcon.setVisible(true);
        this.playerLapText.setVisible(true);
        this.enemy1Icon.setVisible(true);
        this.player1Text.setVisible(true);
        this.enemy2Icon.setVisible(true);
        this.player2Text.setVisible(true);
        this.enemy3Icon.setVisible(true);
        this.player3Text.setVisible(true);
        this.healthTextLabel.setVisible(true);
        this.healthIconsContainer.setVisible(true);
        this.speedometerImage.setVisible(true);
        this.speedometerNeedle.setVisible(true);
        this.tireMarksGraphics.setVisible(true);
        this.checkpoints.forEach(cp => { if (cp.visualRect) cp.visualRect.setVisible(true); });
        this.levelText.setVisible(true); 
    }

    /**
     * Displays the current level text with a fade-out animation.
     */
    showLevelText() {
        this.levelText.setText(`Level ${this.level} !!`);
        this.levelText.setAlpha(1).setVisible(true);
        this.tweens.add({
            targets: this.levelText,
            alpha: 0,
            duration: 1200,
            onComplete: () => this.levelText.setVisible(false)
        });
    }

    /**
     * Sets the enemy car speed based on the current level.
     * Speed increases with level but remains slightly below player's max speed.
     */
    setEnemyCarSpeedForLevel() {
        if (this.level < this.maxLevel) {
            // Increase linearly, but always less than player
            this.enemyCarSpeed = this.enemyCarBaseSpeed + (this.maxSpeed - 1.2) * ((this.level - 1) / (this.maxLevel - 1));
        } else {
            // At max level, enemy cars are a bit slower than player's max speed
            this.enemyCarSpeed = this.maxSpeed * 0.85;
        }
    }

    /**
     * Starts a new game. Resets player and enemy states, and displays game elements.
     */
    startGame() {
        this.isGameStarted = true;
        this.startButton.setVisible(false); 
        this.showGameElements(); 
        this.scene.resume(); 
        // Reset health and player car state for a fresh start
        this.health = this.maxHealth;
        this.updateHealthUI();
        this.car.lapCount = 0;
        // Claim checkpoint 0 at the start
        this.car.currentCheckpointIndex = 1; 
        this.car.collectedCheckpoints = new Set();
        this.car.collectedCheckpoints.add(0); 

        this.playerLapText.setText(`You: Lap ${this.car.lapCount}`); 

        // Reset enemy cars to their initial state for a new game
        this.enemyCars.forEach((enemyCar, index) => {
            enemyCar.currentCheckpointIndex = 0; 
            if (enemyCar.collectedCheckpoints) enemyCar.collectedCheckpoints.clear(); 
            
            // Initial path index for enemy cars
            const startIndex = Math.floor((index * this.trackPath.length) / this.enemyCars.length);
            if (this.trackPath.length === 0) {
                 console.warn("Track path is empty when trying to setup enemy cars. Skipping enemy car placement.");
                 return; 
            }
            const startNode = this.trackPath[startIndex];
            enemyCar.setPosition(startNode.worldX, startNode.worldY);
            const nextNodeIndex = (startIndex + 1) % this.trackPath.length;
            const nextNode = this.trackPath[nextNodeIndex];
            const angle = Phaser.Math.Angle.Between(startNode.worldX, startNode.worldY, nextNode.worldX, nextNode.worldY);
            enemyCar.setRotation(angle);

            if (index === 0) this.player1Text.setText(`Player 1: Lap ${enemyCar.lapCount}`);
            if (index === 1) this.player2Text.setText(`Player 2: Lap ${enemyCar.lapCount}`);
            if (index === 2) this.player3Text.setText(`Player 3: Lap ${enemyCar.lapCount}`);
        });

        this.gameOverText.setVisible(false); 
        if (this.winText) this.winText.setVisible(false); 
        if (this.nextLevelText) this.nextLevelText.setVisible(false); 
        this.retryButton.setVisible(false); 

        this.level = 1; 
        this.setEnemyCarSpeedForLevel();
        this.showLevelText();

        this.updateCheckpointVisuals(); 
    }

    /**
     * Retries the game from the beginning. Resets all game states.
     */
    retryGame() {
        this.isGameOver = false;
        this.isGameStarted = true;

        // Hide all end-game UI
        this.gameOverText.setVisible(false);
        if (this.winText) this.winText.setVisible(false);
        this.nextLevelText.setVisible(false);
        this.retryButton.setVisible(false);

        // Reset player car
        this.car.setPosition(this.carStartPoint.x, this.carStartPoint.y);
        this.car.setRotation(0); 
        this.matter.body.setVelocity(this.car.body, { x: 0, y: 0 });
        this.matter.body.setAngularVelocity(this.car.body, 0);
        this.health = this.maxHealth;
        this.updateHealthUI();
        this.car.lapCount = 0;
        this.car.currentCheckpointIndex = 1; 
        this.car.collectedCheckpoints = new Set();
        this.car.collectedCheckpoints.add(0); 

        this.playerLapText.setText(`You: Lap ${this.car.lapCount}`); 

        // Reset enemy cars
        this.enemyCars.forEach((enemyCar, index) => {
            const startIndex = Math.floor((index * this.trackPath.length) / this.enemyCars.length);
            if (this.trackPath.length === 0) {
                 console.warn("Track path is empty when trying to setup enemy cars. Skipping enemy car placement.");
                 return; 
            }
            const startNode = this.trackPath[startIndex];
            enemyCar.setPosition(startNode.worldX, startNode.worldY);
            
            const nextNodeIndex = (startIndex + 1) % this.trackPath.length;
            const nextNode = this.trackPath[nextNodeIndex];
            const angle = Phaser.Math.Angle.Between(startNode.worldX, startNode.worldY, nextNode.worldX, nextNode.worldY);
            enemyCar.setRotation(angle);

            this.matter.body.setVelocity(enemyCar.body, { x: 0, y: 0 });
            this.matter.body.setAngularVelocity(enemyCar.body, 0);
            enemyCar.lapCount = Phaser.Math.Between(0, 5); 
            enemyCar.currentCheckpointIndex = 0; 
            if (enemyCar.collectedCheckpoints) enemyCar.collectedCheckpoints.clear(); 
            
            if (index === 0) this.player1Text.setText(`Player 1: Lap ${enemyCar.lapCount}`);
            if (index === 1) this.player2Text.setText(`Player 2: Lap ${enemyCar.lapCount}`); 
            if (index === 2) this.player3Text.setText(`Player 3: Lap ${enemyCar.lapCount}`); 
        });

        // Reset checkpoint visuals
        this.checkpoints.forEach(cp => {
            if (cp.visualRect) {
                cp.visualRect.setFillStyle(0x888888, 0.2); 
            }
        });

        this.level = 1; // Reset level to 1 on retry
        this.setEnemyCarSpeedForLevel();
        this.showLevelText();

        this.showGameElements(); 
        this.scene.resume(); 
        if (this.sounds.background && this.sounds.background.key !== '__missing') {
            this.sounds.background.setVolume(0.3).setLoop(true).play();
        }
        this.updateCheckpointVisuals(); 
    }

    update(time, delta) { 
        if (!this.isGameStarted || this.isGameOver) { 
            return;
        }

        this.handleCarMovement();
        this.handleTireMarks(time); 
        this.drawFadingTireMarks(time); 

        if (this.isInvincible) {
            this.blinkTimer += delta;
            if (this.blinkTimer >= this.blinkInterval) {
                this.car.setVisible(!this.car.visible); 
                this.blinkTimer = 0; 
            }
        } else {
            if (!this.car.visible) {
                this.car.setVisible(true);
            }
        }

        // Update speedometer needle
        this.updateSpeedometerNeedle();

        // Update enemy cars
        this.enemyCars.forEach(enemyCar => {
            this.moveEnemyCar(enemyCar);
        });

        // Check win condition every frame (can be optimized to check only on lap completion)
        this.checkWinCondition();
    }

    /**
     * Helper function to convert grid coordinates to a unique string key.
     * @param {number} x - Grid X coordinate.
     * @param {number} y - Grid Y coordinate.
     * @returns {string} Unique key for the grid position.
     */
    keyFor(x, y) {
        return `${x},${y}`;
    }

    /**
     * Generates a random loop track using a grid-based approach.
     * @param {number} maxSteps - Maximum number of segments to try and generate.
     * @param {number} gridSize - The size of the square grid for track generation.
     * @returns {Array<Object>} An array of track segment objects with grid coordinates and direction.
     */
    _generateLoopTrack(maxSteps = 80, gridSize = 40) {
        const visited = new Set();
        const path = [];

        const start = { x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2), dirIndex: 0 };

        let pos = { ...start };
        let currentStraightCount = 0;
        let currentCurveCount = 0;
        let lastMoveWasStraight = true; 

        const minLoopLength = 16; 

        const minStraight = 2; 
        const maxStraight = 8;
        const minCurve = 1;
        const maxCurve = 3;

        visited.add(this.keyFor(pos.x, pos.y));
        path.push({ ...pos }); 

        // Special handling for the very first move to ensure it's a curve
        if (path.length === 1) { 
            let firstMoveOptions = [];
            for (let d = 0; d < this.DIRECTIONS.length; d++) {
                const dir = this.DIRECTIONS[d];
                const next = {
                    x: pos.x + dir.x,
                    y: pos.y + dir.y,
                    dirIndex: d
                };

                const isUturn = (next.dirIndex === (pos.dirIndex + 2) % 4);
                if (isUturn) continue;

                const key = this.keyFor(next.x, next.y);
                if (next.x < 0 || next.y < 0 || next.x >= gridSize || next.y >= gridSize || visited.has(key)) {
                    continue;
                }

                if (next.dirIndex !== pos.dirIndex) {
                    firstMoveOptions.push(next);
                }
            }

            if (firstMoveOptions.length === 0) {
                console.warn("Could not find a valid first curved move. Track generation might fail. Returning empty path.");
                return []; 
            }
            
            const chosenFirstMove = firstMoveOptions[Math.floor(Math.random() * firstMoveOptions.length)]; 
            visited.add(this.keyFor(chosenFirstMove.x, chosenFirstMove.y));
            path.push(chosenFirstMove);
            pos = chosenFirstMove;
            lastMoveWasStraight = false; 
            currentCurveCount = 1;
            currentStraightCount = 0;
        }

        for (let i = path.length; i < maxSteps; i++) { 
            const currentPathLength = path.length;
            
            let potentialMoves = []; 

            for (let d = 0; d < this.DIRECTIONS.length; d++) { 
                const dir = this.DIRECTIONS[d];
                const next = {
                    x: pos.x + dir.x,
                    y: pos.y + dir.y,
                    dirIndex: d
                };

                const isUturn = (next.dirIndex === (pos.dirIndex + 2) % 4);
                if (isUturn) continue;

                const key = this.keyFor(next.x, next.y);
                
                const canCloseLoop = (next.x === start.x && next.y === start.y && (currentPathLength + 1) >= minLoopLength);

                if (!canCloseLoop && (next.x < 0 || next.y < 0 || next.x >= gridSize || next.y >= gridSize || visited.has(key))) {
                    continue;
                }

                const isStraightMove = (next.dirIndex === pos.dirIndex);
                
                if (!lastMoveWasStraight && !isStraightMove) {
                    continue; 
                }

                let movePriority = 0; 

                if (canCloseLoop) {
                    movePriority = -1000; 
                } else {
                    if (isStraightMove) {
                        if (currentStraightCount >= maxStraight) {
                            continue; 
                        }
                        if (!lastMoveWasStraight) {
                            movePriority -= 500; 
                        }
                    } else { 
                        if (currentCurveCount >= maxCurve) {
                            continue; 
                        }
                        if (lastMoveWasStraight && currentStraightCount < minStraight) {
                            movePriority += 100; 
                        }
                    }

                    const distanceToStart = Math.abs(next.x - start.x) + Math.abs(next.y - start.y);
                    const remainingSteps = maxSteps - i;
                    
                    if (remainingSteps < maxSteps * 0.25) { 
                        movePriority += distanceToStart * 5;
                    } else if (remainingSteps < maxSteps * 0.6) { 
                        movePriority += distanceToStart * 0.5;
                    }
                    
                    movePriority += Math.random(); 
                }

                potentialMoves.push({ next, priority: movePriority });
            }

            potentialMoves.sort((a, b) => a.priority - b.priority); 

            let next = null;
            if (potentialMoves.length > 0) {
                next = potentialMoves[0].next;
            }

            if (next === null) {
                // Backtracking logic
                if (path.length > 1) {
                    const popped = path.pop();
                    visited.delete(this.keyFor(popped.x, popped.y));
                    
                    pos = path[path.length - 1]; 
                    
                    currentStraightCount = 0; 
                    currentCurveCount = 0; 
                    if (path.length > 0) { 
                        const prevPos = path[path.length - 1];
                        lastMoveWasStraight = (pos.dirIndex === prevPos.dirIndex);
                        
                        for (let k = path.length - 1; k >= 0; k--) {
                            if (k === 0) break; 
                            const segmentPrev = path[k-1];
                            const segmentCurrent = path[k];
                            if (segmentCurrent.dirIndex === segmentPrev.dirIndex) {
                                currentStraightCount++;
                                currentCurveCount = 0;
                            } else {
                                currentCurveCount++;
                                currentStraightCount = 0;
                                break; 
                            }
                        }
                    } else { 
                        currentStraightCount = 0;
                        currentCurveCount = 0;
                        lastMoveWasStraight = true; 
                    }
                    i--; 
                    continue;
                }
                console.warn("Track generation stuck, cannot find a valid path or backtrack further.");
                return []; 
            }

            visited.add(this.keyFor(next.x, next.y));
            path.push(next);

            lastMoveWasStraight = (next.dirIndex === pos.dirIndex);
            if (lastMoveWasStraight) {
                currentStraightCount++;
                currentCurveCount = 0;
            } else {
                currentCurveCount++;
                currentStraightCount = 0;
            }
            pos = next;

            if (next.x === start.x && next.y === start.y && (currentPathLength + 1) >= minLoopLength) {
                break;
            }
        }
        
        // Final validation
        for (let k = 0; k < path.length; k++) {
            const currentSegment = path[k];
            const nextSegment = path[(k + 1) % path.length]; 

            const prevSegment = (k === 0) ? path[path.length - 1] : path[k - 1]; 
            const wasCurrentSegmentCurve = (currentSegment.dirIndex !== prevSegment.dirIndex);

            const isNextSegmentStraight = (nextSegment.dirIndex === currentSegment.dirIndex);

            if (wasCurrentSegmentCurve && !isNextSegmentStraight) {
                console.error(`VALIDATION FAILED: Rule "straight after curve" violated at segment index ${k}.`);
                return []; 
            }
        }

        return path;
    }

    /**
     * Generates a random track and places its visual and physics elements.
     */
    generateRandomTrack() {
        // Clear existing road segments and physics bodies
        if (this.roadSegments) {
            this.roadSegments.forEach(segment => {
                if (segment.body) this.matter.world.remove(segment.body); 
                segment.destroy(); 
            });
        }
        this.roadSegments = [];
        // Clear existing checkpoints
        if (this.checkpoints) {
            this.checkpoints.forEach(cp => {
                this.matter.world.remove(cp);
                if (cp.visualRect) cp.visualRect.destroy(); 
            });
        }
        this.checkpoints = [];
        this.n2CheckpointBody = null; 

        this.trackPath = []; 

        let generatedGridPath = null;
        let attempts = 0;
        const maxGenerationAttempts = 200; 
        const MIN_REQUIRED_PATH_LENGTH = 16; 

        while (!generatedGridPath && attempts < maxGenerationAttempts) {
            attempts++;
            const tempPath = this._generateLoopTrack(80, 40); 

            if (tempPath && tempPath.length > 0) {
                const startNode = tempPath[0];
                const endNode = tempPath[tempPath.length - 1]; 
                if (endNode.x === startNode.x && endNode.y === startNode.y && tempPath.length >= MIN_REQUIRED_PATH_LENGTH) {
                    generatedGridPath = tempPath;
                }
            }
        }

        if (!generatedGridPath) {
            console.error("Failed to generate a valid closed track after maximum attempts. Falling back to a hardcoded minimal path.");
            const startX = Math.floor(40 / 2); 
            const startY = Math.floor(40 / 2);
            generatedGridPath = [
                { x: startX, y: startY, dirIndex: 0 }, 
                { x: startX + 1, y: startY, dirIndex: 0 },
                { x: startX + 1, y: startY + 1, dirIndex: 1 },
                { x: startX, y: startY + 1, dirIndex: 2 },
                { x: startX, y: startY, dirIndex: 3 }
            ];
        }

        this.trackPath = generatedGridPath; 

        let minTrackX = Infinity, minTrackY = Infinity;
        let maxTrackX = -Infinity, maxTrackY = -Infinity;

        if (this.trackPath.length === 0) {
            console.warn("Generated an empty track path. Using default start point.");
            this.carStartPoint = { x: 1280 / 2, y: 720 / 2 };
            return;
        }

        for (let i = 0; i < this.trackPath.length; i++) { 
            const curr = this.trackPath[i];
            
            const fromDir = curr.dirIndex; 

            const nextNode = this.trackPath[(i + 1) % this.trackPath.length];
            const toDir = nextNode.dirIndex;

            const worldX = curr.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const worldY = curr.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            let imageKey;
            let imageRotationDegrees;
            let segmentTypeForBoundaries;

            if (fromDir === toDir) { 
                imageKey = 'straightroad';
                imageRotationDegrees = fromDir * 90;
            } else { 
                imageKey = 'roadcorner';
                const curveKey = `${fromDir}-${toDir}`;
                imageRotationDegrees = this.CURVE_ANGLES[curveKey];
                if (imageRotationDegrees === undefined) {
                    const reversed = `${toDir}-${fromDir}`;
                    if (this.CURVE_ANGLES[reversed] !== undefined) {
                        imageRotationDegrees = (this.CURVE_ANGLES[reversed] + 180) % 360;
                    } else {
                        console.warn(`Missing CURVE_ANGLES for ${curveKey} and its reverse. Defaulting to 0 degrees.`);
                        imageRotationDegrees = 0;
                    }
                }
            }

            if (i === this.trackPath.length - 1 || i === this.trackPath.length - 2) {
                imageKey = 'roadcorner';
                imageRotationDegrees = 0; 
            }

            if (fromDir === toDir) {
                segmentTypeForBoundaries = 'straight';
            } else {
                segmentTypeForBoundaries = 'curved';
            }
            
            if (i !== this.trackPath.length - 1) {
                this.addRoadBoundaries(worldX, worldY, Phaser.Math.DegToRad(imageRotationDegrees), segmentTypeForBoundaries, fromDir, toDir, i);
            }


            const roadImage = this.add.image(worldX, worldY, imageKey)
                .setOrigin(0.5) 
                .setDisplaySize(this.TILE_SIZE, this.TILE_SIZE)
                .setRotation(Phaser.Math.DegToRad(imageRotationDegrees))
                .setDepth(1);
            this.roadSegments.push(roadImage);

            this.trackPath[i].worldX = worldX;
            this.trackPath[i].worldY = worldY;
            this.trackPath[i].fromDir = fromDir; 
            this.trackPath[i].toDir = toDir;     

            minTrackX = Math.min(minTrackX, worldX - this.TILE_SIZE / 2);
            minTrackY = Math.min(minTrackY, worldY - this.TILE_SIZE / 2);
            maxTrackX = Math.max(maxTrackX, worldX + this.TILE_SIZE / 2);
            maxTrackY = Math.max(maxTrackY, worldY + this.TILE_SIZE / 2);
        }

        this.checkpoints = this.createCheckpoints(this.trackPath);

        this.worldWidth = (maxTrackX - minTrackX) + this.grassTileSize * 2;
        this.worldHeight = (maxTrackY - minTrackY) + this.grassTileSize * 2;

        this.matter.world.setBounds(minTrackX - this.grassTileSize, minTrackY - this.grassTileSize, this.worldWidth, this.worldHeight);
        this.camera.setBounds(minTrackX - this.grassTileSize, minTrackY - this.grassTileSize, this.worldWidth, this.worldHeight);

        if (this.trackPath.length > 0) {
            this.carStartPoint = { x: this.trackPath[0].worldX, y: this.trackPath[0].worldY };
        } else {
            this.carStartPoint = { x: this.worldWidth / 2, y: this.worldHeight / 2 };
            console.warn("Track path is empty, car starting at default center.");
        }
    }

    /**
     * Adds static Matter.js bodies to represent the track boundaries.
     */
    addRoadBoundaries(centerX, centerY, imageAngleRad, type, fromDir = 0, toDir = 0, segmentIndex = 0) {
        const boundaryThickness = 10;
        const halfRoadWidth = this.roadWidth / 2;
        const halfTile = this.TILE_SIZE / 2;
        const boundaryColor = (segmentIndex % 2 === 0) ? this.boundaryColor1 : this.boundaryColor2; 
        const boundaryStrokeColor = 0x404040; 
        const boundaryDepth = 1.1; 

        if (type === 'straight') {
            const perpVector = new Phaser.Math.Vector2(
                Math.cos(imageAngleRad + Math.PI / 2),
                Math.sin(imageAngleRad + Math.PI / 2)
            );
            
            // Outer boundary (Matter.js body)
            this.matter.add.rectangle(
                centerX + perpVector.x * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                centerY + perpVector.y * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                this.TILE_SIZE, boundaryThickness, 
                {
                    isStatic: true,
                    angle: imageAngleRad,
                    collisionFilter: { category: this.CATEGORY_BOUNDARY, mask: this.CATEGORY_CAR | this.CATEGORY_ENEMY_CAR }, 
                    label: 'outer_track_boundary'
                }
            );
            // Outer boundary (Visual)
            this.add.rectangle(
                centerX + perpVector.x * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                centerY + perpVector.y * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                this.TILE_SIZE, boundaryThickness,
                boundaryColor
            )
            .setStrokeStyle(1, boundaryStrokeColor)
            .setRotation(imageAngleRad)
            .setDepth(boundaryDepth);

            // Inner boundary (Matter.js body)
            this.matter.add.rectangle(
                centerX - perpVector.x * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                centerY - perpVector.y * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                this.TILE_SIZE, boundaryThickness, 
                {
                    isStatic: true,
                    angle: imageAngleRad,
                    collisionFilter: { category: this.CATEGORY_BOUNDARY, mask: this.CATEGORY_CAR | this.CATEGORY_ENEMY_CAR }, 
                    label: 'inner_track_boundary'
                }
            );
            // Inner boundary (Visual)
            this.add.rectangle(
                centerX - perpVector.x * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                centerY - perpVector.y * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                this.TILE_SIZE, boundaryThickness,
                boundaryColor
            )
            .setStrokeStyle(1, boundaryStrokeColor)
            .setRotation(imageAngleRad)
            .setDepth(boundaryDepth);

        }
        else if (type === 'curved') {
            const boundaryWidth = boundaryThickness;
            const curveKey = `${fromDir}-${toDir}`;
            const adjustedPadding = this.boundaryPadding - 2; 

            let horizOuterX, horizOuterY; 
            let vertOuterX, vertOuterY;  

            switch (curveKey) {
                case '3-2': 
                    horizOuterX = centerX;
                    horizOuterY = centerY - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterX = centerX + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                case '2-1': 
                    horizOuterX = centerX;
                    horizOuterY = centerY - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterX = centerX - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                case '1-0': 
                    horizOuterX = centerX;
                    horizOuterY = centerY + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterX = centerX - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                case '0-3': 
                    horizOuterX = centerX;
                    horizOuterY = centerY + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterX = centerX + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                case '2-3': 
                    horizOuterX = centerX;
                    horizOuterY = centerY + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterX = centerX - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                case '1-2': 
                    horizOuterX = centerX;
                    horizOuterY = centerY + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterX = centerX + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                case '0-1': 
                    horizOuterX = centerX;
                    horizOuterY = centerY - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterX = centerX + halfTile - boundaryWidth / 2 + adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                case '3-0': 
                    horizOuterX = centerX;
                    horizOuterY = centerY - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterX = centerX - halfTile + boundaryWidth / 2 - adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                default:
                    console.warn(`Unknown corner direction: ${curveKey}`);
                    return;
            }

            // Horizontal outer boundary (Matter.js body)
            this.matter.add.rectangle(
                horizOuterX, horizOuterY,
                this.TILE_SIZE, boundaryWidth, 
                {
                    isStatic: true,
                    angle: 0,
                    collisionFilter: { category: this.CATEGORY_BOUNDARY, mask: this.CATEGORY_CAR | this.CATEGORY_ENEMY_CAR }, 
                    label: 'corner_boundary_horizontal_outer'
                }
            );
            // Horizontal outer boundary (Visual)
            this.add.rectangle(
                horizOuterX, horizOuterY,
                this.TILE_SIZE, boundaryWidth,
                boundaryColor
            )
            .setStrokeStyle(1, boundaryStrokeColor)
            .setDepth(boundaryDepth);

            // Vertical outer boundary (Matter.js body)
            this.matter.add.rectangle(
                vertOuterX, vertOuterY,
                boundaryWidth, this.TILE_SIZE, 
                {
                    isStatic: true,
                    angle: 0,
                    collisionFilter: { category: this.CATEGORY_BOUNDARY, mask: this.CATEGORY_CAR | this.CATEGORY_ENEMY_CAR }, 
                    label: 'corner_boundary_vertical_outer'
                }
            );
            // Vertical outer boundary (Visual)
            this.add.rectangle(
                vertOuterX, vertOuterY,
                boundaryWidth, this.TILE_SIZE,
                boundaryColor
            )
            .setStrokeStyle(1, boundaryStrokeColor)
            .setDepth(boundaryDepth);
        }
    }

    /**
     * Creates a grass background based on the calculated world dimensions.
     */
    createGrassBackground() {
        const numTilesX = Math.ceil(this.worldWidth / this.grassTileSize);
        const numTilesY = Math.ceil(this.worldHeight / this.grassTileSize);

        let minTrackX = Infinity, minTrackY = Infinity;
        if (this.roadSegments.length > 0) {
            this.roadSegments.forEach(segment => {
                minTrackX = Math.min(minTrackX, segment.x - segment.displayWidth / 2);
                minTrackY = Math.min(minTrackY, segment.y - segment.displayHeight / 2);
            });
        } else {
            minTrackX = this.camera.worldView.x;
            minTrackY = this.camera.worldView.y;
        }

        const startGrassX = minTrackX - this.grassTileSize;
        const startGrassY = minTrackY - this.grassTileSize;

        for (let y = 0; y < numTilesY; y++) {
            for (let x = 0; x < numTilesX; x++) {
                this.add.image(
                    startGrassX + x * this.grassTileSize + this.grassTileSize / 2,
                    startGrassY + y * this.grassTileSize + this.grassTileSize / 2,
                    'Grass'
                )
                .setOrigin(0.5)
                .setDisplaySize(this.grassTileSize, this.grassTileSize)
                .setDepth(0); 
            }
        }
    }

    /**
     * Sets up the player car.
     */
    setupCar() {
        this.camera.setZoom(4.0); 
        if (!this.carStartPoint) {
            console.warn("carStartPoint not defined, using default for car placement.");
            this.carStartPoint = { x: 1280 / 2, y: 720 / 2 };
        }

        this.car = this.matter.add.image(this.carStartPoint.x, this.carStartPoint.y, 'player');
        this.car.setOrigin(0.5).setScale(0.018); 
        this.car.setBody({
            type: 'rectangle', 
            width: this.car.width * this.car.scaleX,
            height: this.car.height * this.car.scaleY,
            chamfer: { radius: 8 } 
        }, {
            friction: 0.08, 
            frictionStatic: 0.15, 
            frictionAir: 0.02, 
            restitution: 0.0,
            collisionFilter: {
                category: this.CATEGORY_CAR,
                mask: this.CATEGORY_BOUNDARY | this.CATEGORY_CHECKPOINT | this.CATEGORY_ENEMY_CAR 
            }
        });
        this.car.setMass(10);
        this.car.setDepth(3); 
        
        if (this.trackPath.length > 1) { 
            const firstPathNode = this.trackPath[0];
            const secondPathNode = this.trackPath[1];
            const angle = Phaser.Math.Angle.Between(firstPathNode.worldX, firstPathNode.worldY, secondPathNode.worldX, secondPathNode.worldY);
            this.car.setRotation(angle);
        } else if (this.trackPath.length === 1) {
            this.car.setRotation(0); 
        }
        this.car.currentCheckpointIndex = 0; 
        this.car.lapCount = 0; 

        this.prevRearLeftPos = this.getRearLeftWheelPosition();
        this.prevRearRightPos = this.getRearRightWheelPosition();
    }

    /**
     * Sets up enemy cars on the track.
     */
    setupEnemyCars() {
        const numEnemyCars = 3; 
        const enemyCarImageKeys = ['enemy_1', 'enemy_2', 'enemy_3']; 

        const actualNumEnemyCars = Math.min(numEnemyCars, enemyCarImageKeys.length);

        if (this.trackPath.length < actualNumEnemyCars) {
            console.warn("Not enough track segments to place all enemy cars.");
            return;
        }

        for (let i = 0; i < actualNumEnemyCars; i++) {
            const startIndex = Math.floor((i * this.trackPath.length) / actualNumEnemyCars);
            const startNode = this.trackPath[startIndex];

            const enemyImageKey = enemyCarImageKeys[i];

            const enemyCar = this.matter.add.image(startNode.worldX, startNode.worldY, enemyImageKey); 
            enemyCar.setOrigin(0.5).setScale(0.018); 
            enemyCar.setBody({
                type: 'rectangle',
                width: enemyCar.width * enemyCar.scaleX,
                height: enemyCar.height * enemyCar.scaleY,
                chamfer: { radius: 8 }
            }, {
                friction: 0.08,
                frictionStatic: 0.15,
                frictionAir: 0.02,
                restitution: 0.0,
                collisionFilter: {
                    category: this.CATEGORY_ENEMY_CAR,
                    mask: this.CATEGORY_CAR | this.CATEGORY_BOUNDARY | this.CATEGORY_CHECKPOINT 
                }
            });
            enemyCar.setMass(10); 
            enemyCar.setDepth(3);

            enemyCar.pathIndex = startIndex;
            enemyCar.targetPoint = null; 
            enemyCar.currentSegmentDirection = startNode.dirIndex; 
            enemyCar.currentCheckpointIndex = 0; 
            enemyCar.lapCount = Phaser.Math.Between(0, 5); 
            
            enemyCar.offsetMagnitude = Phaser.Math.Between(this.roadWidth / 8, this.roadWidth / 4); 
            enemyCar.offsetChangeRate = Phaser.Math.FloatBetween(0.005, 0.02); 
            enemyCar.offsetPhase = Phaser.Math.Between(0, 2 * Math.PI); 

            enemyCar.isRecovering = false;
            enemyCar.recoveryTimer = 0;

            const nextNodeIndex = (startIndex + 1) % this.trackPath.length;
            const nextNode = this.trackPath[nextNodeIndex];
            const angle = Phaser.Math.Angle.Between(startNode.worldX, startNode.worldY, nextNode.worldX, nextNode.worldY);
            enemyCar.setRotation(angle);

            this.enemyCars.push(enemyCar);
            console.log(`Enemy car ${i} created at: (${startNode.worldX}, ${startNode.worldY}) with image: ${enemyImageKey}`);

            if (i === 0) this.player1Text.setText(`Player 1: Lap ${enemyCar.lapCount}`);
            if (i === 1) this.player2Text.setText(`Player 2: Lap ${enemyCar.lapCount}`); 
            if (i === 2) this.player3Text.setText(`Player 3: Lap ${enemyCar.lapCount}`); 
        }
    }

    /**
     * Moves an individual enemy car along the track path.
     * @param {Phaser.GameObjects.Image} enemyCar - The enemy car object.
     */
    moveEnemyCar(enemyCar) {
        if (!this.trackPath || this.trackPath.length === 0) return;

        const currentSegment = this.trackPath[enemyCar.pathIndex];
        const nextSegmentIndex = (enemyCar.pathIndex + 1) % this.trackPath.length;
        const nextSegment = this.trackPath[nextSegmentIndex];

        const nextSegmentCenter = new Phaser.Math.Vector2(nextSegment.worldX, nextSegment.worldY);

        const segmentDir = new Phaser.Math.Vector2(nextSegment.worldX - currentSegment.x, nextSegment.worldY - currentSegment.y).normalize();

        const lateralDir = new Phaser.Math.Vector2(-segmentDir.y, segmentDir.x); 

        enemyCar.offsetPhase = (enemyCar.offsetPhase + enemyCar.offsetChangeRate);
        if (enemyCar.offsetPhase > 2 * Math.PI) {
            enemyCar.offsetPhase -= 2 * Math.PI; 
        }
        const currentOffset = enemyCar.offsetMagnitude * Math.sin(enemyCar.offsetPhase);

        enemyCar.targetPoint = nextSegmentCenter.clone().add(lateralDir.scale(currentOffset));

        const distanceToTarget = Phaser.Math.Distance.Between(enemyCar.x, enemyCar.y, enemyCar.targetPoint.x, enemyCar.targetPoint.y);
        const threshold = 10; 

        if (distanceToTarget < threshold) {
            enemyCar.pathIndex = nextSegmentIndex;
            enemyCar.currentSegmentDirection = nextSegment.dirIndex;
        }

        let effectiveEnemySpeed = this.enemyCarSpeed;
        if (enemyCar.isRecovering) {
            effectiveEnemySpeed *= this.ENEMY_RECOVERY_SPEED_MULTIPLIER;
            enemyCar.recoveryTimer -= this.game.loop.delta; 
            if (enemyCar.recoveryTimer <= 0) {
                enemyCar.isRecovering = false;
                enemyCar.recoveryTimer = 0;
            }
        }

        const direction = new Phaser.Math.Vector2(enemyCar.targetPoint.x - enemyCar.x, enemyCar.targetPoint.y - enemyCar.y).normalize();

        const forceX = direction.x * effectiveEnemySpeed * enemyCar.body.mass * 0.001;
        const forceY = direction.y * effectiveEnemySpeed * enemyCar.body.mass * 0.001;
        this.matter.body.applyForce(enemyCar.body, enemyCar.body.position, { x: forceX, y: forceY });

        const currentSpeed = this.matter.vector.magnitude(enemyCar.body.velocity);
        if (currentSpeed > effectiveEnemySpeed) {
            const ratio = effectiveEnemySpeed / currentSpeed;
            this.matter.body.setVelocity(enemyCar.body, { x: enemyCar.body.velocity.x * ratio, y: enemyCar.body.velocity.y * ratio });
        }

        const angle = Phaser.Math.Angle.Between(enemyCar.x, enemyCar.y, enemyCar.targetPoint.x, enemyCar.targetPoint.y);
        enemyCar.setRotation(angle);
    }

    /**
     * Sets up collision handling for the game.
     */
    setupCollisions() {
    this.matter.world.on('collisionstart', (event) => {
        event.pairs.forEach((pair) => { 
            const { bodyA, bodyB } = pair;
            
            let carBody = null;
            let otherBody = null;

            if (bodyA.gameObject && (bodyA.gameObject === this.car || this.enemyCars.includes(bodyA.gameObject))) {
                carBody = bodyA;
                otherBody = bodyB;
            } else if (bodyB.gameObject && (bodyB.gameObject === this.car || this.enemyCars.includes(bodyB.gameObject))) {
                carBody = bodyB;
                otherBody = bodyA;
            }

            if (carBody) {
                if (otherBody.label === 'checkpoint') {
                    this.handleCheckpoint(carBody.gameObject, otherBody);
                } else if (otherBody.collisionFilter.category === this.CATEGORY_BOUNDARY) {
                    const carVelocity = new Phaser.Math.Vector2(carBody.velocity.x, carBody.velocity.y);
                    const otherVelocity = new Phaser.Math.Vector2(otherBody.velocity.x, otherBody.velocity.y);
                    const relativeVelocity = carVelocity.subtract(otherVelocity);
                    
                    const impactSpeed = relativeVelocity.length();
                    
                    if (impactSpeed > 5) { 
                        if (this.sounds.damage && this.sounds.damage.key !== '__missing') { 
                            this.sounds.damage.play(); 
                        }
                        
                        if (carBody.gameObject === this.car) { 
                            this.takeDamage(1); 

                            if (!this.isInvincible) {
                                this.isInvincible = true;
                                this.car.setTint(0xff0000); 
                            }
                            
                            if (this.invincibilityTimerEvent) {
                                this.invincibilityTimerEvent.remove(false); 
                            }

                            this.invincibilityTimerEvent = this.time.addEvent({
                                delay: this.invincibilityDuration,
                                callback: () => {
                                    this.isInvincible = false;
                                    this.car.clearTint(); 
                                    this.car.setVisible(true); 
                                    this.invincibilityTimerEvent = null; 
                                },
                                callbackScope: this,
                                loop: false
                            });
                        }

                        const dampingFactor = 0.4; 
                        this.matter.body.setVelocity(carBody, {
                            x: carBody.velocity.x * dampingFactor,
                            y: carBody.velocity.y * dampingFactor
                        });

                        const currentCarVelocity = new Phaser.Math.Vector2(carBody.velocity.x, carBody.velocity.y);
                        const directionOfTravel = currentCarVelocity.normalize();
                        const bounceBackForceMagnitude = 0.02 * impactSpeed; 
                        this.matter.body.applyForce(carBody, carBody.position, {
                            x: -directionOfTravel.x * bounceBackForceMagnitude,
                            y: -directionOfTravel.y * bounceBackForceMagnitude
                        });
                    } else if (impactSpeed > 1) {
                        if (this.sounds.damage && this.sounds.damage.key !== '__missing') {
                            this.sounds.damage.setVolume(0.3).play();
                        }
                    }
                    const currentCarVelocity = carBody.velocity;
                    const carAngle = carBody.gameObject.rotation; 

                    const forwardVectorX = Math.cos(carAngle);
                    const forwardVectorY = Math.sin(carAngle);

                    const forwardSpeed = currentCarVelocity.x * forwardVectorX + currentCarVelocity.y * forwardVectorY;

                    const newVelocityX = forwardVectorX * forwardSpeed;
                    const newVelocityY = forwardVectorY * forwardSpeed;

                    this.matter.body.setVelocity(carBody, { x: newVelocityX, y: newVelocityY });
                    this.matter.body.setAngularVelocity(carBody, 0); 
                } else if (otherBody.collisionFilter.category === this.CATEGORY_ENEMY_CAR && carBody.gameObject === this.car) {
                    const carVelocity = new Phaser.Math.Vector2(carBody.velocity.x, carBody.velocity.y);
                    const enemyVelocity = new Phaser.Math.Vector2(otherBody.velocity.x, otherBody.velocity.y);
                    const relativeVelocity = carVelocity.subtract(enemyVelocity);
                    const impactSpeed = relativeVelocity.length();

                    if (impactSpeed > 2) { 
                        if (this.sounds.damage && this.sounds.damage.key !== '__missing') {
                            this.sounds.damage.play();
                        }
                        this.takeDamage(1); 

                        const dampingFactor = 0.6; 
                        this.matter.body.setVelocity(carBody, {
                            x: carBody.velocity.x * dampingFactor,
                            y: carBody.velocity.y * dampingFactor
                        });
                        this.matter.body.setVelocity(otherBody, {
                            x: otherBody.velocity.x * dampingFactor,
                            y: otherBody.velocity.y * dampingFactor
                        });

                        const collisionNormal = pair.collision.normal;
                        const knockbackForce = 0.015 * impactSpeed; 
                        this.matter.body.applyForce(carBody, carBody.position, { 
                            x: collisionNormal.x * knockbackForce,
                            y: collisionNormal.y * knockbackForce
                        });
                        this.matter.body.applyForce(otherBody, otherBody.position, { 
                            x: -collisionNormal.x * knockbackForce, 
                            y: -collisionNormal.y * knockbackForce
                        });

                        if (otherBody.gameObject && !otherBody.gameObject.isRecovering) {
                            otherBody.gameObject.isRecovering = true;
                            otherBody.gameObject.recoveryTimer = this.ENEMY_RECOVERY_DURATION;
                        }
                    }
                    const currentCarVelocity = carBody.velocity;
                    const carAngle = this.car.rotation; 

                    const forwardVectorX = Math.cos(carAngle);
                    const forwardVectorY = Math.sin(carAngle);

                    const forwardSpeed = currentCarVelocity.x * forwardVectorX + currentCarVelocity.y * forwardVectorY;

                    const newVelocityX = forwardVectorX * forwardSpeed;
                    const newVelocityY = forwardVectorY * forwardSpeed;

                    this.matter.body.setVelocity(carBody, { x: newVelocityX, y: newVelocityY });
                    this.matter.body.setAngularVelocity(carBody, 0); 
                }
                else if (otherBody.collisionFilter.category === this.CATEGORY_ENEMY_CAR && carBody.gameObject !== this.car) {
                    const dampingFactor = 0.6; 
                    this.matter.body.setVelocity(carBody, {
                        x: carBody.velocity.x * dampingFactor,
                        y: carBody.velocity.y * dampingFactor
                    });
                    this.matter.body.setVelocity(otherBody, {
                        x: otherBody.velocity.x * dampingFactor,
                        y: otherBody.velocity.y * dampingFactor
                    });

                    const collisionNormal = pair.collision.normal;
                    const knockbackForce = 0.015 * impactSpeed; 
                    this.matter.body.applyForce(carBody, carBody.position, { 
                        x: collisionNormal.x * knockbackForce,
                        y: collisionNormal.y * knockbackForce
                    });
                    this.matter.body.applyForce(otherBody, otherBody.position, { 
                        x: -collisionNormal.x * knockbackForce, 
                        y: -collisionNormal.y * knockbackForce
                    });

                    if (carBody.gameObject && !carBody.gameObject.isRecovering) {
                        carBody.gameObject.isRecovering = true;
                        carBody.gameObject.recoveryTimer = this.ENEMY_RECOVERY_DURATION;
                    }
                    if (otherBody.gameObject && !otherBody.gameObject.isRecovering) {
                        otherBody.gameObject.isRecovering = true;
                        otherBody.gameObject.recoveryTimer = this.ENEMY_RECOVERY_DURATION;
                    }
                }
            }
        }); 
    });
}


    /**
     * Reduces the player's health and updates the health UI. Calls gameOver if health drops to 0.
     * @param {number} amount - The amount of health to deduct.
     */
    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health); 
        this.updateHealthUI(); 
        if (this.health <= 0) {
            this.gameOver();
        }
    }

    /**
     * Updates the visual representation of the player's health using tire icons.
     */
    updateHealthUI() {
        for (let i = 0; i < this.maxHealth; i++) {
            if (this.healthIcons[i]) {
                this.healthIcons[i].setVisible(i < this.health);
                if (i < this.health) {
                    this.healthIcons[i].setTint(0x00FF00); 
                } else {
                    this.healthIcons[i].setTint(0x888888); 
                }
            }
        }
    }

    /**
     * Updates the rotation of the speedometer needle based on the car's current speed.
     */
    updateSpeedometerNeedle() {
        if (this.speedometerNeedle && this.car && this.car.body) {
            const vel = this.car.body.velocity;
            const currentSpeed = this.matter.vector.magnitude(vel);

            const clampedSpeed = Phaser.Math.Clamp(currentSpeed, 0, this.maxSpeed);

            const minAngle = Phaser.Math.DegToRad(-135); 
            const maxAngle = Phaser.Math.DegToRad(135);  

            const mappedAngle = Phaser.Math.Linear(minAngle, maxAngle, clampedSpeed / this.maxSpeed);

            this.speedometerNeedle.setRotation(mappedAngle);
        }
    }

    /**
     * Handles player car movement based on keyboard input.
     */
    handleCarMovement() {
        const vel = this.car.body.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

        const forceMagnitude = 0.005; 
        const reverseAcceleration = 0.00015; 
        const brakeForce = 0.02;
        const turnSpeed = 0.05;
        const maxReverseSpeed = 1.0; 

        const carAngle = this.car.rotation;
        const velocityAngle = Math.atan2(vel.y, vel.x);
        const angleDiff = Phaser.Math.Angle.ShortestBetween(carAngle, velocityAngle);

        const isMovingForwardRoughly = speed > 0.1 && Math.abs(angleDiff) < Math.PI / 2;
        const isMovingBackwardRoughly = this.cursors.down.isDown && !isMovingForwardRoughly && speed > 0.05;

        if (this.cursors.up.isDown) {
            const forceX = Math.cos(carAngle) * forceMagnitude;
            const forceY = Math.sin(carAngle) * forceMagnitude;
            this.car.applyForce({ x: forceX, y: forceY });
            if (!this.sounds.move.isPlaying || this.sounds.move.duration - this.sounds.move.seek < 0.1) {
                if (this.sounds.move && this.sounds.move.key !== '__missing') { // Check if sound loaded
                    this.sounds.move.play();
                }
            }

            if (speed > this.maxSpeed) { 
                const ratio = this.maxSpeed / speed; 
                this.car.setVelocity(vel.x * ratio, vel.y * ratio);
            }
        } else if (this.cursors.down.isDown) {
            if (speed > 0.1 && isMovingForwardRoughly) {
                this.car.applyForce({
                    x: -vel.x * brakeForce,
                    y: -vel.y * brakeForce
                });
                if (speed < 0.3) {
                    this.car.setVelocity(0, 0);
                }
            } else {
                const forceX = Math.cos(carAngle) * -reverseAcceleration;
                const forceY = Math.sin(carAngle) * -reverseAcceleration;
                this.car.applyForce({ x: forceX, y: forceY });
                if (!this.sounds.move.isPlaying || this.sounds.move.duration - this.sounds.move.seek < 0.1) {
                    if (this.sounds.move && this.sounds.move.key !== '__missing') { // Check if sound loaded
                        this.sounds.move.play();
                    }
                }

                if (speed > maxReverseSpeed) {
                    const ratio = maxReverseSpeed / speed;
                    this.car.setVelocity(vel.x * ratio, vel.y * ratio);
                }
            }
        } else {
            this.car.setVelocity(vel.x * 0.98, vel.y * 0.98);
        }

        if (this.cursors.left.isDown) {
            this.car.rotation -= turnSpeed * (isMovingBackwardRoughly ? -1 : 1);
        }
        if (this.cursors.right.isDown) {
            this.car.rotation += turnSpeed * (isMovingBackwardRoughly ? -1 : 1);
        }

        const forwardVectorX = Math.cos(carAngle);
        const forwardVectorY = Math.sin(carAngle);
        const lateralVectorX = -forwardVectorY;
        const lateralVectorY = forwardVectorX;

        const lateralVelocity = vel.x * lateralVectorX + vel.y * lateralVectorY;

        const lateralFrictionMagnitude = 0.002; 
        this.car.applyForce({
            x: -lateralVectorX * lateralVelocity * lateralFrictionMagnitude,
            y: -lateralVectorY * lateralVelocity * lateralFrictionMagnitude
        });
    }

    /**
     * Normalizes a 2D vector.
     * @param {object} vec - The vector to normalize.
     * @returns {object} The normalized vector.
     */
    normalizeVector(vec) {
        const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
        return length > 0 ? { x: vec.x / length, y: vec.y / length } : { x: 0, y: 0 };
    }

    /**
     * Creates checkpoints based on corner tiles and the N-1 tile in the track path.
     * @param {Array<Object>} trackPath - The array of track segment nodes with world coordinates.
     * @returns {Array<Matter.Body>} An array of Matter.js checkpoint bodies.
     */
    createCheckpoints(trackPath) {
        const cpArray = [];
        let checkpointIndex = 0; 

        if (trackPath.length < 2) { 
            console.warn("Track path too short to define N-1 checkpoint.");
            return [];
        }

        for (let i = 0; i < trackPath.length; i++) {
            const curr = trackPath[i];
            
            const isCorner = (curr.fromDir !== curr.toDir);

            const isNMinus1Tile = (i === trackPath.length - 2); 

            if (isCorner || isNMinus1Tile) { 
                const cp = this.matter.add.rectangle(curr.worldX, curr.worldY, this.TILE_SIZE, this.TILE_SIZE, {
                    isStatic: true,
                    isSensor: true, 
                    label: 'checkpoint',
                    collisionFilter: {
                        category: this.CATEGORY_CHECKPOINT,
                        mask: this.CATEGORY_CAR | this.CATEGORY_ENEMY_CAR 
                    }
                });
                cp.checkpointIndex = checkpointIndex++;
                cpArray.push(cp);

                if (isNMinus1Tile) { 
                    this.n2CheckpointBody = cp; 
                }

                const visualRect = this.add.rectangle(curr.worldX, curr.worldY, this.TILE_SIZE, this.TILE_SIZE, 0x888888, 0.2) 
                    .setDepth(1000)
                    .setBlendMode(Phaser.BlendModes.ADD);
                cp.visualRect = visualRect; 
            }
        }
        cpArray.sort((a, b) => a.checkpointIndex - b.checkpointIndex);
        return cpArray;
    }

    /**
     * Updates the visual appearance of checkpoints based on player's progress.
     */
    updateCheckpointVisuals() {
        if (!this.checkpoints || this.checkpoints.length === 0) return;

        this.checkpoints.forEach((cp, index) => {
            if (cp.visualRect) {
                if (index === this.car.currentCheckpointIndex) {
                    cp.visualRect.setFillStyle(0x00FF00, 0.5); 
                } else if (this.car.collectedCheckpoints && this.car.collectedCheckpoints.has(index)) {
                    cp.visualRect.setFillStyle(0x0000FF, 0.5); 
                } else {
                    cp.visualRect.setFillStyle(0x888888, 0.2); 
                }
            }
        });
    }

    /**
     * Handles a car colliding with a checkpoint.
     * @param {Phaser.GameObjects.Image} car - The car object (player or enemy).
     * @param {MatterJS.BodyType} checkpointBody - The Matter.js body of the checkpoint.
     */
    handleCheckpoint(car, checkpointBody) {
        const checkpointActualIndex = this.checkpoints.findIndex(cp => cp === checkpointBody);

        if (car === this.car) { 
            if (checkpointActualIndex === car.currentCheckpointIndex) {
                if (this.sounds.collect && this.sounds.collect.key !== '__missing') { 
                    this.sounds.collect.play();
                }
                
                if (!car.collectedCheckpoints) {
                    car.collectedCheckpoints = new Set();
                }
                car.collectedCheckpoints.add(checkpointActualIndex);

                if (checkpointBody.visualRect) {
                    checkpointBody.visualRect.setFillStyle(0x0000FF, 0.5); 
                }

                if (checkpointActualIndex === this.checkpoints.length - 1) { 
                    car.lapCount++;
                    this.playerLapText.setText(`You: Lap ${car.lapCount}`);
                    this.updateScore(100);
                    console.log("Player completed a lap!");
                    
                    car.currentCheckpointIndex = 0;
                    car.collectedCheckpoints.clear();
                    
                    this.checkpoints.forEach(cp => {
                        if (cp.visualRect) {
                            cp.visualRect.setFillStyle(0x888888, 0.2); 
                        }
                    });
                } else {
                    car.currentCheckpointIndex++;
                }
            } else { 
                console.log(`Checkpoint ${checkpointActualIndex} hit out of sequence. Expected ${car.currentCheckpointIndex}. Lap progress not advanced.`);
            }
            this.updateCheckpointVisuals(); 
        } else { 
            if (checkpointActualIndex === car.currentCheckpointIndex) {
                if (this.sounds.collect && this.sounds.collect.key !== '__missing') { 
                    this.sounds.collect.play();
                }
                if (!car.collectedCheckpoints) car.collectedCheckpoints = new Set();
                car.collectedCheckpoints.add(checkpointActualIndex);

                car.currentCheckpointIndex++;
                if (car.currentCheckpointIndex >= this.checkpoints.length) {
                    car.lapCount++;
                    const enemyIndex = this.enemyCars.indexOf(car);
                    if (enemyIndex === 0) this.player1Text.setText(`Player 1: Lap ${car.lapCount}`);
                    else if (enemyIndex === 1) this.player2Text.setText(`Player 2: Lap ${car.lapCount}`);
                    else if (enemyIndex === 2) this.player3Text.setText(`Player 3: Lap ${car.lapCount}`);
                    
                    car.currentCheckpointIndex = 0;
                    car.collectedCheckpoints.clear();
                }
            }
            else {
                car.currentCheckpointIndex = 0;
                if (car.collectedCheckpoints) car.collectedCheckpoints.clear();
            }
        }
    }

    /**
     * Checks the win condition based on player's and enemy's lap counts.
     * Handles level progression or game over.
     */
    checkWinCondition() {
        if (this.isGameOver) return; 

        let maxEnemyLapCount = 0;
        this.enemyCars.forEach(enemyCar => {
            if (enemyCar.lapCount > maxEnemyLapCount) {
                maxEnemyLapCount = enemyCar.lapCount;
            }
        });

        if (this.car.lapCount > maxEnemyLapCount && this.car.lapCount > 0) { 
            if (this.level < this.maxLevel) {
                this.level++;
                this.setEnemyCarSpeedForLevel();
                if (!this.winText) {
                    this.winText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'YOU WIN!', {
                        fontSize: '48px',
                        fill: '#00FF00',
                        backgroundColor: '#000',
                        padding: { x: 20, y: 10 },
                        shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5 }
                    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
                }
                this.winText.setVisible(true);
                this.time.delayedCall(1500, () => { 
                    this.winText.setVisible(false);
                    this.nextLevelText.setText('Moving to next level...'); // Ensure text is correct
                    this.nextLevelText.setAlpha(1).setVisible(true);
                    this.tweens.add({
                        targets: this.nextLevelText,
                        alpha: 0,
                        duration: 1500,
                        ease: 'Power1',
                        onComplete: () => {
                            this.nextLevelText.setVisible(false);
                            this.showLevelText(); // Show new level text
                            this.prepareNextLevel(); // Prepare for next level
                        }
                    });
                }, [], this);
            } else {
                // Final level win: show normal win/game over
                if (!this.winText) {
                    this.winText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'YOU WIN!', { 
                        fontSize: '48px',
                        fill: '#00FF00',
                        backgroundColor: '#000000',
                        padding: { x: 20, y: 10 },
                        shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5, stroke: false, fill: true }
                    })
                    .setOrigin(0.5)
                    .setScrollFactor(0)
                    .setDepth(1001);
                }
                this.winText.setVisible(true);

                this.time.delayedCall(1500, () => {
                    if (this.nextLevelText) {
                        this.nextLevelText.setText('All Levels Complete!'); 
                        this.nextLevelText.setVisible(true);
                        this.tweens.add({
                            targets: this.nextLevelText,
                            alpha: { from: 0, to: 1 },
                            y: this.nextLevelText.y - 20,
                            ease: 'Power1',
                            duration: 1000,
                            onComplete: () => {
                                this.time.delayedCall(1000, () => {
                                    this.tweens.add({
                                        targets: this.nextLevelText,
                                        alpha: { from: 1, to: 0 },
                                        ease: 'Power1',
                                        duration: 1000,
                                        onComplete: () => {
                                            this.gameOver();
                                        }
                                    });
                                }, [], this);
                            }
                        });
                    } else {
                        this.gameOver();
                    }
                }, [], this);
            }
        }
    }

    /**
     * Prepares the game for the next level. Resets car positions, health, and enemy data.
     */
    prepareNextLevel() {
        this.isGameOver = false;
        this.isGameStarted = true;

        this.gameOverText.setVisible(false);
        if (this.winText) this.winText.setVisible(false);
        this.nextLevelText.setVisible(false);
        this.retryButton.setVisible(false);

        // Reset player car
        this.car.setPosition(this.carStartPoint.x, this.carStartPoint.y);
        this.car.setRotation(0); 
        this.matter.body.setVelocity(this.car.body, { x: 0, y: 0 });
        this.matter.body.setAngularVelocity(this.car.body, 0);
        this.health = this.maxHealth;
        this.updateHealthUI();
        this.car.lapCount = 0;
        this.car.currentCheckpointIndex = 1; 
        this.car.collectedCheckpoints = new Set();
        this.car.collectedCheckpoints.add(0); 
        
        this.playerLapText.setText(`You: Lap ${this.car.lapCount}`); 

        // Reset enemy cars
        this.enemyCars.forEach((enemyCar, index) => {
            const startIndex = Math.floor((index * this.trackPath.length) / this.enemyCars.length);
            if (this.trackPath.length === 0 || startIndex >= this.trackPath.length) {
                 console.warn("Track path is empty when trying to setup enemy cars. Skipping enemy car placement.");
                 return; 
            }
            const startNode = this.trackPath[startIndex];
            enemyCar.setPosition(startNode.worldX, startNode.worldY);
            
            const nextNodeIndex = (startIndex + 1) % this.trackPath.length;
            const nextNode = this.trackPath[nextNodeIndex];
            const angle = Phaser.Math.Angle.Between(startNode.worldX, startNode.worldY, nextNode.worldX, nextNode.worldY);
            enemyCar.setRotation(angle);

            this.matter.body.setVelocity(enemyCar.body, { x: 0, y: 0 });
            this.matter.body.setAngularVelocity(enemyCar.body, 0);
            enemyCar.lapCount = Phaser.Math.Between(0, 5); 
            enemyCar.currentCheckpointIndex = 0; 
            if (enemyCar.collectedCheckpoints) enemyCar.collectedCheckpoints.clear(); 
            if (index === 0) this.player1Text.setText(`Player 1: Lap ${enemyCar.lapCount}`);
            if (index === 1) this.player2Text.setText(`Player 2: Lap ${enemyCar.lapCount}`);
            if (index === 2) this.player3Text.setText(`Player 3: Lap ${enemyCar.lapCount}`);
        });

        // Reset checkpoint visuals
        this.checkpoints.forEach(cp => {
            if (cp.visualRect) {
                cp.visualRect.setFillStyle(0x888888, 0.2); 
            }
        });

        this.showGameElements();
        this.scene.resume();
        if (this.sounds.background && this.sounds.background.key !== '__missing') {
            this.sounds.background.setVolume(0.3).setLoop(true).play();
        }
        this.updateCheckpointVisuals();
    }

    /**
     * Draws a debug grid on the game canvas.
     * @param {number} gridSize - The size of the grid (number of cells in x and y).
     */
    drawDebugGrid(gridSize = 20) {
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                this.add.rectangle(x * this.TILE_SIZE, y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE)
                    .setStrokeStyle(1, 0x444444)
                    .setOrigin(0) 
                    .setDepth(100); 
            }
        }
    }

    /**
     * Updates the player's score.
     * @param {number} points - The points to add to the score.
     */
    updateScore(points) {
        this.score += points;
    }

    /**
     * Calculates the world position of the car's rear left wheel.
     * @returns {object} An object with x and y coordinates.
     */
    getRearLeftWheelPosition() {
        if (!this.car || !this.car.body) return { x: 0, y: 0 };

        const carAngle = this.car.rotation;
        const carWidth = this.car.width * this.car.scaleX;
        const carHeight = this.car.height * this.car.scaleY;
        const rearAxleOffset = -carWidth / 2; 
        const wheelTrack = carHeight / 2; 

        const rearX = Math.cos(carAngle) * rearAxleOffset;
        const rearY = Math.sin(carAngle) * rearAxleOffset;

        const leftSideX = Math.cos(carAngle - Math.PI / 2) * wheelTrack;
        const leftSideY = Math.sin(carAngle - Math.PI / 2) * wheelTrack;

        return {
            x: this.car.x + rearX + leftSideX,
            y: this.car.y + rearY + leftSideY
        };
    }

    /**
     * Calculates the world position of the car's rear right wheel.
     * @returns {object} An object with x and y coordinates.
     */
    getRearRightWheelPosition() {
        if (!this.car || !this.car.body) return { x: 0, y: 0 };

        const carAngle = this.car.rotation;
        const carWidth = this.car.width * this.car.scaleX;
        const carHeight = this.car.height * this.car.scaleY;
        const rearAxleOffset = -carWidth / 2; 
        const wheelTrack = carHeight / 2; 

        const rearX = Math.cos(carAngle) * rearAxleOffset;
        const rearY = Math.sin(carAngle) * rearAxleOffset;

        const rightSideX = Math.cos(carAngle + Math.PI / 2) * wheelTrack;
        const rightSideY = Math.sin(carAngle + Math.PI / 2) * wheelTrack;

        return {
            x: this.car.x + rearX + rightSideX,
            y: this.car.y + rearY + rightSideY
        };
    }

    /**
     * Handles the creation of tire marks based on car's movement and slippage.
     * @param {number} time - The current game time.
     */
    handleTireMarks(time) {
        if (!this.car || !this.tireMarksGraphics || !this.car.body) { 
            return;
        }

        const vel = this.car.body.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const carAngle = this.car.rotation;
        const velocityAngle = Math.atan2(vel.y, vel.x);
        const angleDiff = Phaser.Math.Angle.ShortestBetween(carAngle, velocityAngle); 

        const isMovingAtAll = speed > this.tireMarkSpeedThreshold; 
        const isMovingAtHighSpeed = speed > this.tireMarkHighSpeedThreshold; 
        const isSlipping = Math.abs(angleDiff) > this.lateralSlipThreshold; 
        const timeForNewMark = (time - this.lastTireMarkTime) > this.tireMarkInterval;

        if (isMovingAtAll && isMovingAtHighSpeed && isSlipping && timeForNewMark) {
            const currentRearLeftPos = this.getRearLeftWheelPosition();
            const currentRearRightPos = this.getRearRightWheelPosition();

            if (typeof currentRearLeftPos.x === 'number' && typeof currentRearLeftPos.y === 'number' &&
                typeof currentRearRightPos.x === 'number' && typeof currentRearRightPos.y === 'number' &&
                typeof this.prevRearLeftPos.x === 'number' && typeof this.prevRearLeftPos.y === 'number' &&
                typeof this.prevRearRightPos.x === 'number' && typeof this.prevRearRightPos.y === 'number') {

                this.tireMarkSegments.push({
                    x1: this.prevRearLeftPos.x, y1: this.prevRearLeftPos.y, x2: currentRearLeftPos.x, y2: currentRearLeftPos.y, 
                    creationTime: time
                });
                this.tireMarkSegments.push({
                    x1: this.prevRearRightPos.x, y1: this.prevRearRightPos.y, x2: currentRearRightPos.x, y2: currentRearRightPos.y,
                    creationTime: time
                });
                
                this.lastTireMarkTime = time;

                this.prevRearLeftPos = currentRearLeftPos;
                this.prevRearRightPos = currentRearRightPos; 
            } else {
                console.warn("Invalid tire mark position data, skipping segment creation.");
            }
        } else {
            if (this.car && this.car.body) {
                this.prevRearLeftPos = this.getRearLeftWheelPosition();
                this.prevRearRightPos = this.getRearRightWheelPosition();
            }
        }
    }

    /**
     * Draws fading tire marks on the canvas.
     * @param {number} time - The current game time.
     */
    drawFadingTireMarks(time) {
        if (!this.tireMarksGraphics) return;

        this.tireMarksGraphics.clear(); 
        const fadeDuration = 10000; 

        this.tireMarkSegments = this.tireMarkSegments.filter(segment => {
            if (segment && typeof segment.creationTime === 'number' &&
                typeof segment.x1 === 'number' && typeof segment.y1 === 'number' &&
                typeof segment.x2 === 'number' && typeof segment.y2 === 'number') {
                const age = time - segment.creationTime;

                if (age < fadeDuration) {
                    const alpha = 0.8 * (1 - (age / fadeDuration)); 
                    this.tireMarksGraphics.lineStyle(3, 0x000000, alpha); 
                    this.tireMarksGraphics.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
                    return true; 
                }
            } else {
                console.warn(`Invalid tire mark segment found and removed during filter: ${JSON.stringify(segment)}`);
            }
            return false; 
        });
    }

    /**
     * Draws a debug grid on the game canvas.
     * @param {number} gridSize - The size of the grid (number of cells in x and y).
     */
    drawDebugGrid(gridSize = 20) {
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                this.add.rectangle(x * this.TILE_SIZE, y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE)
                    .setStrokeStyle(1, 0x444444)
                    .setOrigin(0) 
                    .setDepth(100); 
            }
        }
    }

    /**
     * Helper to draw a debug rectangle that aligns with the physics body
     */
    drawDebugRect(graphics, matterBodyCenterX, matterBodyCenterY, width, height, angleRad, color) {
        graphics.lineStyle(2, color, 0.8); 

        const halfWidth = width / 2;
        const halfHeight = height / 2;

        const p1 = new Phaser.Math.Vector2(-halfWidth, -halfHeight); 
        const p2 = new Phaser.Math.Vector2(halfWidth, -halfHeight);  
        const p3 = new Phaser.Math.Vector2(halfWidth, halfHeight);   
        const p4 = new Phaser.Math.Vector2(-halfWidth, halfHeight);  

        p1.rotate(angleRad);
        p2.rotate(angleRad);
        p3.rotate(angleRad);
        p4.rotate(angleRad);

        p1.add({ x: matterBodyCenterX, y: matterBodyCenterY });
        p2.add({ x: matterBodyCenterX, y: matterBodyCenterY });
        p3.add({ x: matterBodyCenterX, y: matterBodyCenterY });
        p4.add({ x: matterBodyCenterX, y: matterBodyCenterY });

        graphics.strokeLineShape(new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y));
        graphics.strokeLineShape(new Phaser.Geom.Line(p2.x, p2.y, p3.x, p3.y));
        graphics.strokeLineShape(new Phaser.Geom.Line(p3.x, p3.y, p4.x, p4.y));
        graphics.strokeLineShape(new Phaser.Geom.Line(p4.x, p4.y, p1.x, p1.y));
    }


    /**
     * Draws debug graphics to visualize corner connections and potential issues.
     */
    validateAndDrawCorners() {
        const debugGraphics = this.add.graphics();
        debugGraphics.setDepth(10000); 

        for (let i = 0; i < this.trackPath.length; i++) {
            const curr = this.trackPath[i];
            let prev, next;

            if (i === 0) { 
                prev = this.trackPath[this.trackPath.length - 1]; 
                next = this.trackPath[1]; 
            } else if (i === this.trackPath.length - 1) { 
                prev = this.trackPath[i - 1]; 
                next = this.trackPath[0]; 
            } else { 
                prev = this.trackPath[i - 1];
                next = this.trackPath[i + 1];
            }

            const worldX = curr.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const worldY = curr.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            const fromDir_dx = curr.x - prev.x;
            const fromDir_dy = curr.y - prev.y;
            const fromDir = this.DIRECTIONS.findIndex(d => d.x === fromDir_dx && d.y === fromDir_dy);

            const toDir_dx = next.x - curr.x;
            const toDir_dy = next.y - curr.y;
            const toDir = this.DIRECTIONS.findIndex(d => d.x === toDir_dx && d.y === toDir_dy);

            let imageRotationDegrees;
            const curveKey = `${fromDir}-${toDir}`;
            imageRotationDegrees = this.CURVE_ANGLES[curveKey];
            if (imageRotationDegrees === undefined) {
                const reversed = `${toDir}-${fromDir}`;
                if (this.CURVE_ANGLES[reversed] !== undefined) {
                    imageRotationDegrees = (this.CURVE_ANGLES[reversed] + 180) % 360;
                } else {
                    console.warn(`Missing CURVE_ANGLES for ${curveKey} and its reverse. Defaulting to 0 degrees.`);
                    imageRotationDegrees = 0;
                }
            }

            let segmentTypeForBoundaries; 

            if (fromDir === toDir) {
                segmentTypeForBoundaries = 'straight';
            } else {
                segmentTypeForBoundaries = 'curved';
            }

            if (this.showDebugGraphics) {
                debugGraphics.lineStyle(1, 0x00FF00, 0.5); 
                debugGraphics.strokeRect(worldX - this.TILE_SIZE / 2, worldY - this.TILE_SIZE / 2, this.TILE_SIZE, this.TILE_SIZE);
            }
        }
    }

    /**
     * Ends the game, displays 'GAME OVER!' message and retry button.
     */
    gameOver() {
        this.isGameOver = true;
        this.isGameStarted = false; 
        this.scene.pause();
        if (this.gameOverText) {
            this.gameOverText.setVisible(true); 
        }
        if (this.winText) {
            this.winText.setVisible(true); 
        }
        if (this.nextLevelText) {
            this.nextLevelText.setVisible(false); 
        }
        this.retryButton.setVisible(true); 
        
        if (this.sounds.background && this.sounds.background.isPlaying) {
            this.sounds.background.stop(); 
        }
        if (this.sounds.lose && this.sounds.lose.key !== '__missing') {
            this.sounds.lose.play(); 
        }
    }

    /**
     * Pauses the game.
     */
    pauseGame() {
    }
}

// Phaser Game Configuration
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    backgroundColor: '#222222', 
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 0 },
            debug: false 
        }
    },
    scene: [GameScene], 
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: _CONFIG.deviceOrientation === "portrait" ? Phaser.Scale.PORTRAIT : Phaser.Scale.LANDSCAPE,
    },
    pixelArt: true, 
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions
    },
    healthUI: {
        offsetX: -200, 
        offsetY: 180 
    },
    speedometerUI: {
        offsetX: 70, 
        offsetY: 100 
    }
};
