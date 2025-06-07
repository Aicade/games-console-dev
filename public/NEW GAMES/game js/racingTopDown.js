class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        this.showDebugGraphics = false; // Set to true to see UI bounding boxes and the uiContainer border
        
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
        this.startButton = null; // This will now remain null as it's removed
        this.nextLevelText = null; 
        this.retryButton = null; 
        this.retryText = null; 
        
        this.n2CheckpointBody = null; 

        this.healthIcons = []; 
        this.healthTextLabel = null;

        // New properties for levels
        this.level = 1;
        this.maxLevel = 5; 
        this.levelText = null; 
        this.enemyCarBaseSpeed = 1; 
        this.enemyCarSpeed = this.enemyCarBaseSpeed;

        // UI Element References for easier resizing
        this.uiElements = {
            scoreboard: {},
            health: {},
            speedometer: {},
            messages: {},
            buttons: {}
        };
        this.debugUI = null; 

        // New: Design base for UI scaling
        this.DESIGN_WIDTH = 1280;
        this.DESIGN_HEIGHT = 720;
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
        for(const key in _CONFIG.libLoader) {
            this.load.script(key, _CONFIG.libLoader[key]);
        }
    }

    create() {
        this.sounds.background = this.sound.add('background', { loop: false, volume: 0.5 });
        this.sounds.move = this.sound.add('move', { loop: false, volume: 0.5 });
        this.sounds.collect = this.sound.add('collect', { loop: false, volume: 0.5 });
        this.sounds.lose = this.sound.add('lose', { loop: false, volume: 0.5 });
        this.sounds.damage = this.sound.add('damage', { loop: false, volume: 0.5 });
        window.addEventListener('resize', () => {
    this.scale.resize(window.innerWidth, window.innerHeight);
});
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
        // REMOVED: this.camera.setZoom(2.0); // No longer needed, using dynamic zoom below
        
        // Initial world bounds (will be adjusted after track generation)
        this.matter.world.setBounds(0, 0, 1280, 720);
        this.camera.setBounds(0, 0, 1280, 720);

        // Call the new random track generation function FIRST
        this.generateRandomTrack(); 
        // Then create the grass background based on the generated track's bounds
        this.createGrassBackground();
        this.setupCar(); 

        // // --- DYNAMIC ZOOM: Set camera zoom so the world fits the screen ---
        // // Use the actual world size after track generation
        // const worldWidth = this.worldWidth || 1280;
        // const worldHeight = this.worldHeight || 720;
        // const zoomX = this.scale.width / worldWidth;
        // const zoomY = this.scale.height / worldHeight;
        // const zoom = Math.min(zoomX, zoomY);
        // this.camera.setZoom(zoom);
        const desiredZoom = 3.0; // Try 1.5, 2.0, etc. Adjust as needed
        this.camera.setZoom(desiredZoom);

        // These elements are part of the game world, not UI, so they don't get the .isUI tag
        this.tireMarksGraphics = this.add.graphics({ lineStyle: { width: 3, color: 0x000000, alpha: 0.8 } });
        this.tireMarksGraphics.setDepth(1.5); 
        
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.disableGlobalCapture();
        
        this.setupCollisions();

        this.camera.startFollow(this.car);
        
        this.input.addPointer(3);

        // UI Container: This will hold all UI elements and scale with the screen
        this.uiContainer = this.add.container(0, 0);
        this.uiContainer.setScrollFactor(0); // UI not affected by world scroll/zoom
        this.uiContainer.isUI = true; // Tag the container as UI

        // Create UI Debug Graphics Layer inside the UI container for consistent scaling
        this.debugUI = this.add.graphics({ lineStyle: { width: 2, color: 0x00FF00, alpha: 0.8 } });
        this.uiContainer.add(this.debugUI); // Add debug graphics to the UI container
        this.debugUI.setDepth(2000); 
        this.debugUI.isUI = true; // Tag debug graphics as UI

        // Create all UI elements and add them to the UI container
        this.createUI();

        // Add a second camera for the UI
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);
        this.uiCamera.setZoom(1); // UI camera is never zoomed

        // Ignore all non-UI elements in the UI camera
        this.uiCamera.ignore(this.children.list.filter(obj => !obj.isUI));

        // Ignore all UI elements in the main camera
        this.cameras.main.ignore(this.children.list.filter(obj => obj.isUI));

        // Listen for resize events and update UI accordingly
        this.scale.on('resize', this.resizeUI, this);

        // Draw debug grid if enabled
        if (this.showDebugGraphics) {
            this.drawDebugGrid(20); 
            this.validateAndDrawCorners(); 
        }

        this.updateCheckpointVisuals(); 
        
        // Game starts immediately now
        this.startGame();
    }

    /**
     * Creates all persistent UI elements and stores references.
     * Elements are added to this.uiContainer. Positions and sizes are based on DESIGN_WIDTH/HEIGHT.
     */
    createUI() {
        // Define all text configuration bases first
        this.uiElements.textConfigBases = {
            playerText: {
                fontSize: '12px', // Use pixel values, container handles overall scale
                fill: '#FFFFFF',
                backgroundColor: '#000000', 
                padding: { x: 5, y: 2 },
                shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 1, stroke: false, fill: true } 
            },
            healthText: { 
                fontSize: '12px', // Use pixel values
                fill: '#FFFF00',   
                backgroundColor: '#000000', 
                padding: { x: 0, y: 0 }, 
                shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: false, fill: true } 
            },
            gameOverText: {
                fontSize: '64px', // Use pixel values
                fill: '#FF0000', 
                backgroundColor: '#000000',
                padding: { x: 30, y: 15 },
                shadow: { offsetX: 5, offsetY: 5, color: '#000', blur: 8, stroke: false, fill: true }
            },
            nextLevelText: { 
                fontSize: '32px', // Use pixel values
                fill: '#FFFFFF',
                backgroundColor: '#000000',
                padding: { x: 15, y: 8 },
                shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5, stroke: false, fill: true }
            },
            levelText: {
                fontSize: '48px', // Use pixel values
                fill: '#FFD700',
                backgroundColor: '#000',
                padding: { x: 20, y: 10 },
                shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 5 }
            },
            retryText: { 
                fontSize: '24px', // Use pixel values
                fontFamily: 'Arial',
                color: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 4, 
                align: 'center'
            }
        };

        // Player Scoreboard Entries - positions are relative to DESIGN_WIDTH/HEIGHT
        // and scales are base values that will be handled by uiContainer's overall scale
        const playerTextConfigBase = { ...this.uiElements.textConfigBases.playerText }; // Clone to avoid modifying base
        this.uiElements.scoreboard.playerTextConfigBase = playerTextConfigBase; 

        const iconScaleBase = 0.015; 
        const entryLineHeightBase = 18; 
        // const uiDesignPadding = 40; // Padding based on design dimensions - moved to resizeUI for clarity

        // Player's entry
        this.uiElements.scoreboard.playerIcon = this.add.image(0, 0, 'car') 
            .setOrigin(0.5, 0.5)
            .setScale(iconScaleBase);
        this.uiElements.scoreboard.playerIcon.isUI = true;
        this.uiElements.scoreboard.playerLapText = this.add.text(0, 0, `You: Lap ${this.lapCount}`, playerTextConfigBase) 
            .setOrigin(0, 0.5);
        this.uiElements.scoreboard.playerLapText.isUI = true;
        this.uiContainer.add([this.uiElements.scoreboard.playerIcon, this.uiElements.scoreboard.playerLapText]);

        // Enemy Player Entries
        this.uiElements.scoreboard.enemy1Icon = this.add.image(0, 0, 'enemycar_1') 
            .setOrigin(0.5, 0.5) 
            .setScale(iconScaleBase);
        this.uiElements.scoreboard.enemy1Icon.isUI = true;
        this.uiElements.scoreboard.player1Text = this.add.text(0, 0, 'Player 1: Lap 0', playerTextConfigBase) 
            .setOrigin(0, 0.5);
        this.uiElements.scoreboard.player1Text.isUI = true;
        this.uiContainer.add([this.uiElements.scoreboard.enemy1Icon, this.uiElements.scoreboard.player1Text]);

        this.uiElements.scoreboard.enemy2Icon = this.add.image(0, 0, 'enemycar_2') 
            .setOrigin(0.5, 0.5)
            .setScale(iconScaleBase);
        this.uiElements.scoreboard.enemy2Icon.isUI = true;
        this.uiElements.scoreboard.player2Text = this.add.text(0, 0, 'Player 2: Lap 0', playerTextConfigBase) 
            .setOrigin(0, 0.5);
        this.uiElements.scoreboard.player2Text.isUI = true;
        this.uiContainer.add([this.uiElements.scoreboard.enemy2Icon, this.uiElements.scoreboard.player2Text]);

        this.uiElements.scoreboard.enemy3Icon = this.add.image(0, 0, 'enemycar_3') 
            .setOrigin(0.5, 0.5)
            .setScale(iconScaleBase);
        this.uiElements.scoreboard.enemy3Icon.isUI = true;
        this.uiElements.scoreboard.player3Text = this.add.text(0, 0, 'Player 3: Lap 0', playerTextConfigBase) 
            .setOrigin(0, 0.5);
        this.uiElements.scoreboard.player3Text.isUI = true;
        this.uiContainer.add([this.uiElements.scoreboard.enemy3Icon, this.uiElements.scoreboard.player3Text]);

        this.setupEnemyCars(); 


        // UI Health Display
        const healthTextConfigBase = { ...this.uiElements.textConfigBases.healthText };
        this.uiElements.health.healthTextConfigBase = healthTextConfigBase; 

        this.uiElements.health.tireIconSizeBase = 16; 
        this.uiElements.health.tireIconSpacingBase = 2; 

        this.uiElements.health.healthTextLabel = this.add.text(0, 0, 'Health:', healthTextConfigBase)
            .setOrigin(0, 0.5);
        this.uiElements.health.healthTextLabel.isUI = true;
        this.uiContainer.add(this.uiElements.health.healthTextLabel);

        this.healthIconsContainer = this.add.container(0, 0);
        this.healthIconsContainer.isUI = true;
        this.uiContainer.add(this.healthIconsContainer); // Add container to uiContainer
        this.uiElements.health.healthIconsContainer = this.healthIconsContainer;

        for (let i = 0; i < this.maxHealth; i++) {
            const tireIcon = this.add.image(0, 0, 'tire') 
                .setOrigin(0, 0.5) 
                .setTint(0x00FF00)
                .setScale(this.uiElements.health.tireIconSizeBase / this.textures.get('tire').source[0].width);
            tireIcon.isUI = true; // Tag each individual icon
            this.healthIcons.push(tireIcon);
            this.healthIconsContainer.add(tireIcon);
        }
        this.uiElements.health.healthIcons = this.healthIcons;

        // Speedometer UI 
        this.uiElements.speedometer.speedometerImage = this.add.image(0, 0, 'speedometer')
            .setOrigin(0.5, 0.5) 
            .setScale(0.1);
        this.uiElements.speedometer.speedometerImage.isUI = true;
        this.uiContainer.add(this.uiElements.speedometer.speedometerImage);
        
        this.uiElements.speedometer.needleLengthBase = 15;
        this.uiElements.speedometer.speedometerNeedle = this.add.graphics({ lineStyle: { width: 0.8, color: 0xFF0000, alpha: 1 } }); 
        this.uiElements.speedometer.speedometerNeedle.isUI = true;
        this.uiContainer.add(this.uiElements.speedometer.speedometerNeedle); // Add to uiContainer

        // Add game over text
        this.gameOverText = this.add.text(0, 0, 'GAME OVER!', this.uiElements.textConfigBases.gameOverText)
        .setOrigin(0.5) 
        .setVisible(false); 
        this.gameOverText.isUI = true;
        this.uiContainer.add(this.gameOverText);
        this.uiElements.messages.gameOverText = this.gameOverText;
        this.uiElements.messages.gameOverTextConfigBase = this.uiElements.textConfigBases.gameOverText; 

        // Text for "Moving to next level..."
        this.nextLevelText = this.add.text(0, 0, 'Moving to next level...', this.uiElements.textConfigBases.nextLevelText)
        .setOrigin(0.5)
        .setVisible(false);
        this.nextLevelText.isUI = true;
        this.uiContainer.add(this.nextLevelText);
        this.uiElements.messages.nextLevelText = this.nextLevelText;
        this.uiElements.messages.nextLevelTextConfigBase = this.uiElements.textConfigBases.nextLevelText; 

        // Level text display
        this.levelText = this.add.text(0, 0, `Level ${this.level} !!`, this.uiElements.textConfigBases.levelText)
            .setOrigin(0.5)
            .setVisible(false);
        this.levelText.isUI = true;
        this.uiContainer.add(this.levelText);
        this.uiElements.messages.levelText = this.levelText;
        this.uiElements.messages.levelTextConfigBase = this.uiElements.textConfigBases.levelText; 

        // Create the retry button (which will also be added to uiContainer)
        this.createRetryButton();

        // ...existing code...

