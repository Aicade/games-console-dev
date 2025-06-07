// Touch Screen Controls
const joystickEnabled = false;
const buttonEnabled = false;

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.isPointerDown = false;
        this.isHarpoonCast = false;
        this.isHarpoonRetracting = false;
        this.caughtObject = null;
    }

    preload() {
        this.score = 0;
        addEventListenersPhaser.bind(this)();

        if (joystickEnabled && _CONFIG.rexJoystickUrl) {
            this.load.plugin('rexvirtualjoystickplugin', _CONFIG.rexJoystickUrl, true);
        }
        if (buttonEnabled && _CONFIG.rexButtonUrl) {
            this.load.plugin('rexbuttonplugin', _CONFIG.rexButtonUrl, true);
        }
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }

    spawnStageAssets() {
        // Set up grid cells as before
        let columns = 12, rows = 6;
        let cellWidth = this.platform.width / columns;
        let cellHeight = 400 / rows;
        let gridCells = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                let cellX = this.platform.x - this.platform.width / 2 + (col + 0.5) * cellWidth;
                let cellY = this.platform.y - 400 + (row + 0.5) * cellHeight;
                gridCells.push({ x: cellX, y: cellY });
            }
        }
        Phaser.Utils.Array.Shuffle(gridCells);
        
        // Determine counts based on stage (increase difficulty with each stage)
        // For example: stage 1 -> 5 collectibles, 4 avoidables; stage 2 -> 8 collectibles, 6 avoidables; etc.
        let collectiblesCount = 5 + (this.stage - 1) * 3;
        let avoidableCount = 4 + (this.stage - 1) * 2;
        this.totalCollectibles = collectiblesCount;
        this.collectedCount = 0;
        
        // Clear previous assets if any
        this.collectibles.clear(true, true);
        this.avoidable.clear(true, true);
        
        // Spawn collectibles
        for (let i = 0; i < collectiblesCount; i++) {
            let pos = gridCells[i];
            let collectible = this.physics.add.image(pos.x, pos.y, 'collectible')
                .setOrigin(0.5, 0.5)
                .setScale(0.2);
            this.collectibles.add(collectible);
        }
        
        // Spawn avoidable assets in the next set of cells
        for (let i = collectiblesCount; i < collectiblesCount + avoidableCount; i++) {
            let pos = gridCells[i];
            let avoidableItem = this.physics.add.image(pos.x, pos.y, 'avoidable')
                .setOrigin(0.5, 0.5)
                .setScale(0.2);
            this.avoidable.add(avoidableItem);
        }
    }
    

    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.background.setVolume(2.5).setLoop(true).play();
    
        this.vfx = new VFXLibrary(this);
    
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.image(this.width / 2, this.height / 2, "background").setOrigin(0.5);
        const scale = Math.max(this.width / this.bg.displayWidth, this.height / this.bg.displayHeight);
        this.bg.setScale(scale);
    
        // UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 40, 'pixelfont', '0', 128)
                              .setOrigin(0.5, 0.5)
                              .setDepth(11);

        // --- Add Lives (Hearts) below the timer with manual spacing ---
        this.lives = 3;
        this.hearts = [];

        // Starting position
        let startX = 65; 
        let startY = 80; 

        // Define spacing between hearts (in pixels)
        let spacing = 60;
        let heartWidth = 64 * 0.05;

        for (let i = 0; i < this.lives; i++) {
            let x = startX + i * (heartWidth + spacing);
            let heart = this.add.image(x, startY, "heart")
                        .setScale(0.05)
                        .setScrollFactor(0)
                        .setDepth(11);
            this.hearts.push(heart);
        }
    
        // Input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton")
                               .setOrigin(0.5, 0.5)
                               .setInteractive({ cursor: 'pointer' })
                               .setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());
    
        const joyStickRadius = 50;
        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 2,
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
                dir: '8dir'
            });
            this.joystickKeys = this.joyStick.createCursorKeys();
        }
        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 80, this.height - 100, 80, 80, 0xcccccc, 0.5);
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });
            this.buttonA.button.on('down', (button, gameObject) => {
                console.log("buttonA clicked");
            });
        }
    
        this.score = 0;
        this.depth = 0;
        this.isHarpoonCast = false;
        this.isGameOver = false;
    
        // --- Platform (ground) code ---
        this.platform = this.add.tileSprite(this.width / 2, this.height, this.width, 400, 'platform');
        this.physics.add.existing(this.platform);
        this.platform.body.setImmovable(true);
        this.platform.body.setAllowGravity(false);
        this.platform.setOrigin(0.5, 1);
    
        // --- Draw grid lines on the platform ---
        let gridGraphics = this.add.graphics();
        gridGraphics.lineStyle(2, 0x000000, 1);
        let columns = 12, rows = 6;
        let cellWidth = this.platform.width / columns;
        let cellHeight = 400 / rows;
    
        // Vertical grid lines
        for (let col = 0; col <= columns; col++) {
            let x = this.platform.x - this.platform.width / 2 + col * cellWidth;
            gridGraphics.moveTo(x, this.platform.y);
            gridGraphics.lineTo(x, this.platform.y - 400);
        }
        // Horizontal grid lines
        for (let row = 0; row <= rows; row++) {
            let y = this.platform.y - 400 + row * cellHeight;
            gridGraphics.moveTo(this.platform.x - this.platform.width / 2, y);
            gridGraphics.lineTo(this.platform.x + this.platform.width / 2, y);
        }
        gridGraphics.strokePath();
        gridGraphics.setVisible(false);

    
        // --- Create physics groups ---
        this.enemiesLeft = this.physics.add.group();
        this.enemiesRight = this.physics.add.group();
        this.collectibles = this.physics.add.group();
        this.avoidable = this.physics.add.group();
    
        // --- Spawn assets in random grid cells ---
        let gridCells = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                let cellX = this.platform.x - this.platform.width / 2 + (col + 0.5) * cellWidth;
                let cellY = this.platform.y - 400 + (row + 0.5) * cellHeight;
                gridCells.push({ x: cellX, y: cellY });
            }
        }
        // Shuffle the grid cells array randomly
        Phaser.Utils.Array.Shuffle(gridCells);
        
        // Spawn collectible assets in the first 5 cells
        for (let i = 0; i < 5; i++) {
            let pos = gridCells[i];
            let collectible = this.physics.add.image(pos.x, pos.y, 'collectible')
                .setOrigin(0.5, 0.5)
                .setScale(0.2);
            this.collectibles.add(collectible);
        }
        
        // Spawn avoidable assets in the next 4 cells
        for (let i = 5; i < 9; i++) {
            let pos = gridCells[i];
            let avoidableItem = this.physics.add.image(pos.x, pos.y, 'avoidable')
                .setOrigin(0.5, 0.5)
                .setScale(0.2);
            this.avoidable.add(avoidableItem);
        }

        this.stage = 1;            // Current stage
