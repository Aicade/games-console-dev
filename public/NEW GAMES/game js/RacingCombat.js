class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        console.log('GameScene constructor started.'); // Log constructor start
        this.score = 0;
        this.health = 100;
        this.isGameOver = false;
        this.player = null;
        this.bullets = null;
        this.enemies = null;
        this.powerups = null;
        this.background = null;
        this.scoreText = null;
        this.healthBar = null;
        this.killStreak = 0;
        this.scoreMultiplier = 1;
        this.shieldActive = false;
        this.missileActive = false;
        this.missileTimer = null;
        this.shieldTimer = null;
        this.distance = 0; // Add distance tracking
        this.distanceText = null; // Add distance text reference
        this.shieldTimerCircle = null; // Add shield timer circle
        this.missileTimerCircle = null; // Add missile timer circle
        this.shieldTimerText = null; // Add shield timer text
        this.missileTimerText = null; // Add missile timer text
        
        // Timer properties
        this.timerRadius = 35; // Increased timer radius
        this.timerTextSize = 45; // Increased timer text size
        console.log(`Constructor - Timer Radius: ${this.timerRadius}, Timer Text Size: ${this.timerTextSize}`); // Log timer size in constructor

        // Power-up inventory counts
        this.healthCount = 0;
        this.missileCount = 0;
        this.shieldCount = 0;
        this.airstrikeCount = 0; // Add airstrike inventory
        
        // Power-up inventory display text
        this.healthInventoryText = null;
        this.missileInventoryText = null;
        this.shieldInventoryText = null;
        this.airstrikeInventoryText = null; // Add airstrike inventory text

        // Initialize game dimensions
        this.width = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width;
        this.height = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height;
        console.log('GameScene constructor finished.'); // Log constructor finish
    }

    preload() {
        console.log('GameScene: preload started.'); // Log preload start
        this.isGameOver = false;  // Required by base template

        // Load all images from imageLoader (AI-editable)
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        // Load all images from libLoader (AI should retain)
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        // Load all sounds from config
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, _CONFIG.soundsLoader[key]);
        }

        // Load required base assets (pauseButton is now loaded from libLoader, so remove this line)
        // this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        addEventListenersPhaser.bind(this)();
        displayProgressLoader.call(this);

        // Create smoke texture for particles
        this.createSmokeTexture();

        console.log('GameScene: preload finished.'); // Log preload finish
    }

    create() {
        console.log('GameScene: create started.'); // Log create start
        this.vfx = new VFXLibrary(this);

        // Create smoke texture using VFX library at the start of create()
        this.vfx.addCircleTexture('smoke', 0x888888, 0.4, 20);
        console.log('Smoke texture created via VFX library');

        // Play background music and loop it
        this.sound.play('background', { loop: true });

        // Set up background exactly as per template
        this.background = this.add.tileSprite(0, 0, this.game.config.width, this.game.config.height, 'Background')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // Create player with proper initialization
        this.player = this.physics.add.sprite(200, this.height + 10, 'Player');
        this.player.setCollideWorldBounds(true);
        this.player.setBounce(0.2);
        this.player.setDrag(100);
        this.player.setMaxVelocity(200);
        this.player.setDepth(10);
        this.player.setScale(0.3);

        // Create player smoke emitter using VFX library
        this.setupPlayerSmoke();

        // Create groups with proper initialization
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            defaultKey: 'bullet',
            maxSize: 10
        });
        this.bullets.setDepth(5);  // Ensure bullets are above background

        // Create separate group for missiles
        this.missiles = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            defaultKey: 'missile',
            maxSize: 5
        });
        this.missiles.setDepth(5);  // Ensure missiles are above background

        this.enemyBullets = this.physics.add.group({
             classType: Phaser.Physics.Arcade.Image,
             defaultKey: 'bullet', // Enemy bullets use bullet asset
             maxSize: 30 // Increased size for enemy bullets
        });
        this.enemyBullets.setDepth(6); // Ensure enemy bullets are above other game objects but below UI

        this.enemies = this.physics.add.group();
        this.enemies.setDepth(5);  // Ensure enemies are above background
        console.log('Enemies group created:', this.enemies);

        this.powerups = this.physics.add.group();
        this.powerups.setDepth(5);  // Ensure powerups are above background

        // Set up collisions
        this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, null, this);
        this.physics.add.collider(this.missiles, this.enemies, this.handleBulletEnemyCollision, null, this); // Add collision for missiles
        this.physics.add.overlap(this.player, this.powerups, this.collectPowerup, null, this);
        this.physics.add.overlap(this.player, this.enemyBullets, this.handlePlayerBulletCollision, null, this);
        this.physics.add.overlap(this.bullets, this.enemyBullets, this.handleBulletBulletCollision, null, this);
        this.physics.add.overlap(this.missiles, this.enemyBullets, this.handleBulletBulletCollision, null, this); // Add collision for missiles

        // Create UI with proper depth
        this.createUI();

        // Set up input exactly as per template
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P).on('keydown', () => this.pauseGame()); // Add P key listener
        this.input.keyboard.disableGlobalCapture();

        // Add pause button with proper depth
        this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setDepth(11)
            .setScale(3)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.pauseGame());

        // Create animations
        this.createAnimations(); // Call createAnimations here

        // Start spawning enemies
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Start spawning powerups
        this.time.addEvent({
            delay: 10000,
            callback: this.spawnPowerup,
            callbackScope: this,
            loop: true
        });

        // Initialize lastShotTime for player automatic fire
        this.lastShotTime = 0;
        this.isShooting = false; // Flag to track if shooting is in progress
    }

    createUI() {
        // Create the scorecard background graphic
        const scorecardWidth = 400; // Further increased width for even more space
        const scorecardHeight = 60; // Adjust height as needed
        const scorecardX = 16; // Position from left edge
        const scorecardY = 16; // Position from top edge
        const cornerRadius = 10; // Rounded corners

        this.scorecardBackground = this.add.graphics();
        this.scorecardBackground.fillStyle(0x2c3e50, 1); // Dark blue fill color
        this.scorecardBackground.fillRoundedRect(scorecardX, scorecardY, scorecardWidth, scorecardHeight, cornerRadius);
        this.scorecardBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey border
        this.scorecardBackground.strokeRoundedRect(scorecardX, scorecardY, scorecardWidth, scorecardHeight, cornerRadius);
        this.scorecardBackground.setScrollFactor(0);
        this.scorecardBackground.setDepth(10); // Below text but above game elements

        // Add a dividing line in the middle
        const dividerX = scorecardX + scorecardWidth / 2; // Center based on new width
        this.scorecardBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey divider
        this.scorecardBackground.beginPath();
        this.scorecardBackground.moveTo(dividerX, scorecardY);
        this.scorecardBackground.lineTo(dividerX, scorecardY + scorecardHeight);
        this.scorecardBackground.strokePath();

        const leftPadding = 2; // Further reduced padding from the left edge of the scorecard
        const rightPadding = 10; // Padding from the center divider for the distance text

        // Score text - Position relative to the left edge of the scorecard with left padding
        this.scoreText = this.add.bitmapText(scorecardX + leftPadding, scorecardY + scorecardHeight / 2, 'pixelfont', '$0', 32)
            .setOrigin(0, 0.5) // Align left edge to the x-coordinate, vertically centered
            .setScrollFactor(0)
            .setDepth(11)
            .setTint(0x00ff00); // Green tint

        // Distance text - Position to the right of the divider, anchored by its left edge
        this.distanceText = this.add.bitmapText(dividerX + rightPadding, scorecardY + scorecardHeight / 2, 'pixelfont', '0m', 32) // Add 'm' for meters
            .setOrigin(0, 0.5) // Align left edge to the x-coordinate, vertically centered
            .setScrollFactor(0)
            .setDepth(11) // Above the background graphic
            .setTint(0xffff00); // Yellow tint

        // Health bar (keep its original position relative to the player or a fixed UI position)
        const healthBarWidth = 100; // Adjusted width to be smaller
        const healthBarHeight = 10; // Adjusted height to be smaller

        this.healthBar = this.add.graphics();
        this.healthBar.setDepth(11); // Ensure health bar is above player

        // Add crosshair
        this.crosshair = this.add.graphics();
        this.crosshair.lineStyle(4, 0xffffff, 1); // Thicker white lines

        // Draw outer circle
        this.crosshair.strokeCircle(0, 0, 30); // Adjust radius for size

        // Draw inner circle
        this.crosshair.strokeCircle(0, 0, 15); // Adjust radius for size

        // Draw horizontal lines
        this.crosshair.lineBetween(-40, 0, -20, 0); // Left segment
        this.crosshair.lineBetween(20, 0, 40, 0);   // Right segment

        // Draw vertical lines
        this.crosshair.lineBetween(0, -40, 0, -20); // Top segment
        this.crosshair.lineBetween(0, 20, 0, 40);   // Bottom segment

        this.crosshair.setDepth(12); // Ensure crosshair is on top
        this.crosshair.setScrollFactor(0); // Keep crosshair fixed on the screen

        // Calculate center screen coordinates for timers
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // Timer positions (moved under scorecard)
        this.timersY = scorecardY + scorecardHeight + 35; // Position slightly further below scorecard
        this.shieldTimerCenterX = scorecardX + scorecardWidth / 4 - 10; // Position under scorecard, left side, slight offset
        this.missileTimerCenterX = scorecardX + scorecardWidth * 3 / 4 + 10; // Position under scorecard, right side, slight offset

        console.log(`createUI - Timers Y: ${this.timersY}, Shield Timer X: ${this.shieldTimerCenterX}, Missile Timer X: ${this.missileTimerCenterX}`); // Log timer positions in createUI

        // Shield timer circle (blue)
        this.shieldTimerCircle = this.add.graphics();
        this.shieldTimerCircle.setDepth(11);
        // Position text at the circle center since origin is 0.5
        this.shieldTimerText = this.add.bitmapText(this.shieldTimerCenterX, this.timersY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0x00ffff) // Cyan color for shield
            .setOrigin(0.5); // Center the text

        // Missile timer circle (red)
        this.missileTimerCircle = this.add.graphics();
        this.missileTimerCircle.setDepth(11);
        // Position text at the circle center since origin is 0.5
        this.missileTimerText = this.add.bitmapText(this.missileTimerCenterX, this.timersY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0xff0000) // Red color for missile
            .setOrigin(0.5); // Center the text

        // Power-up activation slots under scorecard - REPOSITIONED
        const slotSpacing = 20; // Reduced from 30 to 20 to bring buttons even closer together
        const slotSize = 60; // Size for inner circular buttons
        const outerCircleSize = 80; // Size for outer circle
        const firstSlotX = scorecardX; // Align with left edge of scorecard
        const slotsY = this.timersY; // Removed offset completely to position buttons right at the scorecard

        // Health Slot (top) - Now with outer circle
        const healthSlotX = firstSlotX;
        const healthSlotY = slotsY;
        // Remove the old background graphic
        if (this.healthSlotBackground) this.healthSlotBackground.destroy();

        // Create the outer circle for health
        this.healthSlotBackground = this.add.graphics();
        this.healthSlotBackground.fillStyle(0x2c3e50, 0.3); // Dark blue color with transparency
        this.healthSlotBackground.fillCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, outerCircleSize/2);
        this.healthSlotBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey border
        this.healthSlotBackground.strokeCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, outerCircleSize/2);

        // Create the inner button circle
        this.healthSlotBackground.fillStyle(0x2c3e50, 1); // Solid dark blue color
        this.healthSlotBackground.fillCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, slotSize/2);
        this.healthSlotBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey border
        this.healthSlotBackground.strokeCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, slotSize/2);
        this.healthSlotBackground.setScrollFactor(0).setDepth(10);

        // Position health icon in the center of the inner circle
        this.healthIcon = this.add.image(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, 'powerup_health')
            .setScale(0.3)
            .setScrollFactor(0).setDepth(11);
        this.healthIcon.setInteractive({ useHandCursor: true });
        this.healthIcon.on('pointerdown', () => this.activatePowerup('health'));

        // Missile Slot (middle) - Now with outer circle
        const missileSlotX = firstSlotX;
        const missileSlotY = healthSlotY + outerCircleSize + slotSpacing;
        // Remove the old background graphic
        if (this.missileSlotBackground) this.missileSlotBackground.destroy();

        // Create the outer circle for missile
        this.missileSlotBackground = this.add.graphics();
        this.missileSlotBackground.fillStyle(0x2c3e50, 0.3); // Dark blue color with transparency
        this.missileSlotBackground.fillCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, outerCircleSize/2);
        this.missileSlotBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey border
        this.missileSlotBackground.strokeCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, outerCircleSize/2);

        // Create the inner button circle
        this.missileSlotBackground.fillStyle(0x2c3e50, 1); // Solid dark blue color
        this.missileSlotBackground.fillCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, slotSize/2);
        this.missileSlotBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey border
        this.missileSlotBackground.strokeCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, slotSize/2);
        this.missileSlotBackground.setScrollFactor(0).setDepth(10);

        // Position missile icon in the center of the inner circle
        this.missileIcon = this.add.image(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, 'powerup_missile')
            .setScale(0.16)
            .setScrollFactor(0).setDepth(11);
        this.missileIcon.setInteractive({ useHandCursor: true });
        this.missileIcon.on('pointerdown', () => this.activatePowerup('missile'));

        // Shield Slot (bottom) - Now with outer circle
        const shieldSlotX = firstSlotX;
        const shieldSlotY = missileSlotY + outerCircleSize + slotSpacing;
        // Remove the old background graphic
        if (this.shieldSlotBackground) this.shieldSlotBackground.destroy();

        // Create the outer circle for shield
        this.shieldSlotBackground = this.add.graphics();
        this.shieldSlotBackground.fillStyle(0x2c3e50, 0.3); // Dark blue color with transparency
        this.shieldSlotBackground.fillCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, outerCircleSize/2);
        this.shieldSlotBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey border
        this.shieldSlotBackground.strokeCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, outerCircleSize/2);

        // Create the inner button circle
        this.shieldSlotBackground.fillStyle(0x2c3e50, 1); // Solid dark blue color
        this.shieldSlotBackground.fillCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, slotSize/2);
        this.shieldSlotBackground.lineStyle(2, 0xbdc3c7, 1); // Light grey border
        this.shieldSlotBackground.strokeCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, slotSize/2);
        this.shieldSlotBackground.setScrollFactor(0).setDepth(10);

        // Position shield icon in the center of the inner circle
        this.shieldIcon = this.add.image(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, 'powerup_shield')
            .setScale(0.15)
            .setScrollFactor(0).setDepth(11);
        this.shieldIcon.setInteractive({ useHandCursor: true });
        this.shieldIcon.on('pointerdown', () => this.activatePowerup('shield'));

        // Air Strike Slot (very bottom) - Now with outer circle
        const airstrikeSlotX = firstSlotX;
        const airstrikeSlotY = shieldSlotY + outerCircleSize + slotSpacing;
        if (this.airstrikeSlotBackground) this.airstrikeSlotBackground.destroy();
        this.airstrikeSlotBackground = this.add.graphics();
        this.airstrikeSlotBackground.fillStyle(0x2c3e50, 0.3);
        this.airstrikeSlotBackground.fillCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, outerCircleSize/2);
        this.airstrikeSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.airstrikeSlotBackground.strokeCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, outerCircleSize/2);
        this.airstrikeSlotBackground.fillStyle(0x2c3e50, 1);
        this.airstrikeSlotBackground.fillCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, slotSize/2);
        this.airstrikeSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.airstrikeSlotBackground.strokeCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, slotSize/2);
        this.airstrikeSlotBackground.setScrollFactor(0).setDepth(10);
        // Position airstrike icon in the center of the inner circle
        this.airstrikeIcon = this.add.image(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, 'powerup_airstrike')
            .setScale(0.18)
            .setScrollFactor(0).setDepth(11);
        this.airstrikeIcon.setInteractive({ useHandCursor: true });
        this.airstrikeIcon.on('pointerdown', () => this.activatePowerup('airstrike'));

        // Position power-up inventory text on the right side of the outer circles
        const textOffsetX = outerCircleSize + 2; // Reduced from 5 to 2 to move text even closer to buttons
        const textOffsetY = 0; // Center vertically with the circle

        // Remove the old text objects before creating new ones
        if (this.healthInventoryText) this.healthInventoryText.destroy();
        if (this.missileInventoryText) this.missileInventoryText.destroy();
        if (this.shieldInventoryText) this.shieldInventoryText.destroy();
        if (this.airstrikeInventoryText) this.airstrikeInventoryText.destroy();

        this.healthInventoryText = this.add.bitmapText(healthSlotX + textOffsetX, healthSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);
        this.missileInventoryText = this.add.bitmapText(missileSlotX + textOffsetX, missileSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);
        this.shieldInventoryText = this.add.bitmapText(shieldSlotX + textOffsetX, shieldSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);
        this.airstrikeInventoryText = this.add.bitmapText(airstrikeSlotX + textOffsetX, airstrikeSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);

        // Hide timers initially
        this.hidePowerupTimers();

        // Ensure inventory icons are transparent if count is 0 at game start
        this.updateInventoryDisplay();

        // --- TIMER POSITIONS NEXT TO INVENTORY BUTTONS ---
        // Timers are now positioned further to the right of their respective inventory buttons
        this.shieldTimerCenterX = shieldSlotX + outerCircleSize + 70; // Increased offset for shield timer
        this.shieldTimerCenterY = shieldSlotY + outerCircleSize / 2;
        this.missileTimerCenterX = missileSlotX + outerCircleSize + 70; // Increased offset for missile timer
        this.missileTimerCenterY = missileSlotY + outerCircleSize / 2;

        // Shield timer circle (blue)
        this.shieldTimerCircle = this.add.graphics();
        this.shieldTimerCircle.setDepth(11);
        this.shieldTimerText = this.add.bitmapText(this.shieldTimerCenterX, this.shieldTimerCenterY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0x00ffff)
            .setOrigin(0.5);

        // Missile timer circle (red)
        this.missileTimerCircle = this.add.graphics();
        this.missileTimerCircle.setDepth(11);
        this.missileTimerText = this.add.bitmapText(this.missileTimerCenterX, this.missileTimerCenterY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0xff0000)
            .setOrigin(0.5);
    }

    hidePowerupTimers() {
        this.shieldTimerCircle.clear();
        this.missileTimerCircle.clear();
        this.shieldTimerText.setText('');
        this.missileTimerText.setText('');
        // Also hide the objects themselves
        this.shieldTimerCircle.setVisible(false);
        this.missileTimerCircle.setVisible(false);
        this.shieldTimerText.setVisible(false);
        this.missileTimerText.setVisible(false);
    }

    updatePowerupTimer(timer, circle, text, color, x, y, duration, remaining) {
        // Calculate progress as a percentage
        const progress = remaining / duration;
        const angle = progress * Math.PI * 2;

        // Clear previous circle
        circle.clear();

        // Draw the background circle (semi-transparent)
        circle.fillStyle(0x000000, 0.3);
        circle.fillCircle(x, y, 40);

        // Draw the progress arc
        circle.fillStyle(color, 0.5);
        circle.beginPath();
        circle.moveTo(x, y);
        circle.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + angle, false);
        circle.closePath();
        circle.fillPath();

        // Update timer text
        const seconds = Math.ceil(remaining / 1000);
        text.setText(seconds.toString());
        text.setPosition(x, y);
        text.setFontSize(24);
    }

    updateHealthBar() {
        if (!this.player || !this.player.active) {
            this.healthBar.clear(); // Hide health bar if player is not active
            return;
        }

        // Calculate health bar position based on player position
        // Position the bar slightly above the player and centered horizontally
        const barWidth = 100; // Should match the width set in createUI
        const barHeight = 10; // Should match the height set in createUI
        const barX = this.player.x - barWidth / 2; // Center horizontally above the player
        const barY = this.player.y - this.player.displayHeight / 2 - barHeight - 5; // Position above the player

        this.healthBar.clear();
        this.healthBar.fillStyle(0x000000, 0.5); // Background for the health bar
        this.healthBar.fillRect(barX, barY, barWidth, barHeight);

        const healthFillWidth = barWidth * (this.health / 100);
        this.healthBar.fillStyle(0x00ff00, 1); // Green fill for health
        this.healthBar.fillRect(barX, barY, healthFillWidth, barHeight);
    }

    update() {
        if (this.isGameOver) {
            if (this.player.smokeEmitter) {
                this.player.smokeEmitter.stop();
                this.player.smokeEmitter.destroy();
            }
            // Stop all enemy smoke emitters
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.smokeEmitter) {
                    enemy.smokeEmitter.stop();
                    enemy.smokeEmitter.destroy();
                }
            });
            return;
        }

        // Scroll background
        this.background.tilePositionX += 8;

        // Update distance based on background movement
        // Since background moves 8 pixels per frame, we'll count that as distance
        this.distance += 8;
        
        // Update distance text every frame and append 'm'
        this.distanceText.setText(Math.floor(this.distance) + 'm'); // Update distance text and add 'm'
            
        // Add a quick flash effect to the distance text
        this.tweens.add({
            targets: this.distanceText,
            scale: 1.2,
            duration: 100,
            yoyo: true,
            ease: 'Power1'
        });

        // Player position is fixed, only gun aims

        // Automatic shooting & mouse aiming
        // Gun aims at pointer
        if (this.player) {
            const pointer = this.input.activePointer;
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.x, pointer.y);

            // Automatic firing (reduced from 250ms to 100ms for faster firing)
            if (!this.isShooting || this.time.now > this.lastShotTime + 100) {
                 // Check if player object exists before shooting
                 if (this.player.active) {
                    this.shoot(angle);
                    this.lastShotTime = this.time.now;
                    this.isShooting = true; // Set flag to true after shooting
                }
            }
        }

        // Update score multiplier
        if (this.killStreak > 0) {
            this.scoreMultiplier = 1 + (this.killStreak * 0.1);
        } else {
            this.scoreMultiplier = 1;
        }

        // Update enemies (add enemy shooting)
        this.enemies.getChildren().forEach(enemy => {
             // Check if enemy object exists and is active before processing
             if (enemy.active && enemy.body) {

                // Remove continuous y-position update for trucks as lane is set on spawn
                // if (enemy.type === 'enemy_truck' && this.player && this.player.active) {
                //     const laneOffset = 50; // Use the same offset as in spawnEnemy
                //     enemy.y = this.player.y - laneOffset; // Keep truck above the player
                // }

                // Simple example: enemies shoot periodically - Decrease delay
                if (!enemy.lastShotTime || this.time.now > enemy.lastShotTime + 800) { // Shoot every 800ms
                     // Ensure enemy has a body before attempting to shoot
                    if (enemy.body.position) {
                        this.enemyShoot(enemy);
                        enemy.lastShotTime = this.time.now;
                    }
                }
            }
        });

        // Remove bullets, missiles and enemy bullets that go off-screen
        this.bullets.getChildren().forEach(bullet => {
             if (bullet.active && bullet.body && bullet.body.position) {
                if (bullet.x > this.width + 50 || bullet.x < -50 || bullet.y > this.height + 50 || bullet.y < -50) {
                    bullet.destroy();
                }
            }
        });

        this.missiles.getChildren().forEach(missile => {
             if (missile.active && missile.body && missile.body.position) {
                if (missile.x > this.width + 50 || missile.x < -50 || missile.y > this.height + 50 || missile.y < -50) {
                    missile.destroy();
                }
            }
        });

        this.enemyBullets.getChildren().forEach(bullet => {
             if (bullet.active && bullet.body && bullet.body.position) {
                if (bullet.x > this.width + 50 || bullet.x < -50 || bullet.y > this.height + 50 || bullet.y < -50) {
                    bullet.destroy();
                }
            }
        });

        // Update crosshair position to follow the pointer
        if (this.crosshair) {
            const pointer = this.input.activePointer;
            this.crosshair.setPosition(pointer.x, pointer.y);
        }

        // Update player smoke position
        if (this.player && this.player.active) {
            if (!this.player.smokeEmitter || !this.player.smokeEmitter.active) {
                this.setupPlayerSmoke();
            } else {
                // Update to left center position
                const x = this.player.x - this.player.displayWidth * 0.4;
                const y = this.player.y;
                this.player.smokeEmitter.setPosition(x, y);
                
                if (!this.player.smokeEmitter.emitting) {
                    this.player.smokeEmitter.start();
                }
            }
        }

        // Update enemy smoke positions
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.smokeEmitter) {
                // Update to bottom-left position
                const x = enemy.x - enemy.displayWidth * 0.4;
                const y = enemy.y + enemy.displayHeight * 0.3;
                enemy.smokeEmitter.setPosition(x, y);
                
                if (!enemy.smokeEmitter.emitting) {
                    enemy.smokeEmitter.start();
                }
            }
        });

        // Update shield bubble position if it exists
        if (this.shieldBubble && this.shieldActive) {
            this.shieldBubble.setPosition(this.player.x, this.player.y);
        }

        // Update airstrike missiles (call their update method if present)
        this.children.list.forEach(obj => {
            if (obj.texture && obj.texture.key === 'missile' && typeof obj.update === 'function') {
                obj.update();
            }
        });
    }

    shoot(angle) { // Modified shoot function to take angle
        // Check if the player is active before shooting
        if (!this.player || !this.player.active) return;

        if (this.missileActive) {
            console.log('Shooting missile...'); // Log when missile shoot is attempted
            this.shootMissile(angle);
        } else {
            console.log('Shooting bullet...'); // Log when bullet shoot is attempted
            this.shootBullet(angle);
        }
    }

    shootBullet(angle) { // Modified shootBullet to take angle
         // Check if bullet pool is available before getting a bullet
        if (!this.bullets) return;

        const bullet = this.bullets.get(this.player.x + 50, this.player.y); // Start bullet slightly ahead of player
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            bullet.setScale(0.1); // Further decrease the size of the bullet
            // Set bullet velocity based on angle (increased from 600 to 1000)
            this.physics.velocityFromRotation(angle, 1000, bullet.body.velocity); // Significantly increased speed
            bullet.body.setAllowGravity(false);
            bullet.setDepth(5); // Ensure bullet is above background
             // Set bullet rotation to match direction
            bullet.setRotation(angle);
        }
    }

    shootMissile(angle) { // Modified shootMissile to use missiles group
         // Check if missile pool is available before getting a missile
         if (!this.missiles) return;

        const missile = this.missiles.get(this.player.x + 50, this.player.y); // Use missiles group
        if (missile) {
            missile.setActive(true);
            missile.setVisible(true);
            missile.setScale(0.2); // Decreased missile size from 0.4 to 0.2
            missile.hitCount = 0; // Add hit counter for neutralizing enemy bullets
             // Set missile velocity based on angle
            this.physics.velocityFromRotation(angle, 1000, missile.body.velocity); // Increased to match bullet speed
            missile.body.setAllowGravity(false);
            missile.setDepth(5); // Ensure missile is above background
             // Set missile rotation to match direction
             missile.setRotation(angle);
         }
         // Play shoot sound (can be a different sound for missile if available)
         this.sound.play('shoot'); // Using the same shoot sound for now (change to 'shoot')
    }

    // NEW ENEMY SHOOTING FUNCTION
    enemyShoot(enemy) {
         // Check if enemy bullet pool is available before getting a bullet
         if (!this.enemyBullets) return;

        const bullet = this.enemyBullets.get(enemy.x - 30, enemy.y); // Start bullet slightly behind enemy
         // Check if a bullet was successfully retrieved from the pool
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            bullet.setScale(0.1); // Decrease the size of the enemy bullet
            // Aim towards the player's general position (simplified)
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            this.physics.velocityFromRotation(angle, 400, bullet.body.velocity); // Increased enemy bullet speed from 200 to 400
            bullet.body.setAllowGravity(false);
            bullet.setDepth(6); // Ensure enemy bullets are above other game objects but below UI
             // Set bullet rotation to match direction
            bullet.setRotation(angle);
        }
    }

    spawnEnemy() {
        const enemyTypes = ['enemy_motorcycle', 'enemy_truck', 'enemy_drone'];
        const type = enemyTypes[Phaser.Math.Between(0, enemyTypes.length - 1)];
        
        console.log(`Spawning enemy type: ${type}`); // Log the enemy type being spawned

        let enemy;
        let startY;

        if (type === 'enemy_truck') {
            // Trucks spawn from right side, in an upper lane
            const truckLaneOffset = 26; // Offset to move trucks upwards from player lane
            startY = this.player.y - truckLaneOffset; // Set Y position above the player
            enemy = this.enemies.create(this.width + 100, startY, type);
            enemy.body.setImmovable(true); // Make this enemy immovable
            enemy.setVelocityX(-120); // Match drone speed for consistency
            enemy.health = 6; // Trucks require 6 health (2 missile hits)
            enemy.points = 30;
            enemy.setScale(0.23); // Changed truck size to 0.23

            // Create smoke emitter for truck
            this.setupEnemySmoke(enemy, -25, 10); // Adjust offset for truck

        } else if (type === 'enemy_motorcycle') {
            // Bikes spawn from right side, in a lower lane
            const bikeLaneOffset = 18; // Offset to move bikes downwards from player lane
            startY = this.player.y + bikeLaneOffset; // Set Y position below the player
            enemy = this.enemies.create(this.width + 100, startY, type);
            enemy.body.setImmovable(true); // Make this enemy immovable
            enemy.setVelocityX(-120); // Match drone speed for consistency
            enemy.health = 3; // Bikes require 3 hits
            enemy.points = 10;
            enemy.setScale(0.1); // Set bike size to 0.1

            // Create smoke emitter for bike
            this.setupEnemySmoke(enemy, -15, 5); // Adjust offset for bike

        } else { // enemy_drone
            // Drones spawn from the right and move up and down
            startY = Phaser.Math.Between(50, 150); // Spawn near the top initially
            enemy = this.enemies.create(this.width + 100, startY, type);
            enemy.body.setImmovable(true); // Make this enemy immovable
            enemy.setVelocityX(-120); // Decreased horizontal speed (less negative)
            enemy.health = 2; // Drones require 2 hits
            enemy.points = 20;
            enemy.setScale(0.4); // Set drone size back to previous scale

            // Add vertical tween for full screen up and down movement with increased speed
            this.tweens.add({
                targets: enemy,
                y: { start: 50, to: this.height/2 }, // Tween from near top to center of screen
                duration: 2000, // Even slower vertical movement (increased duration)
                ease: 'SineInOut',
                yoyo: true, // Move back up
                repeat: -1, // Loop indefinitely
            });
        }
        
        // Set depth for the enemy
        enemy.setDepth(5);

        // Add a property to track last shot time for the enemy
        enemy.lastShotTime = 0;
        
        // Remove enemy when it goes off screen
        enemy.checkWorldBounds = true;
        enemy.outOfBoundsKill = true;

        // Initialize enemy specific properties for bullet collision handling
        enemy.type = type; // Store the type on the enemy object

        // Add cleanup for smoke emitter when enemy is destroyed
        enemy.on('destroy', () => {
            if (enemy.smokeEmitter) {
                console.log(`Cleaning up smoke emitter for ${enemy.type}`);
                enemy.smokeEmitter.stop();
                enemy.smokeEmitter.destroy(); // Changed from manager.removeEmitter
            }
        });
    }

    // New function to setup smoke for enemies
    setupEnemySmoke(enemy, offsetX, offsetY) {
        console.log(`Setting up smoke emitter for ${enemy.type}...`);
        
        if (enemy.smokeEmitter) {
            enemy.smokeEmitter.stop();
            enemy.smokeEmitter.destroy(); // Changed from manager.removeEmitter
        }

        // Position at bottom-left of enemy
        const x = enemy.x - enemy.displayWidth * 0.4;
        const y = enemy.y + enemy.displayHeight * 0.3;

        // Create emitter with modified configuration
        const emitter = this.vfx.createEmitter('smoke', x, y, 0.3, 0, 1200, { // lifespan doubled
            angle: { min: 180, max: 180 },  // Emit strictly left
            speed: { min: 40, max: 60 },    // Only positive speed, no randomness in direction
            scale: { start: 1.2, end: 0.6 }, // Stretched horizontally
            scaleY: { start: 0.4, end: 0.2 }, // Thinner vertically (if supported)
            alpha: { start: 0.3, end: 0 },
            rotate: { min: 0, max: 0 }, // No rotation
            frequency: 25,
            quantity: 4,
            gravityY: 0,
            gravityX: 0
        });
        
        emitter.start();
        enemy.smokeEmitter = emitter;

        // Add cleanup for smoke emitter when enemy is destroyed
        enemy.on('destroy', () => {
            if (enemy.smokeEmitter) {
                console.log(`Cleaning up smoke emitter for ${enemy.type}`);
                enemy.smokeEmitter.stop();
                enemy.smokeEmitter.destroy(); // Changed from manager.removeEmitter
            }
        });
    }

    spawnPowerup() {
        const powerupTypes = ['powerup_health', 'powerup_missile', 'powerup_shield', 'powerup_airstrike'];
        const weights = [50, 10, 20, 8]; // Health, Shield, Missile, Airstrike (in order of rarity)
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let rand = Phaser.Math.Between(1, totalWeight);
        let type;
        for (let i = 0; i < powerupTypes.length; i++) {
            if (rand <= weights[i]) {
                type = powerupTypes[i];
                break;
            }
            rand -= weights[i];
        }
        // Directly increment inventory count and update display, no floating powerup
        switch (type) {
            case 'powerup_health':
                if (this.healthCount < 5) this.healthCount++;
                break;
            case 'powerup_missile':
                if (this.missileCount < 5) this.missileCount++;
                break;
            case 'powerup_shield':
                if (this.shieldCount < 5) this.shieldCount++;
                break;
            case 'powerup_airstrike':
                if (this.airstrikeCount < 5) this.airstrikeCount++;
                break;
        }
        this.updateInventoryDisplay();
        // Optionally, play a sound or show a quick UI effect here
    }

    handlePlayerEnemyCollision(player, enemy) {
         // Check if both player and enemy objects are active before processing collision
        if (!player.active || !enemy.active) return;

        // Removed the specific game over condition for bike or truck collision
        // The game will no longer end immediately on collision with bikes or trucks.
        
        // Existing logic for drones and shielded collisions:
        if (this.shieldActive) {
            enemy.destroy();
            this.createExplosion(enemy.x, enemy.y, enemy.type);
            this.updateScore(enemy.points);
             // ITEM DROP ON ENEMY DESTRUCTION
            this.maybeDropItem(enemy.x, enemy.y);
        } else {
            this.takeDamage(20); // Damage player (this will now only apply to drone collisions)
            enemy.destroy();
            this.createExplosion(enemy.x, enemy.y, enemy.type);
             // ITEM DROP ON ENEMY DESTRUCTION
            this.maybeDropItem(enemy.x, enemy.y);
        }
    }

    handleBulletEnemyCollision(bullet, enemy) {
         // Check if both bullet and enemy objects are active before processing collision
         if (!bullet.active || !enemy.active) return;

        bullet.destroy(); // Destroy player bullet on hit
        
         // Use enemy.type to check if it's a truck for health calculation
        if (enemy.type === 'enemy_truck') {
             if (bullet.texture.key === 'missile') {
                 enemy.health -= 3; // Missile does more damage to truck
             } else {
                 enemy.health -= 1; // Regular bullet damage to truck
             }
        } else {
             // Non-truck enemies (bikes and drones) have 1 health and are destroyed by any hit
             enemy.health -= 1; 
        }

        // Check if enemy is destroyed
        if (enemy.health <= 0) {
            // Stop any active tweens before destroying the enemy
            if (enemy.tween) { // Assuming the tween was stored in enemy.tween
                enemy.tween.stop();
            } else {
                 // Check if there's a tween on the enemy through the tween manager
                 const activeTweens = this.tweens.getTweensOf(enemy);
                 activeTweens.forEach(tween => tween.stop());
            }

            // The emitter cleanup is now handled by the 'destroy' event listener on the enemy object
            // if (enemy.smokeEmitter) {
            //     enemy.smokeEmitter.stop();
            //     enemy.smokeEmitter.manager.removeEmitter(enemy.smokeEmitter);
            // }

            enemy.destroy();
            this.createExplosion(enemy.x, enemy.y, enemy.type);
            this.updateScore(enemy.points);
            this.killStreak++;

            // Add power-up to inventory when enemy is destroyed
            const dropChance = Phaser.Math.Between(1, 100);
            if (dropChance <= 30) { // 30% chance to get a power-up
                const powerupTypes = ['health', 'missile', 'shield'];
                const type = powerupTypes[Phaser.Math.Between(0, powerupTypes.length - 1)];
                switch(type) {
                    case 'health':
                        if (this.healthCount < 5) this.healthCount++;
                        break;
                    case 'missile':
                        if (this.missileCount < 5) this.missileCount++;
                        break;
                    case 'shield':
                        if (this.shieldCount < 5) this.shieldCount++;
                        break;
                }
                this.updateInventoryDisplay();
            }
        }
    }

    // NEW FUNCTION TO HANDLE PLAYER COLLISION WITH ENEMY BULLETS
    handlePlayerBulletCollision(player, bullet) {
        // Check if both player and bullet objects are active before processing collision
        if (!player.active || !bullet.active) return;

        bullet.destroy(); // Destroy enemy bullet on hit
        if (!this.shieldActive) {
            this.takeDamage(10); // Player takes damage from enemy bullet
        }
    }

    // **NEW FUNCTION TO HANDLE COLLISION BETWEEN PLAYER AND ENEMY BULLETS**
    handleBulletBulletCollision(playerBullet, enemyBullet) {
        // Check if both bullet objects are active before processing collision
        if (!playerBullet.active || !enemyBullet.active) return;

        // If the player bullet is a missile, let it take up to 2 hits
        if (playerBullet.texture.key === 'missile') {
            enemyBullet.destroy(); // Destroy the enemy bullet
            playerBullet.hitCount++; // Increment the missile's hit counter

            if (playerBullet.hitCount >= 2) {
                playerBullet.destroy(); // Destroy the missile after 2 hits
            }
        } else {
            // If it's a regular player bullet, destroy both on hit
            playerBullet.destroy();
            enemyBullet.destroy();
        }
    }

    collectPowerup(player, powerup) {
         // Check if both player and powerup objects are active before processing collision
        if (!player.active || !powerup.active) return;

        console.log(`Collected powerup: ${powerup.type}`); // Log when a powerup is collected
        powerup.destroy();

        // Play powerup sound
        this.sound.play('collect');

        // Update inventory instead of activating immediately
        switch (powerup.type) {
            case 'powerup_health':
                if (this.healthCount < 5) this.healthCount++;
                break;
            case 'powerup_missile':
                if (this.missileCount < 5) this.missileCount++;
                break;
            case 'powerup_shield':
                if (this.shieldCount < 5) this.shieldCount++;
                break;
            case 'powerup_airstrike':
                if (this.airstrikeCount < 5) this.airstrikeCount++;
                break;
        }

        // Update the inventory display
        this.updateInventoryDisplay();
    }

    // NEW FUNCTION TO UPDATE INVENTORY DISPLAY
    updateInventoryDisplay() {
        if (this.healthInventoryText) {
            this.healthInventoryText.setText(`${this.healthCount}`);
            if (this.healthIcon) this.healthIcon.setAlpha(this.healthCount > 0 ? 1 : 0.3);
        }
        if (this.missileInventoryText) {
            this.missileInventoryText.setText(`${this.missileCount}`);
            if (this.missileIcon) this.missileIcon.setAlpha(this.missileCount > 0 ? 1 : 0.3);
        }
        if (this.shieldInventoryText) {
            this.shieldInventoryText.setText(`${this.shieldCount}`);
            if (this.shieldIcon) this.shieldIcon.setAlpha(this.shieldCount > 0 ? 1 : 0.3);
        }
        if (this.airstrikeInventoryText) {
            this.airstrikeInventoryText.setText(`${this.airstrikeCount}`);
            if (this.airstrikeIcon) this.airstrikeIcon.setAlpha(this.airstrikeCount > 0 ? 1 : 0.3);
        }
    }

    // NEW FUNCTION TO ACTIVATE POWERUP FROM INVENTORY
    activatePowerup(type) {
        console.log(`Attempting to activate powerup: ${type}`);
        let activated = false;

        switch (type) {
            case 'health':
                if (this.healthCount > 0) {
                    this.healthCount--;
                    this.updateInventoryDisplay(); // Ensure display updates after decrement
                    this.health = Math.min(100, this.health + 25); // Increase health
                    this.updateHealthBar();
                    // Add healing VFX effects (optional, moved from collectPowerup)
                    this.vfx.shakeCamera(300, 0.005); // Gentle camera shake
                    this.vfx.addCircleTexture('healingCircle', 0x00ff00, 1.0, 30); // Changed alpha from 0.6 to 1.0
                    const healingEmitter = this.vfx.createEmitter('healingCircle', this.player.x, this.player.y, 1.0, 0, 500); // Changed alpha from 0.2 to 1.0
                    healingEmitter.explode(20); // Burst of healing particles
                    this.vfx.addGlow(this.player, 1.0, 0x00ff00); // Changed from 0.8 to 1.0 for full opacity
                    this.player.setAlpha(1); // Ensure player is fully opaque
                    // Delay resetting player appearance by 1 second
                    this.time.delayedCall(1000, () => {
                        this.checkAndResetPlayerAppearance();
                    });
                    activated = true;
                }
                break;
            case 'missile':
                if (this.missileCount > 0 && !this.missileActive) {
                    this.missileCount--;
                    this.updateInventoryDisplay(); // Ensure display updates after decrement
                    this.activateMissilePowerup();
                    // Add missile VFX effects (optional, moved from collectPowerup)
                    this.vfx.shakeCamera(200, 0.008); // Stronger camera shake
                    this.vfx.addGlow(this.player, 1.0, 0xff0000); // Red glow
                    this.vfx.addCircleTexture('missileCircle', 0xff0000, 1.0, 25);
                    const missileEmitter = this.vfx.createEmitter('missileCircle', this.player.x, this.player.y, 1.0, 0, 400);
                    missileEmitter.explode(15); // Burst of missile particles
                    this.player.setAlpha(1); // Ensure player is fully opaque
                    activated = true;
                }
                break;
            case 'shield':
                if (this.shieldCount > 0 && !this.shieldActive) {
                    this.shieldCount--;
                    this.updateInventoryDisplay(); // Ensure display updates after decrement
                    this.activateShieldPowerup();
                    
                    // Create shield bubble effect
                    const shieldBubble = this.add.graphics();
                    shieldBubble.lineStyle(8, 0x00ffff, 0.8); // Cyan color with slight transparency
                    shieldBubble.strokeCircle(0, 0, 80); // Initial circle size
                    shieldBubble.setPosition(this.player.x, this.player.y);
                    shieldBubble.setDepth(9); // Just below player depth
                    
                    // Simple fade in animation
                    shieldBubble.setScale(1.5); // Set constant scale
                    shieldBubble.setAlpha(0);
                    this.tweens.add({
                        targets: shieldBubble,
                        alpha: 0.8,
                        duration: 300,
                        ease: 'Power2'
                    });

                    // Store shield bubble reference for cleanup
                    this.shieldBubble = shieldBubble;

                    // Add shield VFX effects
                    this.vfx.shakeCamera(400, 0.003); // Subtle camera shake
                    this.vfx.addGlow(this.player, 1.0, 0x00ffff); // Cyan glow
                    this.vfx.addCircleTexture('shieldCircle', 0x00ffff, 1.0, 35);
                    const shieldEmitter = this.vfx.createEmitter('shieldCircle', this.player.x, this.player.y, 1.0, 0, 600);
                    shieldEmitter.explode(25); // More shield particles
                    this.player.setAlpha(1); // Ensure player is fully opaque
                    activated = true;
                }
                break;
            case 'airstrike':
                if (this.airstrikeCount > 0) {
                    this.airstrikeCount--;
                    this.updateInventoryDisplay(); // Ensure display updates after decrement
                    this.triggerAirStrike();
                    activated = true;
                }
                break;
        }

        if (activated) {
            console.log(`${type} powerup activated.`);
            // Play activation sound (optional)
            this.sound.play('collect'); // Reusing collect sound for now
        } else {
            console.log(`Could not activate ${type} powerup (none available or already active).`);
        }
    }

    activateMissilePowerup() {
        console.log('Missile powerup activated. missileActive = true');
        this.missileActive = true;

        // Clear any existing timer
        if (this.missileTimer) {
            this.missileTimer.remove();
        }

        const duration = 10000; // 10 seconds
        const startTime = this.time.now;

        // Make timer visible
        this.missileTimerCircle.setVisible(true);
        this.missileTimerText.setVisible(true);

        // Create timer update event
        this.missileTimer = this.time.addEvent({
            delay: 100,
            callback: () => {
                const remaining = duration - (this.time.now - startTime);
                if (remaining <= 0) {
                    this.missileActive = false;
                    this.missileTimerCircle.clear();
                    this.missileTimerText.setText('');
                    this.missileTimer.remove();
                    this.missileTimerCircle.setVisible(false);
                    this.missileTimerText.setVisible(false);
                    this.checkAndResetPlayerAppearance();
                } else {
                    // Get the missile icon position
                    const x = this.missileIcon.x;
                    const y = this.missileIcon.y;
                    this.updatePowerupTimer(
                        this.missileTimer,
                        this.missileTimerCircle,
                        this.missileTimerText,
                        0xff0000,
                        x,
                        y,
                        duration,
                        remaining
                    );
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    activateShieldPowerup() {
        this.shieldActive = true;

        // Clear any existing timer
        if (this.shieldTimer) {
            this.shieldTimer.remove();
        }

        const duration = 5000; // 5 seconds
        const startTime = this.time.now;

        // Make timer visible
        this.shieldTimerCircle.setVisible(true);
        this.shieldTimerText.setVisible(true);

        // Create timer update event
        this.shieldTimer = this.time.addEvent({
            delay: 100,
            callback: () => {
                const remaining = duration - (this.time.now - startTime);
                if (remaining <= 0) {
                    this.shieldActive = false;
                    this.shieldTimerCircle.clear();
                    this.shieldTimerText.setText('');
                    this.shieldTimer.remove();
                    this.shieldTimerCircle.setVisible(false);
                    this.shieldTimerText.setVisible(false);
                    this.checkAndResetPlayerAppearance();
                } else {
                    // Get the shield icon position
                    const x = this.shieldIcon.x;
                    const y = this.shieldIcon.y;
                    this.updatePowerupTimer(
                        this.shieldTimer,
                        this.shieldTimerCircle,
                        this.shieldTimerText,
                        0x00ffff,
                        x,
                        y,
                        duration,
                        remaining
                    );
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        this.killStreak = 0; // Reset kill streak on taking damage

        if (this.health <= 0) {
            this.gameOver();
        }
    }

    createExplosion(x, y, enemyType) { // Accept enemyType parameter
        // Add camera shake - maybe adjust based on type? For now, keep consistent.
        this.vfx.shakeCamera(200, 0.005); // Reduced duration and intensity for less shaking
        
        // Define base parameters
        let particleQuantity = 80;
        let emitterScale = 1.0;
        let lifespan = { start: 600, end: 1200 };
        let speed = { min: 150, max: 450 };
        let glowRadius = 150;
        let glowDuration = 500;

        // Adjust parameters based on enemy type
        if (enemyType === 'enemy_motorcycle' || enemyType === 'enemy_drone') {
            particleQuantity = 40; // Fewer particles
            emitterScale = 0.5; // Smaller particle scale
            lifespan = { start: 400, end: 800 }; // Shorter lifespan
            speed = { min: 100, max: 300 }; // Slower speed
            glowRadius = 80; // Smaller glow radius
            glowDuration = 300; // Shorter glow duration
        } else if (enemyType === 'enemy_truck') {
            // Keep current larger explosion size for trucks
            // Parameters are already set to the base large size above
        }

        // Create explosion circle texture - using a basic white texture now to allow tinting
        this.vfx.addCircleTexture('explosionCore', 0xffffff, 1.0, 50); // White core texture
        
        // Create and explode particles with color blend
        const explosionEmitter = this.add.particles(x, y, 'explosionCore', {
            frame: 0,
            lifespan: lifespan, // Use adjusted lifespan
            speed: speed, // Use adjusted speed
            scale: { start: emitterScale, end: 0.1 }, // Starting larger, fading smaller
            alpha: { start: 1, end: 0 }, // Fully opaque to fully transparent
            rotate: { start: 0, end: 360 }, // Particles can rotate
            angle: { min: 0, max: 360 }, // Emit in all directions
            quantity: particleQuantity, // Use adjusted quantity
            blendMode: 'ADD',
            // Tint particles over their lifespan from bright yellow to fiery orange
            tint: { start: 0xffffcc, end: 0xff4500 }, // Blend from bright yellowish-white to fiery orange
            emitting: false // Start stopped, we'll explode them
        });

        explosionEmitter.explode(particleQuantity); // Explode the adjusted number of particles
        
        // Add a flash/glow effect at the explosion point (more like a flash)
        const explosionFlash = this.add.graphics();
        explosionFlash.fillStyle(0xffff00, 1.0); // Bright yellow color, fully opaque initially
        explosionFlash.fillCircle(x, y, glowRadius); // Use adjusted glow radius
        
        // Quickly fade out and scale the flash
        this.tweens.add({
            targets: explosionFlash,
            alpha: 0, // Fade to fully transparent
            scale: { start: 1, end: 1.6 }, // Slightly increased expansion as it fades - can also adjust this based on type if needed
            ease: 'Quad.easeOut', // Use an easing function
            duration: glowDuration, // Use adjusted glow duration
            onComplete: () => {
                explosionFlash.destroy();
            }
        });
    }

    updateScore(points) {
        this.score += Math.floor(points * this.scoreMultiplier);
        // Update score text with dollar sign prefix
        this.scoreText.setText(`$${this.score}`);
    }

    // NEW FUNCTION TO HANDLE ITEM DROPS
    maybeDropItem(x, y) {
        // Commenting out item drops
        /*
        const dropChance = Phaser.Math.Between(1, 100); // 1% chance to drop an item (adjust as needed)
        if (dropChance <= 20) { // Increased chance for testing, e.g., 20%
            this.spawnPowerupAt(x, y); // Use existing powerup spawning logic
        }
        */
    }

    // NEW FUNCTION TO SPAWN POWERUP AT A SPECIFIC LOCATION
    spawnPowerupAt(x, y) {
        //  power-up spawning on the road
        /*
        const powerupTypes = ['powerup_health', 'powerup_missile', 'powerup_shield', 'powerup_airstrike'];
        const type = powerupTypes[Phaser.Math.Between(0, powerupTypes.length - 1)];
        
        // Spawn powerup at a fixed low vertical position, regardless of enemy y
        const spawnY = this.height - 30; // Fixed position near the bottom

        const powerup = this.powerups.create(x, spawnY, type);
        powerup.setVelocityX(-100); // Powerups still move left slowly
        powerup.type = type;
        powerup.setDepth(5);
        powerup.setScale(0.2); // Increase powerup size
        powerup.checkWorldBounds = true;
        powerup.outOfBoundsKill = true;
        */
    }

    gameOver() {
        this.isGameOver = true;
        
        // Play lose sound
        this.sound.play('lose');

        // Show game over text
        const gameOverText = this.add.text(this.width / 2, this.height / 2, 'GAME OVER', {
            fontSize: '64px',
            fill: '#ff0000',
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(20);

        // Show final score and distance
        const finalScoreText = this.add.text(this.width / 2, this.height / 2 + 80, 
            `Final Score: ${this.score}\nDistance: ${(this.distance / 1000).toFixed(1)}km`, {
            fontSize: '32px',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(20);

        // Add restart button
        const restartButton = this.add.text(this.width / 2, this.height / 2 + 160, 'RESTART', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#00000080',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive()
        .setDepth(20) // Ensure restart button is on top
        .on('pointerdown', () => {
            this.scene.restart();
        });

        // Add key listener for restart (optional, but good for desktop testing)
        this.input.keyboard.once('keydown-R', () => {
            this.scene.restart();
        });

        initiateGameOver.bind(this)({
            "score": this.score
        });

        // Remove smoke emitters stop and destroy
        // this.smokeEmitters.forEach(emitter => { // Remove forEach loop
        //     emitter.stop();
        //     emitter.destroy();
        // });
        // this.smokeEmitters.clear(); // Remove map clear
    }

    pauseGame() {
         // Check if game is already over before pausing
         if (this.isGameOver) return;
        handlePauseGame.bind(this)();
    }

    // NEW PRELOAD FOR EXPLOSION ANIMATION
    createAnimations() {
        // Create explosion animation frames
        const explosionFrames = [];
        for (let i = 0; i < 6; i++) {
            explosionFrames.push({ key: 'explosion', frame: i });
        }
        
        this.anims.create({
            key: 'explosion',
            frames: explosionFrames,
            frameRate: 15,
            repeat: 0
        });
    }

    checkAndResetPlayerAppearance() {
        // Check if both shield and missile powerups are inactive
        if (!this.shieldActive && !this.missileActive) {
            console.log('Both powerups inactive, resetting player appearance.');
            // Reset player tint
            this.player.clearTint();
            // Reset player alpha (if it was changed)
            this.player.setAlpha(1);
            // Reset player scale to default
            this.player.setScale(0.3); // Adjusted default scale to match initial scale
            // Reset player angle to default
            this.player.setAngle(0); // Assuming 0 is the default angle
            
            // Clean up shield bubble if it exists
            if (this.shieldBubble) {
                this.shieldBubble.destroy();
                this.shieldBubble = null;
            }
        }
    }

    // NEW FUNCTION to create player smoke emitter
    setupPlayerSmoke() {
        console.log('Setting up player smoke emitter...');
        
        if (this.player.smokeEmitter) {
            this.player.smokeEmitter.stop();
            this.player.smokeEmitter.destroy();
        }

        // Position at left center of player
        const x = this.player.x - this.player.displayWidth * 0.5; // Move to left edge
        const y = this.player.y - this.player.displayHeight / 2; // Top edge

        // Create emitter with modified configuration
        const emitter = this.vfx.createEmitter('smoke', x, y, 0.3, 0, 1200, { // lifespan doubled
            angle: { min: 180, max: 180 },  // Emit strictly left
            speed: { min: 40, max: 60 },    // Only positive speed, no randomness in direction
            scale: { start: 1.2, end: 0.6 }, // Stretched horizontally
            scaleY: { start: 0.4, end: 0.2 }, // Thinner vertically (if supported)
            alpha: { start: 0.3, end: 0 },
            rotate: { min: 0, max: 0 }, // No rotation
            frequency: 25,
            quantity: 4,
            gravityY: 0,
            gravityX: 0
        });
        
        emitter.start();
        this.player.smokeEmitter = emitter;

        this.player.on('destroy', () => {
            if (this.player.smokeEmitter) {
                this.player.smokeEmitter.stop();
                this.player.smokeEmitter.destroy();
            }
        });
    }

    // NEW FUNCTION to create the smoke particle texture
    createSmokeTexture() {
        // Only create if it doesn't exist
        if (this.textures.exists('smoke')) {
            return;
        }

        // Create a horizontal ellipse (streak) smoke texture
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x888888, 0.6);
        graphics.fillEllipse(16, 8, 32, 12); // Wide, short ellipse
        graphics.generateTexture('smoke', 32, 16);
        graphics.destroy();
    }

    // AIR STRIKE EFFECT: Spawns 8-10 missiles from the sky that destroy all enemies on impact
    triggerAirStrike() {
        const missileCount = Phaser.Math.Between(8, 10);
        for (let i = 0; i < missileCount; i++) {
            const x = Phaser.Math.Between(80, this.width - 80);
            const missile = this.physics.add.sprite(x, -50, 'missile');
            missile.setScale(0.18);
            missile.setDepth(20);
            missile.body.setVelocityY(600);
            missile.setAngle(90);
            // When missile overlaps an enemy, destroy both and create explosion
            this.physics.add.overlap(missile, this.enemies, (missileObj, enemy) => {
                this.createExplosion(enemy.x, enemy.y, enemy.type);
                enemy.destroy();
                missileObj.destroy();
            });
            // When missile reaches the ground, create explosion and destroy missile
            missile.update = () => {
                if (missile.y > this.height - 30) {
                    this.createExplosion(missile.x, this.height - 30, 'enemy_truck');
                    missile.destroy();
                }
            };
        }
        // Play airstrike sound if available
        if (this.sound.get('airstrike')) {
            this.sound.play('airstrike');
        }
    }
}

// Loading screen implementation
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

    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
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
        // Commented out sound configuration
        // sounds: _CONFIG.sounds,
    },
    orientation: _CONFIG.deviceOrientation === "portrait"
};