// --- Mobile Controls (Simple Buttons) ---
this.mobileControls = {};
const buttonSize = 90;
const buttonAlpha = 0.5;
const yBase = this.DESIGN_HEIGHT - 300;

// Left button
this.mobileControls.left = this.add.circle(300, yBase+50, buttonSize / 2, 0x3333ff, buttonAlpha)
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(999)
    .setVisible(false);
this.mobileControls.leftText = this.add.text(300, yBase+50, '◀', { fontSize: '48px', color: '#fff' })
    .setOrigin(0.5)
    .setDepth(1000)
    .setVisible(false);
this.uiContainer.add([this.mobileControls.left, this.mobileControls.leftText]);

// Right button
this.mobileControls.right = this.add.circle(400, yBase+50, buttonSize / 2, 0x3333ff, buttonAlpha)
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(999)
    .setVisible(false);
this.mobileControls.rightText = this.add.text(400, yBase+50, '▶', { fontSize: '48px', color: '#fff' })
    .setOrigin(0.5)
    .setDepth(1000)
    .setVisible(false);
this.uiContainer.add([this.mobileControls.right, this.mobileControls.rightText]);

// Up button
this.mobileControls.up = this.add.circle(this.DESIGN_WIDTH - 330, yBase-50, buttonSize / 2, 0x33ff33, buttonAlpha)
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(999)
    .setVisible(false);