this.totalCollectibles = 0;  // Will be set in spawnStageAssets
this.collectedCount = 0;     // Count how many collectibles have been collected

// … (after setting up platform, etc.)

// Instead of your inline spawning code, call:
this.spawnStageAssets();

    
        // Create the boat (fixed in the middle)
        this.boat = this.add.sprite(this.width / 2, 200, 'player').setScale(0.2);
        this.boat.setInteractive();
    
        // Create the harpoon and hide it initially
        this.harpoon = this.physics.add.sprite(this.boat.x, this.boat.y, 'projectile').setScale(0.1);
        this.harpoon.visible = false;
    
        // Create a graphics object for the rope
        this.rope = this.add.graphics();
    
        // Handle pointer events for harpoon release and retraction
        this.input.on('pointerdown', this.releaseHarpoon, this);
        this.input.on('pointerup', this.retractHarpoon, this);
    
        // Collision handlers
        this.physics.add.overlap(this.harpoon, this.enemiesLeft, this.harpoonHitsEnemy, null, this);
        this.physics.add.overlap(this.harpoon, this.enemiesRight, this.harpoonHitsEnemy, null, this);
        this.physics.add.overlap(this.harpoon, this.collectibles, this.harpoonHitsCollectible, null, this);
        this.physics.add.collider(this.harpoon, this.avoidable, this.harpoonHitsAvoidable, null, this);
    
        // Enemy spawner
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnEnemies,
            callbackScope: this,
            loop: true
        });
        
        // Game timer
        this.timerEvent = this.time.addEvent({
            delay: 60000,
            callback: () => this.gameOver(),
            callbackScope: this,
            loop: false
        });
        
        this.timerText = this.add.bitmapText(120, 20, 'pixelfont', 'Timer: ', 40)
                              .setOrigin(0.5, 0.5);
        
        this.input.keyboard.disableGlobalCapture();
        
        // Create a bubble texture for particles
        let bubble = this.add.graphics({ x: -100, y: 0, add: false });
        const bubbleRadius = 50;
        const bubbleColor = 0x00bfff;
        bubble.fillStyle(bubbleColor, 0.5);
        bubble.fillCircle(bubbleRadius, bubbleRadius, bubbleRadius);
        bubble.generateTexture('bubbles', 100, 100);
    }
    
    // Spawn enemies from left and right sides
    spawnEnemies() {
        if (!this.isGameOver) {
            // Left side enemy
            let yPos = Phaser.Math.Between(300, this.height - 200);
            let enemyLeft = this.physics.add.sprite(0, yPos, 'enemy').setScale(0.2);
            enemyLeft.body.setVelocityX(100);
            this.enemiesLeft.add(enemyLeft);
            
            // Right side enemy
            yPos = Phaser.Math.Between(300, this.height - 200);
            let enemyRight = this.physics.add.sprite(this.width, yPos, 'enemy').setScale(0.2);
            enemyRight.body.setVelocityX(-100);
            this.enemiesRight.add(enemyRight);
        }
    }

    releaseHarpoon(pointer) {
        if (!this.isGameOver) {
            this.sounds.move.setVolume(1).setLoop(false).play();

            if (this.isHarpoonCast || this.isHarpoonRetracting) {
                return;
            }

            this.isHarpoonCast = true;
            this.harpoon.visible = true;
            // Start at the boat's position
            this.harpoon.setPosition(this.boat.x, this.boat.y);
            this.isPointerDown = true;

            // Compute the direction vector from the boat to the pointer
            let dx = pointer.x - this.boat.x;
            let dy = pointer.y - this.boat.y;
            let mag = Math.sqrt(dx * dx + dy * dy);
            let normX = dx / mag;
            let normY = dy / mag;
            let speed = 800;
            this.harpoon.body.setAllowGravity(false);
            this.harpoon.body.setVelocity(normX * speed, normY * speed);
        }
    }

    retractHarpoon() {
        if (!this.isGameOver) {
            if (this.isHarpoonCast) {
                this.isHarpoonRetracting = true;
                // Stop the harpoon's movement
                this.harpoon.body.setVelocity(0, 0);
                
                // Tween it back to the boat's position
                this.tweens.add({
                    targets: this.harpoon,
                    x: this.boat.x,
                    y: this.boat.y,
                    duration: 1500,
                    ease: 'Power2',
                    onUpdate: () => {
                        // If we caught something, move it with the harpoon
                        if (this.caughtObject && this.caughtObject.active) {
                            this.caughtObject.x = this.harpoon.x;
                            this.caughtObject.y = this.harpoon.y;
                        }
                    },
                    onComplete: () => {
                        if (this.caughtObject && this.caughtObject.active) {
                            // If the caught object is an avoidable, lose a life instead of scoring
if (this.avoidable.contains(this.caughtObject)) {
    this.lives--;
    // Remove one heart from the display (removing the last one)
    let lostHeart = this.hearts.pop();
    if (lostHeart) {
        // Animate the heart: move it up and fade it out
        this.tweens.add({
            targets: lostHeart,
            y: lostHeart.y - 50, // move up 50 pixels
            alpha: 0,
            ease: 'Linear',
            duration: 1000,
            onComplete: () => lostHeart.destroy()
        });
    }
    // If no lives remain, trigger game over
    if (this.lives <= 0) {
        this.sounds.lose.setVolume(1).setLoop(false).play();
        this.vfx.shakeCamera();
        this.time.delayedCall(500, this.gameOver, [], this);
    }
    // Destroy the avoidable so it vanishes
    this.caughtObject.destroy();
}
 else {
                                // Determine points based on what was caught (default enemy points)
                                let points = 10;
                                // If it's a collectible, award more points and update collectible count
                                if (this.collectibles.contains(this.caughtObject)) {
                                    points = 20; // More points for collectibles
                                    // Increase collectible count
                                    this.collectedCount++;
                                    // Check if 50% of collectibles have been collected
                                    if (this.collectedCount >= this.totalCollectibles * 0.5) {
                                        // Stage win! Show a message and transition to next stage
                                        let stageWinText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY, 'pixelfont', 'Stage Cleared!', 64)
                                                                 .setOrigin(0.5);
                                        // Reset the timer if needed, or simply delay the next stage
                                        this.time.delayedCall(2000, () => {
                                            stageWinText.destroy();
                                            this.stage++; // Increase stage number
                                            // Optionally adjust timer or difficulty here
                                            this.spawnStageAssets();  // Respawn assets with increased difficulty
                                        });
                                    }
                                }
                                
                                // Display points animation
                                let pointsText = this.add.bitmapText(this.boat.x, this.boat.y - 75, 'pixelfont', 
                                    '+' + points, 45).setOrigin(0.5, 0.5);
                                this.tweens.add({
                                    targets: pointsText,
                                    y: pointsText.y - 50,
                                    alpha: 0,
                                    ease: 'Linear',
                                    duration: 1000,
                                    onComplete: function () {
                                        pointsText.destroy();
                                    }
                                });
                                
                                // Create bubble effect
                                const emitter = this.add.particles(this.boat.x, this.boat.y, 'bubbles', {
                                    speed: { min: -100, max: 300 },
                                    scale: { start: 0.2, end: 0 },
                                    blendMode: 'MULTIPLY',
                                    lifespan: 750,
                                    tint: 0xfafafa
                                });
                                emitter.explode(70);
                                
                                // Destroy the caught object and update score
                                this.caughtObject.destroy();
                                this.score += points;
                                this.scoreText.setText(this.score);
                            }
                        }
                        
                        // Reset harpoon state
                        this.isHarpoonCast = false;
                        this.harpoon.visible = false;
                        this.isHarpoonRetracting = false;
                        this.caughtObject = null;
                    }
                    
                    
                    
                });
            }
            this.isPointerDown = false;
        }
    }

    harpoonHitsEnemy(harpoon, enemy) {
        if (!this.isHarpoonRetracting) {
            this.sounds.damage.setVolume(0.5).setLoop(false).play();
            
            // Stop the harpoon's movement when it hits an enemy
            this.harpoon.body.setVelocity(0, 0);
            
            // Store the caught enemy
            this.caughtObject = enemy;
            
            // Make the enemy stick to the harpoon
            enemy.body.setVelocity(0, 0);
            
            // Start retracting immediately after hitting
            this.retractHarpoon();
        }
    }
    
    harpoonHitsCollectible(harpoon, collectible) {
        if (!this.isHarpoonRetracting) {
            this.sounds.damage.setVolume(0.5).setLoop(false).play();
            
            // Stop the harpoon's movement when it hits a collectible
            this.harpoon.body.setVelocity(0, 0);
            
            // Store the caught collectible
            this.caughtObject = collectible;
            
            // Make the collectible stick to the harpoon
            collectible.body.setVelocity(0, 0);
            
            // Start retracting immediately after hitting
            this.retractHarpoon();
        }
    }

    harpoonHitsAvoidable(harpoon, avoidable) {
        if (!this.isHarpoonRetracting) {
            this.sounds.damage.setVolume(0.5).setLoop(false).play();
            
            // Stop the harpoon's movement when it hits an avoidable
            this.harpoon.body.setVelocity(0, 0);
            
            // Store the caught avoidable so that it's processed during retraction
            this.caughtObject = avoidable;
            avoidable.body.setVelocity(0, 0);
            
            // Start retracting the harpoon immediately after the collision
            this.retractHarpoon();
        }
    }
    

    update() {
        if (!this.isGameOver) {
            if (this.timerEvent) {
                var remainingTime = Math.floor((this.timerEvent.delay - this.timerEvent.getElapsed()) / 1000);
                this.timerText.setText('Timer: ' + remainingTime.toString());
                if (remainingTime <= 0) {
                    this.timerEvent = null;
                }
            }
            
            // Clean up enemies that have gone off screen
            this.enemiesLeft.getChildren().forEach(enemy => {
                if (enemy.x > this.width) {
                    enemy.destroy();
                }
            });
            this.enemiesRight.getChildren().forEach(enemy => {
                if (enemy.x < 0) {
                    enemy.destroy();
                }
            });
        }
        
        // Update the rope between the boat and the harpoon
        this.rope.clear();
        if (this.harpoon.visible) {
            this.rope.lineStyle(4, 0x000000);
            this.rope.beginPath();
            this.rope.moveTo(this.boat.x, this.boat.y);
            this.rope.lineTo(this.harpoon.x, this.harpoon.y);
            this.rope.strokePath();
        }
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)(this.score, this.time.now * 0.001);
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
    
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.LANDSCAPE
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
    deviceOrientation: _CONFIG.deviceOrientation==="landscape"
};