this.mobileControls.upText = this.add.text(this.DESIGN_WIDTH - 330, yBase-50, '▲', { fontSize: '48px', color: '#fff' })
    .setOrigin(0.5)
    .setDepth(1000)
    .setVisible(false);
this.uiContainer.add([this.mobileControls.up, this.mobileControls.upText]);

// Down button
this.mobileControls.down = this.add.circle(this.DESIGN_WIDTH - 330, yBase+50, buttonSize / 2, 0xff3333, buttonAlpha)
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(999)
    .setVisible(false);
this.mobileControls.downText = this.add.text(this.DESIGN_WIDTH - 330, yBase+50, '▼', { fontSize: '48px', color: '#fff' })
    .setOrigin(0.5)
    .setDepth(1000)
    .setVisible(false);
this.uiContainer.add([this.mobileControls.down, this.mobileControls.downText]);

// Show buttons only on mobile
if (this.sys.game.device.input.touch) {
    Object.values(this.mobileControls).forEach(btn => btn.setVisible(true));
}
// Track button states
this.mobileButtonState = { left: false, right: false, up: false, down: false };
this.mobileControls.left.on('pointerdown', () => this.mobileButtonState.left = true);
this.mobileControls.left.on('pointerup', () => this.mobileButtonState.left = false);
this.mobileControls.left.on('pointerout', () => this.mobileButtonState.left = false);

this.mobileControls.right.on('pointerdown', () => this.mobileButtonState.right = true);
this.mobileControls.right.on('pointerup', () => this.mobileButtonState.right = false);
this.mobileControls.right.on('pointerout', () => this.mobileButtonState.right = false);

this.mobileControls.up.on('pointerdown', () => this.mobileButtonState.up = true);
this.mobileControls.up.on('pointerup', () => this.mobileButtonState.up = false);
this.mobileControls.up.on('pointerout', () => this.mobileButtonState.up = false);

this.mobileControls.down.on('pointerdown', () => this.mobileButtonState.down = true);
this.mobileControls.down.on('pointerup', () => this.mobileButtonState.down = false);
this.mobileControls.down.on('pointerout', () => this.mobileButtonState.down = false);

        // Perform initial UI resize to set positions and scales correctly
        this.resizeUI();
    }

    /**
     * Resizes and repositions all UI elements based on the current canvas dimensions.
     * This now primarily scales and positions the uiContainer.
     */
    resizeUI() {
        // Update UI camera size if it exists
        if (this.uiCamera) {
            this.uiCamera.setSize(this.scale.width, this.scale.height);
        }

        const canvasWidth = this.scale.width;
        const canvasHeight = this.scale.height;

        // Calculate UI scale factor based on actual screen vs design base
        const scaleMultiplier = 1.7; // Increase for bigger UI, decrease for smaller
        const uiScaleFactor = Math.min(
        canvasWidth / this.DESIGN_WIDTH,
        canvasHeight / this.DESIGN_HEIGHT
        ) * scaleMultiplier;
        this.uiContainer.setScale(uiScaleFactor);

        // Calculate offset to center the UI if aspect ratio doesn't match
        const offsetX = (canvasWidth - this.DESIGN_WIDTH * uiScaleFactor) / 2;
        const offsetY = (canvasHeight - this.DESIGN_HEIGHT * uiScaleFactor) / 2;
        this.uiContainer.setPosition(offsetX, offsetY);

        // Clear debug graphics for fresh drawing
        if (this.showDebugGraphics && this.debugUI) {
            this.debugUI.clear();
            // Draw a thick pink rectangle for the entire uiContainer's effective design area
            // This is drawn *inside* uiContainer, so its coords are relative to uiContainer's origin (0,0)
            this.debugUI.lineStyle(4, 0xFF00FF, 1); // Thick pink line for uiContainer border
            this.debugUI.strokeRect(0, 0, this.DESIGN_WIDTH, this.DESIGN_HEIGHT);
            this.debugUI.lineStyle(2, 0x00FF00, 0.8); // Back to green for individual element debug
        }

        // Positions and sizes of elements are now fixed relative to DESIGN_WIDTH/HEIGHT
        // and are automatically scaled by the uiContainer's scale.
        const scoreboardXPadding = 230; // Move right (increase this value as needed)
        const scoreboardYPadding = 160; // Keep original Y position
        const iconSize = this.uiElements.scoreboard.playerIcon.width * this.uiElements.scoreboard.playerIcon.scaleX;
        const entryLineHeight = 18;

        // --- Scoreboard (Moved right, same Y) ---
        this.uiElements.scoreboard.playerIcon
            .setPosition(scoreboardXPadding + iconSize / 2, scoreboardYPadding + entryLineHeight / 2); 
        this.uiElements.scoreboard.playerLapText
            .setPosition(scoreboardXPadding + iconSize + 5, scoreboardYPadding + entryLineHeight / 2); 

        const enemyIconOffset = scoreboardXPadding + iconSize / 2; 
        const enemyTextOffset = scoreboardXPadding + iconSize + 5;

        this.uiElements.scoreboard.enemy1Icon
            .setPosition(enemyIconOffset, scoreboardYPadding + entryLineHeight + entryLineHeight / 2);
        this.uiElements.scoreboard.player1Text
            .setPosition(enemyTextOffset, scoreboardYPadding + entryLineHeight + entryLineHeight / 2);

        this.uiElements.scoreboard.enemy2Icon
            .setPosition(enemyIconOffset, scoreboardYPadding + (entryLineHeight * 2) + entryLineHeight / 2);
        this.uiElements.scoreboard.player2Text
            .setPosition(enemyTextOffset, scoreboardYPadding + (entryLineHeight * 2) + entryLineHeight / 2);

        this.uiElements.scoreboard.enemy3Icon
            .setPosition(enemyIconOffset, scoreboardYPadding + (entryLineHeight * 3) + entryLineHeight / 2);
        this.uiElements.scoreboard.player3Text
            .setPosition(enemyTextOffset, scoreboardYPadding + (entryLineHeight * 3) + entryLineHeight / 2);

        // --- Health Display (Bottom-Left) ---
        this.uiElements.health.healthTextLabel.x = 225;
        this.uiElements.health.healthTextLabel.y = this.DESIGN_HEIGHT - 165 - (this.uiElements.health.healthTextLabel.displayHeight / 2);

        const tireIconSpacing = this.uiElements.health.tireIconSpacingBase; // Use base spacing
        const tireIconWidth = this.uiElements.health.healthIcons[0].displayWidth; // Get actual display width after initial scaling
        this.uiElements.health.healthIconsContainer.setPosition(
            this.uiElements.health.healthTextLabel.x + this.uiElements.health.healthTextLabel.displayWidth + tireIconSpacing, 
            this.uiElements.health.healthTextLabel.y 
        );

        for (let i = 0; i < this.maxHealth; i++) {
            const tireIcon = this.uiElements.health.healthIcons[i];
            tireIcon.x = i * (tireIconWidth + tireIconSpacing);
            // No need to set scale here, it's set in createUI and handled by container
        }
        this.updateHealthUI();


        // --- Speedometer UI (Bottom-Right) ---
        const speedometerImageWidth = this.uiElements.speedometer.speedometerImage.width * this.uiElements.speedometer.speedometerImage.scaleX;
        const speedometerImageHeight = this.uiElements.speedometer.speedometerImage.height * this.uiElements.speedometer.speedometerImage.scaleY;

        this.uiElements.speedometer.speedometerImage.setPosition(
            this.DESIGN_WIDTH - 350 - (speedometerImageWidth / 2),
            this.DESIGN_HEIGHT - 155 - (speedometerImageHeight / 2)
            ); 
        
        const needleLength = this.uiElements.speedometer.needleLengthBase; 
        this.uiElements.speedometer.speedometerNeedle.clear();
        this.uiElements.speedometer.speedometerNeedle.lineStyle(0.8, 0xAA0000, 1); // Line thickness is fixed based on design
        this.uiElements.speedometer.speedometerNeedle.beginPath();
        this.uiElements.speedometer.speedometerNeedle.moveTo(0, 0); 
        this.uiElements.speedometer.speedometerNeedle.lineTo(0, -needleLength); 
        this.uiElements.speedometer.speedometerNeedle.closePath();
        this.uiElements.speedometer.speedometerNeedle.strokePath();

        this.uiElements.speedometer.speedometerNeedle.x = this.uiElements.speedometer.speedometerImage.x;
        this.uiElements.speedometer.speedometerNeedle.y = this.uiElements.speedometer.speedometerImage.y + 8; 


        // --- Messages & Buttons (Centered) ---
        const centerDesignPosX = this.DESIGN_WIDTH / 2;
        const centerDesignPosY = this.DESIGN_HEIGHT / 2;

        this.uiElements.messages.gameOverText.setPosition(centerDesignPosX, centerDesignPosY);
        this.uiElements.messages.nextLevelText.setPosition(centerDesignPosX, centerDesignPosY + 50);
        // this.uiElements.buttons.startButton.setPosition(centerDesignPosX, centerDesignPosY); // REMOVED
        this.uiElements.messages.levelText.setPosition(centerDesignPosX, centerDesignPosY);

        // Update retry button as well
        if (this.retryButton && this.retryText) {
            this.retryButton.setPosition(centerDesignPosX, centerDesignPosY + 100);
            this.retryButton.setSize(200, 60); // Set fixed design size
            this.retryText.setPosition(this.retryButton.x, this.retryButton.y);
        }

        // Update winText if it exists (it's created conditionally)
        if (this.winText) {
            this.winText.setPosition(centerDesignPosX, centerDesignPosY);
            this.winText.isUI = true; // Tag winText as UI
        }

        // Draw debug rectangles on the debugUI graphics object (which is in uiContainer)
        if (this.showDebugGraphics && this.debugUI) {
            // Scoreboard elements
            this.debugUI.strokeRect(this.uiElements.scoreboard.playerIcon.x - this.uiElements.scoreboard.playerIcon.displayWidth / 2,
                                    this.uiElements.scoreboard.playerIcon.y - this.uiElements.scoreboard.playerIcon.displayHeight / 2,
                                    this.uiElements.scoreboard.playerIcon.displayWidth,
                                    this.uiElements.scoreboard.playerIcon.displayHeight);
            this.debugUI.strokeRect(this.uiElements.scoreboard.playerLapText.x,
                                    this.uiElements.scoreboard.playerLapText.y - this.uiElements.scoreboard.playerLapText.displayHeight / 2,
                                    this.uiElements.scoreboard.playerLapText.displayWidth,
                                    this.uiElements.scoreboard.playerLapText.displayHeight);
            // ... (add debug for other scoreboard elements)

            // Health display elements
            this.debugUI.strokeRect(this.uiElements.health.healthTextLabel.x,
                                    this.uiElements.health.healthTextLabel.y - this.uiElements.health.healthTextLabel.displayHeight / 2,
                                    this.uiElements.health.healthTextLabel.displayWidth,
                                    this.uiElements.health.healthTextLabel.displayHeight);
            const containerBounds = this.healthIconsContainer.getBounds();
            this.debugUI.strokeRect(containerBounds.x, containerBounds.y, containerBounds.width, containerBounds.height);

            // Speedometer elements
            this.debugUI.strokeRect(this.uiElements.speedometer.speedometerImage.x - this.uiElements.speedometer.speedometerImage.displayWidth / 2,
                                    this.uiElements.speedometer.speedometerImage.y - this.uiElements.speedometer.speedometerImage.displayHeight / 2,
                                    this.uiElements.speedometer.speedometerImage.displayWidth,
                                    this.uiElements.speedometer.speedometerImage.displayHeight);
            // The needle itself is drawn relative to its origin, which is set to the speedometer image's position.
            // No direct bounding box for needle graphics is usually needed or easily obtained like other GameObjects.

            // Centered messages/buttons
            this.debugUI.strokeRect(this.uiElements.messages.gameOverText.x - this.uiElements.messages.gameOverText.displayWidth / 2,
                                    this.uiElements.messages.gameOverText.y - this.uiElements.messages.gameOverText.displayHeight / 2,
                                    this.uiElements.messages.gameOverText.displayWidth,
                                    this.uiElements.messages.gameOverText.displayHeight);
            this.debugUI.strokeRect(this.uiElements.messages.nextLevelText.x - this.uiElements.messages.nextLevelText.displayWidth / 2,
                                    this.uiElements.messages.nextLevelText.y - this.uiElements.messages.nextLevelText.displayHeight / 2,
                                    this.uiElements.messages.nextLevelText.displayWidth,
                                    this.uiElements.messages.nextLevelText.displayHeight);
            // if (this.uiElements.buttons.startButton) { // REMOVED
            //     this.debugUI.strokeRect(this.uiElements.buttons.startButton.x - this.uiElements.buttons.startButton.displayWidth / 2,
            //                             this.uiElements.buttons.startButton.y - this.uiElements.buttons.startButton.displayHeight / 2,
            //                             this.uiElements.buttons.startButton.displayWidth,
            //                             this.uiElements.buttons.startButton.displayHeight);
            // }
            this.debugUI.strokeRect(this.uiElements.messages.levelText.x - this.uiElements.messages.levelText.displayWidth / 2,
                                    this.uiElements.messages.levelText.y - this.uiElements.messages.levelText.displayHeight / 2,
                                    this.uiElements.messages.levelText.displayWidth,
                                    this.uiElements.messages.levelText.displayHeight);
            if (this.retryButton && this.retryText) {
                this.debugUI.strokeRect(this.retryButton.x - this.retryButton.displayWidth / 2,
                                        this.retryButton.y - this.retryButton.displayHeight / 2,
                                        this.retryButton.displayWidth,
                                        this.retryButton.displayHeight);
                this.debugUI.strokeRect(this.retryText.x - this.retryText.displayWidth / 2,
                                        this.retryText.y - this.retryText.displayHeight / 2,
                                        this.retryText.displayWidth,
                                        this.retryText.displayHeight);
            }
            if (this.winText) {
                this.debugUI.strokeRect(this.winText.x - this.winText.displayWidth / 2,
                                        this.winText.y - this.winText.displayHeight / 2,
                                        this.winText.displayWidth,
                                        this.winText.displayHeight);
            }
        }
    }

    /**
     * Creates a visually appealing retry button with hover effects.
     * Added to the uiContainer.
     */
    createRetryButton() {
        // Create button background
        this.retryButton = this.add.rectangle(0, 0, 1, 1, 0x4CAF50, 0.8) 
            .setInteractive()
            .setVisible(false);
        this.retryButton.isUI = true; // Tag the button as UI
        this.uiContainer.add(this.retryButton);

        // Add button text
        this.retryText = this.add.text(0, 0, 'RETRY', this.uiElements.textConfigBases.retryText) 
            .setOrigin(0.5)
            .setVisible(false);
        this.retryText.isUI = true; // Tag the text as UI
        this.uiContainer.add(this.retryText);

        // Button hover effects
        this.retryButton.on('pointerover', () => {
            this.retryButton.setFillStyle(0x388E3C); 
            this.retryButton.setScale(1.05); 
        });

        this.retryButton.on('pointerout', () => {
            this.retryButton.setFillStyle(0x4CAF50); 
            this.retryButton.setScale(1); 
        });

        this.retryButton.on('pointerdown', () => {
            this.retryButton.setFillStyle(0x2E7D32); 
            this.retryButton.setScale(0.95); 
        });

        this.retryButton.on('pointerup', () => {
            this.retryButton.setFillStyle(0x4CAF50);
            this.retryButton.setScale(1); 
            this.retryGame();
        });
        
        this.uiElements.buttons.retryButton = this.retryButton;
        this.uiElements.buttons.retryText = this.retryText;
    }

    /**
     * Hides all game elements (player car, enemy cars, and game-play UI).
     * This is no longer used for initial state, as the game starts immediately.
     */
    hideGameElements() {
        // This function is now effectively unused since the game starts immediately,
        // but keeping it for consistency if similar "hide" logic is needed later.
        this.car.setVisible(false);
        this.enemyCars.forEach(enemyCar => enemyCar.setVisible(false));
        
        // Hide game-play specific UI elements
        if (this.uiElements.scoreboard.playerIcon) this.uiElements.scoreboard.playerIcon.setVisible(false);
        if (this.uiElements.scoreboard.playerLapText) this.uiElements.scoreboard.playerLapText.setVisible(false);
        if (this.uiElements.scoreboard.enemy1Icon) this.uiElements.scoreboard.enemy1Icon.setVisible(false);
        if (this.uiElements.scoreboard.player1Text) this.uiElements.scoreboard.player1Text.setVisible(false);
        if (this.uiElements.scoreboard.enemy2Icon) this.uiElements.scoreboard.enemy2Icon.setVisible(false);
        if (this.uiElements.scoreboard.player2Text) this.uiElements.scoreboard.player2Text.setVisible(false);
        if (this.uiElements.scoreboard.enemy3Icon) this.uiElements.scoreboard.enemy3Icon.setVisible(false);
        if (this.uiElements.scoreboard.player3Text) this.uiElements.scoreboard.player3Text.setVisible(false);

        if (this.uiElements.health.healthTextLabel) this.uiElements.health.healthTextLabel.setVisible(false);
        this.healthIcons.forEach(icon => icon.setVisible(false));

        if (this.uiElements.speedometer.speedometerImage) this.uiElements.speedometer.speedometerImage.setVisible(false);
        if (this.uiElements.speedometer.speedometerNeedle) this.uiElements.speedometer.speedometerNeedle.setVisible(false);
        
        // Ensure non-gameplay messages/buttons are hidden initially
        if (this.gameOverText) this.gameOverText.setVisible(false);
        if (this.retryButton) this.retryButton.setVisible(false);
        if (this.retryText) this.retryText.setVisible(false);
        if (this.winText) this.winText.setVisible(false);
        if (this.nextLevelText) this.nextLevelText.setVisible(false);
    }

    /**
     * Shows all game elements (player car, enemy cars, and game-play UI).
     * This is now used to ensure everything is visible when the game starts.
     */
    showGameElements() {
        this.car.setVisible(true);
        this.enemyCars.forEach(enemyCar => enemyCar.setVisible(true));
        
        // Show game-play specific UI elements
        if (this.uiElements.scoreboard.playerIcon) this.uiElements.scoreboard.playerIcon.setVisible(true);
        if (this.uiElements.scoreboard.playerLapText) this.uiElements.scoreboard.playerLapText.setVisible(true);
        if (this.uiElements.scoreboard.enemy1Icon) this.uiElements.scoreboard.enemy1Icon.setVisible(true);
        if (this.uiElements.scoreboard.player1Text) this.uiElements.scoreboard.player1Text.setVisible(true);
        if (this.uiElements.scoreboard.enemy2Icon) this.uiElements.scoreboard.enemy2Icon.setVisible(true);
        if (this.uiElements.scoreboard.player2Text) this.uiElements.scoreboard.player2Text.setVisible(true);
        if (this.uiElements.scoreboard.enemy3Icon) this.uiElements.scoreboard.enemy3Icon.setVisible(true);
        if (this.uiElements.scoreboard.player3Text) this.uiElements.scoreboard.player3Text.setVisible(true);

        if (this.uiElements.health.healthTextLabel) this.uiElements.health.healthTextLabel.setVisible(true);
        this.healthIcons.forEach(icon => icon.setVisible(true));

        if (this.uiElements.speedometer.speedometerImage) this.uiElements.speedometer.speedometerImage.setVisible(true);
        if (this.uiElements.speedometer.speedometerNeedle) this.uiElements.speedometer.speedometerNeedle.setVisible(true);

        // Ensure non-gameplay messages/buttons are hidden
        // if (this.startButton) this.startButton.setVisible(false); // REMOVED
        if (this.gameOverText) this.gameOverText.setVisible(false);
        if (this.retryButton) this.retryButton.setVisible(false);
        if (this.retryText) this.retryText.setVisible(false);
        if (this.winText) this.winText.setVisible(false);
        if (this.nextLevelText) this.nextLevelText.setVisible(false);

        // Level text is managed by showLevelText(), not here
        // this.uiElements.messages.levelText.setVisible(true); 
    }

    /**
     * Displays the current level text with a fade-out animation.
     */
    showLevelText() {
        this.uiElements.messages.levelText.setText(`Level ${this.level} !!`);
        this.uiElements.messages.levelText.setAlpha(1).setVisible(true);
        // No need to call resizeUI here as element positions are fixed within design space
        this.tweens.add({
            targets: this.uiElements.messages.levelText,
            alpha: 0,
            duration: 1200,
            onComplete: () => this.uiElements.messages.levelText.setVisible(false)
        });
    }

    /**
     * Sets the enemy car speed based on the current level.
     * Speed increases with level but remains slightly below player's max speed.
     */
    setEnemyCarSpeedForLevel() {
        if (this.level < this.maxLevel) {
            this.enemyCarSpeed = this.enemyCarBaseSpeed + (this.maxSpeed - 1.2) * ((this.level - 1) / (this.maxLevel - 1));
        } else {
            this.enemyCarSpeed = this.maxSpeed * 0.85;
        }
    }

    /**
     * Starts a new game. Resets player and enemy states, and displays game elements.
     */
    startGame() {
        this.isGameStarted = true;
        this.showGameElements(); // Shows all game elements
        this.scene.resume(); 
        this.health = this.maxHealth;
        this.updateHealthUI();
        this.car.lapCount = 0;
        this.car.currentCheckpointIndex = 1; 
        this.car.collectedCheckpoints = new Set();
        this.car.collectedCheckpoints.add(0); 

        this.uiElements.scoreboard.playerLapText.setText(`You: Lap ${this.car.lapCount}`); 

        // Reset enemy cars to their initial state for a new game
        this.enemyCars.forEach((enemyCar, index) => {
            enemyCar.currentCheckpointIndex = 0; 
            if (enemyCar.collectedCheckpoints) enemyCar.collectedCheckpoints.clear(); 
            
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

            if (index === 0) this.uiElements.scoreboard.player1Text.setText(`Player 1: Lap ${enemyCar.lapCount}`);
            if (index === 1) this.uiElements.scoreboard.player2Text.setText(`Player 2: Lap ${enemyCar.lapCount}`);
            if (index === 2) this.uiElements.scoreboard.player3Text.setText(`Player 3: Lap ${enemyCar.lapCount}`);
        });

        // Ensure game over and other messages are hidden
        this.uiElements.messages.gameOverText.setVisible(false); 
        if (this.winText) this.winText.setVisible(false); 
        if (this.uiElements.messages.nextLevelText) this.uiElements.messages.nextLevelText.setVisible(false); 
        if (this.retryButton) this.retryButton.setVisible(false);
        if (this.retryText) this.retryText.setVisible(false);

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
        this.health = this.maxHealth;
        this.score = 0;
        this.lapCount = 0;
        this.currentCheckpoint = 0;
        
        // Hide game over elements
        if (this.uiElements.messages.gameOverText) {
            this.uiElements.messages.gameOverText.setVisible(false);
        }
        if (this.retryButton && this.retryText) {
            this.retryButton.setVisible(false);
            this.retryText.setVisible(false);
        }
        
        this.car.setPosition(this.carStartPoint.x, this.carStartPoint.y);
        this.car.setRotation(0);
        this.matter.body.setVelocity(this.car.body, { x: 0, y: 0 });
        this.matter.body.setAngularVelocity(this.car.body, 0);
        
        this.enemyCars.forEach((enemy, index) => {
            const startIndex = Math.floor((index * this.trackPath.length) / this.enemyCars.length);
            if (this.trackPath.length === 0 || startIndex >= this.trackPath.length) {
                 console.warn("Track path is empty when trying to setup enemy cars. Skipping enemy car placement.");
                 return; 
            }
            const startNode = this.trackPath[startIndex];
            enemy.setPosition(startNode.worldX, startNode.worldY);
            enemy.lapCount = Phaser.Math.Between(0, 3);
            this.matter.body.setVelocity(enemy.body, { x: 0, y: 0 });
            this.matter.body.setAngularVelocity(enemy.body, 0);
            
            if (index === 0) this.uiElements.scoreboard.player1Text.setText(`Player 1: Lap ${enemy.lapCount}`);
            if (index === 1) this.uiElements.scoreboard.player2Text.setText(`Player 2: Lap ${enemy.lapCount}`);
            if (index === 2) this.uiElements.scoreboard.player3Text.setText(`Player 3: Lap ${enemy.lapCount}`);
        });
        
        this.checkpoints.forEach(cp => {
            if (cp.visualRect) {
                cp.visualRect.setFillStyle(0x888888, 0.2);
            }
        });
        
        this.car.currentCheckpointIndex = 1;
        this.car.collectedCheckpoints = new Set();
        this.car.collectedCheckpoints.add(0);
        
        this.uiElements.scoreboard.playerLapText.setText(`You: Lap ${this.lapCount}`);
        this.updateHealthUI();
        
        if (this.sounds.background) {
            this.sounds.background.play();
        }

        this.level = 1; 
        this.setEnemyCarSpeedForLevel();
        this.showLevelText();
        this.showGameElements(); // Shows all game elements 
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

        this.updateSpeedometerNeedle();

        this.enemyCars.forEach(enemyCar => {
            this.moveEnemyCar(enemyCar);
        });

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
        visited.add(this.keyFor(chosenFirstMove.x, chosenFirstS.y));
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
                        const segmentPrev = path[k - 1];
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
    if (this.roadSegments) {
        this.roadSegments.forEach(segment => {
            if (segment.body) this.matter.world.remove(segment.body); 
            segment.destroy(); 
        });
    }
    this.roadSegments = [];
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

    // Place finish_tile at trackPath.length - 2
    if (i === this.trackPath.length - 2) {
        imageKey = 'finish_tile';
        // Face from trackPath.length-3 to trackPath.length-2
        const prevNode = this.trackPath[i - 1];
        const dx = curr.x - prevNode.x;
        const dy = curr.y - prevNode.y;
        imageRotationDegrees = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    }
    // Use start_tile for the last tile
    else if (i === this.trackPath.length - 1) {
        imageKey = 'start_tile';
        const lastNode = this.trackPath[i];
        const nextNode = this.trackPath[1];
        const dx = nextNode.x * this.TILE_SIZE + this.TILE_SIZE / 2 - (lastNode.x * this.TILE_SIZE + this.TILE_SIZE / 2);
        const dy = nextNode.y * this.TILE_SIZE + this.TILE_SIZE / 2 - (lastNode.y * this.TILE_SIZE + this.TILE_SIZE / 2);
        imageRotationDegrees = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    }
    // All other tiles
    else if (fromDir === toDir) {
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
            this.add.rectangle(
                centerX + perpVector.x * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                centerY + perpVector.y * (halfRoadWidth + boundaryThickness / 2 + this.boundaryPadding),
                this.TILE_SIZE, boundaryThickness,
                boundaryColor
            )
            .setStrokeStyle(1, boundaryStrokeColor)
            .setRotation(imageAngleRad)
            .setDepth(boundaryDepth);

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
                    vertOuterX = centerX - halfTile + boundaryWidth / 2 + adjustedPadding; 
                    vertOuterY = centerY;
                    break;
                default:
                    console.warn(`Unknown corner direction: ${curveKey}`);
                    return;
            }

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
            this.add.rectangle(
                horizOuterX, horizOuterY,
                this.TILE_SIZE, boundaryWidth,
                boundaryColor
            )
            .setStrokeStyle(1, boundaryStrokeColor)
            .setDepth(boundaryDepth);

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
        // REMOVED: this.camera.setZoom(4.0); // No longer needed, zoom is handled dynamically in create()
        if (!this.carStartPoint) {
            console.warn("carStartPoint not defined, using default for car placement.");
            this.carStartPoint = { x: 1280 / 2, y: 720 / 2 };
        }

        this.car = this.matter.add.image(this.carStartPoint.x, this.carStartPoint.y, 'car');
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
        // Car is part of the game world, not UI, so it doesn't get the .isUI tag
        
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
        const enemyCarImageKeys = ['enemycar_1', 'enemycar_2', 'enemycar_3']; 

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
            // Enemy cars are part of the game world, not UI, so they don't get the .isUI tag

            enemyCar.pathIndex = startIndex;
            enemyCar.targetPoint = null; 
            enemyCar.currentSegmentDirection = startNode.dirIndex; 
            enemyCar.currentCheckpointIndex = 0; 
            enemyCar.lapCount = Phaser.Math.Between(0, 3); 
            
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
        if (this.uiElements.speedometer.speedometerNeedle && this.car && this.car.body) {
            const vel = this.car.body.velocity;
            const currentSpeed = this.matter.vector.magnitude(vel);

            const clampedSpeed = Phaser.Math.Clamp(currentSpeed, 0, this.maxSpeed);

            const minAngle = Phaser.Math.DegToRad(-135); 
            const maxAngle = Phaser.Math.DegToRad(135);  

            const mappedAngle = Phaser.Math.Linear(minAngle, maxAngle, clampedSpeed / this.maxSpeed);

            this.uiElements.speedometer.speedometerNeedle.setRotation(mappedAngle);
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

    // Support both keyboard and mobile button controls
    const left = this.cursors.left.isDown || (this.mobileButtonState && this.mobileButtonState.left);
    const right = this.cursors.right.isDown || (this.mobileButtonState && this.mobileButtonState.right);
    const up = this.cursors.up.isDown || (this.mobileButtonState && this.mobileButtonState.up);
    const down = this.cursors.down.isDown || (this.mobileButtonState && this.mobileButtonState.down);

    const isMovingForwardRoughly = speed > 0.1 && Math.abs(angleDiff) < Math.PI / 2;
    const isMovingBackwardRoughly = down && !isMovingForwardRoughly && speed > 0.05;

    if (up) {
        const forceX = Math.cos(carAngle) * forceMagnitude;
        const forceY = Math.sin(carAngle) * forceMagnitude;
        this.car.applyForce({ x: forceX, y: forceY });
        if (!this.sounds.move.isPlaying || this.sounds.move.duration - this.sounds.move.seek < 0.1) {
            if (this.sounds.move && this.sounds.move.key !== '__missing') { 
                this.sounds.move.play();
            }
        }

        if (speed > this.maxSpeed) { 
            const ratio = this.maxSpeed / speed; 
            this.car.setVelocity(vel.x * ratio, vel.y * ratio);
        }
    } else if (down) {
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
                if (this.sounds.move && this.sounds.move.key !== '__missing') { 
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

    if (left) {
        this.car.rotation -= turnSpeed * (isMovingBackwardRoughly ? -1 : 1);
    }
    if (right) {
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

                const visualRect = this.add.rectangle(curr.worldX, curr.worldY, this.TILE_SIZE, this.TILE_SIZE, 0x000000, 0)
                    .setDepth(1000)
                    .setBlendMode(Phaser.BlendModes.ADD);
                // Checkpoints are part of the game world, not UI, so they don't get the .isUI tag
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
            // Always make the checkpoint visual fully transparent
            cp.visualRect.setFillStyle(0x000000, 0);
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
                // Always make the checkpoint visual fully transparent
                checkpointBody.visualRect.setFillStyle(0x000000, 0);
            }

            if (checkpointActualIndex === this.checkpoints.length - 1) { 
                car.lapCount++;
                this.uiElements.scoreboard.playerLapText.setText(`You: Lap ${car.lapCount}`);
                this.updateScore(100);
                
                car.currentCheckpointIndex = 0;
                car.collectedCheckpoints.clear();
                
                this.checkpoints.forEach(cp => {
                    if (cp.visualRect) {
                        cp.visualRect.setFillStyle(0x000000, 0);
                    }
                });
            } else {
                car.currentCheckpointIndex++;
            }
        } else { 
            // console.log(`Checkpoint ${checkpointActualIndex} hit out of sequence. Expected ${car.currentCheckpointIndex}. Lap progress not advanced.`); // Removed
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
                if (enemyIndex === 0) this.uiElements.scoreboard.player1Text.setText(`Player 1: Lap ${car.lapCount}`);
                else if (enemyIndex === 1) this.uiElements.scoreboard.player2Text.setText(`Player 2: Lap ${car.lapCount}`);
                else if (enemyIndex === 2) this.uiElements.scoreboard.player3Text.setText(`Player 3: Lap ${car.lapCount}`);
                
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

        // When player completes a lap higher than all enemies
        if (this.car.lapCount > maxEnemyLapCount && this.car.lapCount > 0) {
            // Reset player lap counter
            this.car.lapCount = 0;
            this.uiElements.scoreboard.playerLapText.setText(`You: Lap 0`);

            // Reset all enemy laps to 0 and update UI
            this.enemyCars.forEach((enemyCar, index) => {
                enemyCar.lapCount = 0;
                if (index === 0) this.uiElements.scoreboard.player1Text.setText(`Player 1: Lap 0`);
                if (index === 1) this.uiElements.scoreboard.player2Text.setText(`Player 2: Lap 0`);
                if (index === 2) this.uiElements.scoreboard.player3Text.setText(`Player 3: Lap 0`);
            });

            // Show "Level 2" text in the center, fade out after 1.2s
            if (this.uiElements.messages.levelText) {
                this.uiElements.messages.levelText.setText("Level 2");
                this.uiElements.messages.levelText.setAlpha(1).setVisible(true);
                this.tweens.add({
                    targets: this.uiElements.messages.levelText,
                    alpha: 0,
                    duration: 1200,
                    onComplete: () => this.uiElements.messages.levelText.setVisible(false)
                });
            }
        }
    }



    /**
     * Prepares the game for the next level. Resets car positions, health, and enemy data.
     */
    prepareNextLevel() {
        this.isGameOver = false;
        this.isGameStarted = true;

        // Hide game over elements
        this.uiElements.messages.gameOverText.setVisible(false);
        if (this.winText) this.winText.setVisible(false);
        this.uiElements.messages.nextLevelText.setVisible(false);
        if (this.retryButton) this.retryButton.setVisible(false);
        if (this.retryText) this.retryText.setVisible(false);

        // Show game-play specific UI elements
        this.showGameElements();

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
        
        this.uiElements.scoreboard.playerLapText.setText(`You: Lap ${this.car.lapCount}`); 

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
            enemyCar.lapCount = Phaser.Math.Between(0, 3); 
            enemyCar.currentCheckpointIndex = 0; 
            if (enemyCar.collectedCheckpoints) enemyCar.collectedCheckpoints.clear(); 
            if (index === 0) this.uiElements.scoreboard.player1Text.setText(`Player 1: Lap ${enemyCar.lapCount}`);
            if (index === 1) this.uiElements.scoreboard.player2Text.setText(`Player 2: Lap ${enemyCar.lapCount}`);
            if (index === 2) this.uiElements.scoreboard.player3Text.setText(`Player 3: Lap ${enemyCar.lapCount}`);
        });

        this.checkpoints.forEach(cp => {
            if (cp.visualRect) {
                cp.visualRect.setFillStyle(0x888888, 0.2); 
            }
        });

        this.scene.resume();
        if (this.sounds.background && this.sounds.background.key !== '__missing') {
            this.sounds.background.setVolume(0.3).setLoop(true).play();
        }
        this.updateCheckpointVisuals();
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
        
        // Hide game-play specific UI elements
        if (this.uiElements.scoreboard.playerIcon) this.uiElements.scoreboard.playerIcon.setVisible(false);
        if (this.uiElements.scoreboard.playerLapText) this.uiElements.scoreboard.playerLapText.setVisible(false);
        if (this.uiElements.scoreboard.enemy1Icon) this.uiElements.scoreboard.enemy1Icon.setVisible(false);
        if (this.uiElements.scoreboard.player1Text) this.uiElements.scoreboard.player1Text.setVisible(false);
        if (this.uiElements.scoreboard.enemy2Icon) this.uiElements.scoreboard.enemy2Icon.setVisible(false);
        if (this.uiElements.scoreboard.player2Text) this.uiElements.scoreboard.player2Text.setVisible(false);
        if (this.uiElements.scoreboard.enemy3Icon) this.uiElements.scoreboard.enemy3Icon.setVisible(false);
        if (this.uiElements.scoreboard.player3Text) this.uiElements.scoreboard.player3Text.setVisible(false);

        if (this.uiElements.health.healthTextLabel) this.uiElements.health.healthTextLabel.setVisible(false);
        this.healthIcons.forEach(icon => icon.setVisible(false));

        if (this.uiElements.speedometer.speedometerImage) this.uiElements.speedometer.speedometerImage.setVisible(false);
        if (this.uiElements.speedometer.speedometerNeedle) this.uiElements.speedometer.speedometerNeedle.setVisible(false);

        this.car.setVisible(false);
        this.enemyCars.forEach(enemyCar => enemyCar.setVisible(false));

        // Show game over elements
        if (this.uiElements.messages.gameOverText) {
            this.uiElements.messages.gameOverText.setVisible(true);
        }
        if (this.winText) {
            this.winText.setVisible(false); 
        }
        if (this.uiElements.messages.nextLevelText) {
            this.uiElements.messages.nextLevelText.setVisible(false); 
        }
        
        if (this.retryButton && this.retryText) {
            this.retryButton.setVisible(true);
            this.retryText.setVisible(true);
        }
        
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
    width: window.innerWidth,
    height: window.innerHeight,
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
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: _CONFIG.deviceOrientation === "portrait" ? Phaser.Scale.PORTRAIT : Phaser.Scale.LANDSCAPE,
    },
    pixelArt: true,
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions
    },
};
